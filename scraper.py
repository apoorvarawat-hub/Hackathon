#!/usr/bin/env python3
"""
Team page scraper — finds meet-the-team/about-us pages and extracts
staff info filtered by role.

CLI usage:
    python scraper.py --input websites.json
    python scraper.py --input websites.json --output results.json --visible

Programmatic usage (for webapp integration):
    from scraper import run_scraper
    results = await run_scraper(urls=["https://example.com"], roles=["Service Manager"])
"""
import asyncio
import json
import re
import random
import argparse
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse
from typing import Callable, Optional, Tuple

from playwright.async_api import async_playwright, Page
from playwright_stealth import Stealth
from bs4 import BeautifulSoup, Tag


# ── Constants ─────────────────────────────────────────────────────────────────

HREF_KEYWORDS = [
    "meet-the-team", "meet-our-team", "meet-the-staff", "meet-our-staff",
    "our-team", "our-staff", "who-we-are", "meet-us",
    "team", "staff", "about", "people", "leadership", "employees",
]

TEXT_KEYWORDS = [
    "meet the team", "meet our team", "meet the staff", "meet our staff",
    "our team", "our staff", "about us", "who we are", "meet us",
    "leadership", "our people", "staff", "team",
]

# CSS selectors tried in order — first one with 2+ matches wins
CARD_SELECTORS = [
    "[class*='team-member']",  "[class*='staff-member']",
    "[class*='team_member']",  "[class*='staff_member']",
    "[class*='teamMember']",   "[class*='staffMember']",
    "[class*='team-card']",    "[class*='staff-card']",
    "[class*='person-card']",  "[class*='employee-card']",
    "[class*='bio-card']",     "[class*='profile-card']",
    "[class*='person']",       "[class*='employee']",
    "[class*='member']",       "[class*='card']",
    "[class*='wrap_staff']",   "[class*='staff_wrap']",
    "[class*='staff-wrap']",   "[class*='staff-item']",
    "[class*='staff_item']",
]

# Keywords that suggest a link points to a child/sibling dealership site
DEALERSHIP_LINK_KEYWORDS = [
    "chevrolet", "chevy", "ford", "toyota", "honda", "nissan", "chrysler",
    "dodge", "jeep", "ram", "hyundai", "kia", "subaru", "mazda", "bmw",
    "mercedes", "audi", "volkswagen", "vw", "cadillac", "buick", "gmc",
    "lexus", "acura", "infiniti", "volvo", "lincoln", "mitsubishi",
    "dealership", "dealer", "auto", "motors", "automotive", "cars",
    "location", "locations", "store", "stores", "visit us",
]

TITLE_SELECTORS = [
    "[class*='title']", "[class*='role']", "[class*='position']",
    "[class*='job']",   "[class*='designation']", "[class*='dept']",
]

# Patterns that only appear on actual bot-block pages, not normal site content
BOT_SIGNALS = [
    "cf-browser-verification",       # Cloudflare JS challenge form
    "cf_clearance",                   # Cloudflare clearance cookie page
    "checking your browser",          # Cloudflare challenge text
    "enable javascript and cookies",  # Cloudflare / DataDome block
    "automated access to this",       # Generic anti-bot message
    "access to this page has been denied",
    "ray id",                         # Cloudflare error page footer
]

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}")

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _delay(lo: float = 1.5, hi: float = 3.5) -> None:
    await asyncio.sleep(random.uniform(lo, hi))


def _score_link(href: str, text: str) -> int:
    score = 0
    h, t = href.lower(), text.lower()
    for kw in HREF_KEYWORDS:
        if kw in h:
            score += 2
    for kw in TEXT_KEYWORDS:
        if kw in t:
            score += 3
    return score


def _same_domain(url: str, base: str) -> bool:
    return urlparse(url).netloc == urlparse(base).netloc


# ── Phase 1: Find team page ───────────────────────────────────────────────────

async def _wait_for_real_content(page: Page) -> None:
    """Wait for Cloudflare JS challenges to resolve before reading content."""
    for _ in range(6):
        html = await page.content()
        if not any(sig in html.lower() for sig in BOT_SIGNALS):
            return
        await asyncio.sleep(3)


async def find_team_page(page: Page, base_url: str) -> Tuple[Optional[str], Optional[str], list]:
    """
    Load the homepage and return the best-matching team/about page URL.
    Returns (url, error_message) — one will always be None.
    """
    _RETRY_DELAYS = [10, 25]  # seconds to wait before attempt 2 and 3
    last_error = ""
    homepage_ok = False
    for attempt in range(3):
        if attempt > 0:
            wait = _RETRY_DELAYS[attempt - 1]
            print(f"         429 on {base_url} — retrying in {wait}s (attempt {attempt + 1}/3)...")
            await asyncio.sleep(wait)
        try:
            resp = await page.goto(base_url, wait_until="domcontentloaded", timeout=30_000)
            if resp and resp.status == 429:
                last_error = f"Rate limited (429) on homepage"
                continue  # retry
            if resp and resp.status >= 400:
                # 403/404 etc — don't retry, but still try path probing below
                last_error = f"HTTP {resp.status} on homepage"
                break
            await _wait_for_real_content(page)
            await _delay()
            homepage_ok = True
            break  # success — exit retry loop
        except Exception as e:
            return None, f"Homepage load failed: {e}", []
    # If all 3 attempts returned 429, last_error is set; fall through to path probing

    scored: list[tuple[int, str]] = []
    child_domains: set[str] = set()

    if homepage_ok:
        soup = BeautifulSoup(await page.content(), "lxml")

        for a in soup.find_all("a", href=True):
            href: str = a["href"].strip()
            text: str = a.get_text(strip=True)

            if href.startswith("/"):
                href = urljoin(base_url, href)
            elif not href.startswith("http"):
                continue

            if _same_domain(href, base_url):
                s = _score_link(href, text)
                if s > 0:
                    scored.append((s, href))
            else:
                # Always collect external links that look like child dealership sites
                domain = urlparse(href).netloc
                if not any(skip in domain for skip in ("facebook", "twitter", "instagram",
                                                        "youtube", "linkedin", "google",
                                                        "yelp", "maps", "apple")):
                    href_lower = href.lower()
                    t_lower = text.lower()
                    if any(kw in href_lower or kw in t_lower for kw in DEALERSHIP_LINK_KEYWORDS):
                        child_domains.add(domain)

    # Build child URL list from every detected child dealership domain
    child_urls = [f"https://{d}/" for d in child_domains]

    if scored:
        scored.sort(reverse=True)
        return scored[0][1], None, child_urls

    # ── Fallback: probe common paths directly ─────────────────────────────────
    # Even if the homepage was blocked (403/429), specific paths often bypass CDN protection.
    # /dealership/staff.htm is the standard path for Dealer.com (DDC) platform sites
    # (Lithia Motors group and many other large dealer groups use DDC).
    base = base_url.rstrip("/")
    path_candidates = [
        "/dealership/staff.htm",           # Dealer.com (DDC) — Lithia, AutoNation, etc.
        "/dealership/staff/",
        "/meet-the-team", "/meet-our-team",
        "/meet-the-staff", "/meet-our-staff",
        "/our-team", "/our-staff",
        "/about-us/meet-the-team", "/about-us/meet-our-team",
        "/about-us/staff", "/about-us/team",
        "/about/team", "/about/staff",
        "/staff", "/team", "/people",
        "/about-us", "/about",
        "/leadership", "/who-we-are",
    ]

    # If homepage was rate-limited, give Akamai/CDN a moment to reset before probing paths
    if "429" in last_error:
        print(f"         Homepage rate-limited — waiting 15s before path probing...")
        await asyncio.sleep(15)

    for path in path_candidates:
        url = base + path
        try:
            await asyncio.sleep(0.8)  # small pause to avoid triggering rate limits on rapid probing
            resp = await page.goto(url, wait_until="domcontentloaded", timeout=15_000)
            if resp and resp.status == 429:
                print(f"         429 on {path} — waiting 20s...")
                await asyncio.sleep(20)
                continue
            if resp and resp.status == 200:
                html = await page.content()
                text_len = len(BeautifulSoup(html, "lxml").get_text(strip=True))
                if text_len > 500:
                    return url, None, child_urls
        except Exception:
            continue

    return None, last_error or "No team/about page found (homepage scan + path fallback both failed)", child_urls


async def find_child_dealership_urls(page: Page, base_url: str) -> list[str]:
    """
    Scan the homepage for external links that look like child/sibling dealership sites.
    Returns a deduplicated list of candidate URLs (different domains from base_url).
    """
    try:
        await page.goto(base_url, wait_until="domcontentloaded", timeout=30_000)
        await _wait_for_real_content(page)
        await _delay()
    except Exception:
        return []

    soup = BeautifulSoup(await page.content(), "lxml")
    base_domain = urlparse(base_url).netloc
    seen: set[str] = set()
    candidates: list[str] = []

    for a in soup.find_all("a", href=True):
        href: str = a["href"].strip()
        text: str = a.get_text(strip=True).lower()

        if not href.startswith("http"):
            continue

        domain = urlparse(href).netloc
        if domain == base_domain or domain in seen:
            continue

        # Skip obvious non-dealership external links
        if any(skip in domain for skip in ("facebook", "twitter", "instagram", "youtube",
                                            "linkedin", "google", "yelp", "maps", "apple")):
            continue

        href_lower = href.lower()
        if any(kw in href_lower or kw in text for kw in DEALERSHIP_LINK_KEYWORDS):
            seen.add(domain)
            candidates.append(href.rstrip("/") + "/")

    return candidates


# ── Phase 2: Extract people ───────────────────────────────────────────────────

_DATE_RE = re.compile(
    r"^\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}[/\-]\d{1,2})",
    re.IGNORECASE,
)


def _is_name_like(text: str) -> bool:
    """True if text looks like a person's name rather than a date or long sentence."""
    if not text or len(text) > 60:
        return False
    if _DATE_RE.match(text):
        return False
    if any(ch.isdigit() for ch in text):
        return False
    word_count = len(text.split())
    return 1 <= word_count <= 5


def _card_score(containers: list[Tag]) -> float:
    """
    Score a container set for how well it represents individual person cards.
    - Rewards containers whose first heading is name-like
    - Also rewards containers that have a title-class element (name may be plain text)
    - Penalises containers that have many headings each (list wrappers, not cards)
    """
    sample = containers[:20]
    if not sample:
        return 0.0

    name_hits = 0
    title_hits = 0
    total_headings = 0
    for c in sample:
        headings = c.find_all(["h1", "h2", "h3", "h4", "h5", "strong"])
        total_headings += len(headings)
        first = headings[0].get_text(strip=True) if headings else ""
        if _is_name_like(first):
            name_hits += 1
        # Also score containers that have a role/title element (plain-text name pattern)
        for sel in TITLE_SELECTORS:
            if c.select_one(sel):
                title_hits += 1
                break

    name_ratio = name_hits / len(sample)
    title_ratio = title_hits / len(sample)
    combined_ratio = max(name_ratio, title_ratio * 0.8)  # heading preferred; title-only discounted
    avg_headings = total_headings / len(sample)
    return combined_ratio / (1 + max(0, avg_headings - 1))


def _deduplicate_to_outermost(containers: list[Tag]) -> list[Tag]:
    """Keep only outermost containers when some are ancestors of others."""
    result = []
    for c in containers:
        if not any(other is not c and other in c.parents for other in containers):
            result.append(c)
    return result


def _find_containers(soup: BeautifulSoup) -> list[Tag]:
    """
    Find repeating person-card elements using CSS class heuristics.
    Scores each candidate set by name-likeness of headings and heading density
    to avoid matching review sections or list-wrapper containers.
    """
    candidates: list[tuple[float, int, list[Tag]]] = []

    for sel in CARD_SELECTORS:
        containers = soup.select(sel)
        if len(containers) >= 2:
            # Deduplicate to outermost before scoring — prevents inner sub-elements
            # (e.g. staff-bio divs inside staff-item LIs) from winning over the real card
            containers = _deduplicate_to_outermost(containers)
            if len(containers) < 2:
                continue
            score = _card_score(containers)
            if score > 0:
                candidates.append((score, len(containers), containers))

    if candidates:
        # Best score first; break ties by fewest containers (more specific)
        candidates.sort(key=lambda x: (-x[0], x[1]))
        return candidates[0][2]

    # Fallback: semantic elements
    for tag in ("article", "li"):
        containers = soup.find_all(tag)
        if len(containers) >= 2:
            containers = _deduplicate_to_outermost(containers)
            score = _card_score(containers)
            if score > 0.5:
                return containers

    return []


_NAME_JUNK_RE = re.compile(
    r"^(x|close|phone[:\s]*|email[:\s]*|\d[\d\s\-().+]{6,}|view\s+bio|select(ed)?|reviews?)$",
    re.IGNORECASE,
)


def _get_name(container: Tag) -> Optional[str]:
    # Primary: look for a heading element
    for tag in ("h1", "h2", "h3", "h4", "h5", "strong"):
        el = container.find(tag)
        if el:
            text = el.get_text(strip=True)
            if text:
                return text

    # Fallback: scan direct text nodes for something that looks like a person name
    # (used when name is plain text, e.g. <div class="employee_wrap_staff">)
    title_text = ""
    for sel in TITLE_SELECTORS:
        el = container.select_one(sel)
        if el:
            title_text = el.get_text(strip=True).lower()
            break

    for chunk in container.get_text(separator="\n").split("\n"):
        chunk = chunk.strip()
        if not chunk or _NAME_JUNK_RE.match(chunk):
            continue
        if chunk.lower() == title_text:
            continue
        if EMAIL_RE.search(chunk) or PHONE_RE.search(chunk):
            continue
        words = chunk.split()
        if 2 <= len(words) <= 5 and all(not w.isdigit() for w in words):
            return chunk

    return None


def _get_title(container: Tag, name: str) -> Optional[str]:
    # Try role-specific class names first
    for sel in TITLE_SELECTORS:
        el = container.select_one(sel)
        if el:
            text = el.get_text(strip=True)
            if text and text != name and len(text) < 120:
                return text

    # Check sub-heading tags immediately after the name heading (DealerInspire pattern: h3=name, h4=title)
    name_heading = None
    for tag in ("h1", "h2", "h3", "h4", "h5"):
        el = container.find(tag)
        if el and el.get_text(strip=True) == name:
            name_heading = el
            break
    if name_heading:
        for sibling in name_heading.find_next_siblings(["h4", "h5", "p", "span", "div"]):
            text = sibling.get_text(strip=True)
            if text and text != name and 2 < len(text) < 100 and text.count(" ") < 8:
                return text

    # Fallback: first short text block that isn't the name
    for tag in ("h4", "h5", "p", "span", "div"):
        for el in container.find_all(tag):
            text = el.get_text(strip=True)
            if (
                text
                and text != name
                and 2 < len(text) < 100
                and text.count(" ") < 8  # exclude bio paragraphs
            ):
                return text

    return None


def _matches_role(title: str, roles: list[str]) -> bool:
    t = title.lower()
    return any(role.lower() in t for role in roles)


def extract_people(html: str, roles: list[str]) -> list[dict]:
    """Parse team page HTML and return people matching the given roles."""
    soup = BeautifulSoup(html, "lxml")
    containers = _find_containers(soup)

    people: list[dict] = []
    seen: set[str] = set()

    for container in containers:
        full_text = container.get_text(separator=" ", strip=True)

        name = _get_name(container)
        if not name or name.lower() in seen:
            continue

        title = _get_title(container, name)
        if not title or not _matches_role(title, roles):
            continue

        seen.add(name.lower())  # case-insensitive dedup

        # Strip the name from the title if it got concatenated (e.g. "John SmithService Manager")
        if title.startswith(name):
            title = title[len(name):].strip()
        if not title or not _matches_role(title, roles):
            continue

        # Normalise name casing: "DAN SMITH" or "dan smith" → "Dan Smith"
        name = " ".join(w.capitalize() for w in name.split())

        email_m = EMAIL_RE.search(full_text)
        phone_m = PHONE_RE.search(full_text)

        # Also check mailto: hrefs (many dealership sites put email only in href, not text)
        email = email_m.group(0) if email_m else None
        if not email:
            for a in container.find_all("a", href=True):
                href = a["href"]
                if href.startswith("mailto:"):
                    candidate = href[7:].split("?")[0].strip()
                    if EMAIL_RE.match(candidate):
                        email = candidate
                        break

        people.append({
            "name": name,
            "title": title,
            "email": email,
            "phone": phone_m.group(0) if phone_m else None,
        })

    return people


# ── Scrape one site ───────────────────────────────────────────────────────────

async def _scrape_team_page(page: Page, team_url: str, roles: list[str], source_site: str) -> dict:
    """Load a team page URL and extract matching people. Returns a partial result dict."""
    out: dict = {"team_page_found": team_url, "people": [], "blocked": False, "error": None,
                 "source_site": source_site}
    _RETRY_DELAYS = [10, 25]
    for attempt in range(3):
        if attempt > 0:
            wait = _RETRY_DELAYS[attempt - 1]
            print(f"         429 on team page — retrying in {wait}s (attempt {attempt + 1}/3)...")
            await asyncio.sleep(wait)
        try:
            resp = await page.goto(team_url, wait_until="domcontentloaded", timeout=30_000)
            if resp and resp.status == 429:
                if attempt < 2:
                    continue
                out["error"] = "Rate limited (429) — failed after 3 attempts"
                return out
            await _wait_for_real_content(page)
            break  # success
        except Exception as e:
            out["error"] = f"Team page load failed: {e}"
            return out

    # Wait for JS-driven AJAX content to render.
    # Many dealership platforms fire the staff-data request via setTimeout AFTER networkidle,
    # so we need a minimum wait before polling for stability.
    await asyncio.sleep(5)                   # clear the false-idle window
    prev_size = 0
    html = ""
    for _ in range(8):                       # poll up to 8 × 1.5s = 12s more
        html = await page.content()
        if len(html) == prev_size and prev_size > 0:
            break
        prev_size = len(html)
        await asyncio.sleep(1.5)

    html_lower = html.lower()

    is_short = len(html) < 15_000
    has_block_signal = any(sig in html_lower for sig in BOT_SIGNALS)
    if is_short and has_block_signal:
        out["blocked"] = True
        out["error"] = "Bot protection detected"
        return out

    out["people"] = extract_people(html, roles)
    return out


async def _fresh_page(ctx) -> Page:
    """Create a new stealth page in the given browser context."""
    p = await ctx.new_page()
    await Stealth().apply_stealth_async(p)
    return p


async def scrape_site(page: Page, url: str, roles: list[str]) -> dict:
    result = {
        "website": url,
        "team_page_found": None,
        "people": [],
        "blocked": False,
        "error": None,
        "child_sites_checked": [],
    }

    team_url, err, child_urls = await find_team_page(page, url)

    if team_url:
        partial = await _scrape_team_page(page, team_url, roles, url)
        result["team_page_found"] = partial["team_page_found"]
        result["people"] = partial["people"]
        result["blocked"] = partial["blocked"]
        result["error"] = partial["error"]

    # If primary site yielded no people, check any child dealership sites found
    if not result["people"] and child_urls:
        print(f"         -> 0 matches on primary. Checking {len(child_urls)} child site(s)...")
        for child_url in child_urls:
            result["child_sites_checked"].append(child_url)

            browser = page.context.browser

            # Phase A: discover team URL using one isolated context
            discover_ctx = await browser.new_context(user_agent=USER_AGENT)
            child_team_url = None
            try:
                dp = await discover_ctx.new_page()
                await Stealth().apply_stealth_async(dp)
                child_team_url, _, _ = await find_team_page(dp, child_url)
                await dp.close()
            finally:
                await discover_ctx.close()

            if not child_team_url:
                await _delay(1, 2)
                continue

            # Phase B: scrape team page using a completely separate, pristine context
            # No stealth and no prior navigation — prevents cookie/JS interference
            scrape_ctx = await browser.new_context(user_agent=USER_AGENT)
            try:
                sp = await scrape_ctx.new_page()
                partial = await _scrape_team_page(sp, child_team_url, roles, child_url)
                await sp.close()
                if partial["people"]:
                    if not result["team_page_found"]:
                        result["team_page_found"] = partial["team_page_found"]
                    # Deduplicate across child sites by name (case-insensitive)
                    existing_names = {p["name"].lower() for p in result["people"]}
                    new_people = [p for p in partial["people"] if p["name"].lower() not in existing_names]
                    result["people"].extend(new_people)
                    if new_people:
                        result["error"] = None
                if partial["blocked"]:
                    result["blocked"] = True
            finally:
                await scrape_ctx.close()
            await _delay(1, 2)

    if not result["people"] and not result["team_page_found"]:
        result["error"] = err or "No team page found"

    return result


# ── Public API ────────────────────────────────────────────────────────────────

async def run_scraper(
    urls: list[str],
    roles: list[str],
    headless: bool = True,
    delay_between: tuple[float, float] = (2.0, 5.0),
    on_progress: Optional[Callable[[int, int, dict], None]] = None,
) -> list[dict]:
    """
    Scrape multiple websites and return extracted staff data.

    Args:
        urls: List of homepage URLs to scrape.
        roles: List of role strings to filter by (case-insensitive, partial match).
        headless: Run browser headlessly (True by default).
        delay_between: (min_sec, max_sec) random delay between sites.
        on_progress: Optional callback(current, total, result) called after each site.

    Returns:
        List of result dicts, one per URL. Each dict has:
            website, team_page_found, people, blocked, error
    """
    results: list[dict] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless, channel="chrome")
        ctx = await browser.new_context(user_agent=USER_AGENT)
        page = await ctx.new_page()
        await Stealth().apply_stealth_async(page)

        for i, url in enumerate(urls):
            result = await scrape_site(page, url, roles)
            results.append(result)

            if on_progress:
                on_progress(i + 1, len(urls), result)

            if i < len(urls) - 1:
                await asyncio.sleep(random.uniform(*delay_between))

        await browser.close()

    return results


# ── CLI ───────────────────────────────────────────────────────────────────────

def _print_progress(i: int, total: int, result: dict) -> None:
    status = "BLOCKED" if result["blocked"] else f"{len(result['people'])} match(es)"
    print(f"[{i}/{total}] {result['website']}")
    print(f"         team page : {result['team_page_found'] or 'not found'}")
    print(f"         status    : {status}")
    if result["error"] and not result["blocked"]:
        print(f"         error     : {result['error']}")
    print()


async def _cli(args) -> None:
    with open(args.input) as f:
        data = json.load(f)

    if isinstance(data, list):
        urls, roles = data, []
    else:
        urls = data.get("urls", [])
        roles = data.get("roles", [])

    if args.roles:
        roles = [r.strip() for r in args.roles.split(",")]

    if not urls:
        print("ERROR: No URLs found in input file.")
        sys.exit(1)
    if not roles:
        print("ERROR: No roles specified. Add 'roles' to the JSON or use --roles.")
        sys.exit(1)

    print(f"Scraping {len(urls)} site(s)")
    print(f"Roles   : {', '.join(roles)}\n")

    results = await run_scraper(
        urls=urls,
        roles=roles,
        headless=not args.visible,
        on_progress=_print_progress,
    )

    output_path = Path(args.output)
    output_path.write_text(json.dumps(results, indent=2))

    total_people = sum(len(r["people"]) for r in results)
    blocked = sum(1 for r in results if r["blocked"])
    errors = sum(1 for r in results if r["error"] and not r["blocked"])

    print(f"{'─' * 50}")
    print(f"Sites scraped : {len(urls)}")
    print(f"People found  : {total_people}")
    print(f"Blocked       : {blocked}")
    print(f"Errors        : {errors}")
    print(f"Output        : {output_path.resolve()}")


def main():
    parser = argparse.ArgumentParser(
        description="Scrape dealership team pages for staff by role"
    )
    parser.add_argument("--input",   required=True, help="Input JSON file (URLs + roles)")
    parser.add_argument("--roles",   help="Comma-separated roles — overrides JSON roles")
    parser.add_argument("--output",  default="results.json", help="Output JSON file (default: results.json)")
    parser.add_argument("--visible", action="store_true", help="Show the browser window")
    asyncio.run(_cli(parser.parse_args()))


if __name__ == "__main__":
    main()
