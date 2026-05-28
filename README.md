# Autonomous Salesforce Contact Discovery Agent

A human-in-the-loop AI enrichment platform that discovers dealership personnel from public websites and syncs validated contacts to Salesforce — built by myKaarma.

---

## What It Does

1. **Account Selection** — pulls Prospect accounts from Salesforce sandbox; filter by name, region, payment status
2. **Discovery** — Playwright-based scraper finds staff/team pages on each dealership website
3. **Extraction** — extracts names, titles, emails, and phone numbers; normalises roles against 7 target profiles
4. **Review** — human reviews each contact (approve / reject / edit) before anything touches Salesforce
5. **Sync** — approved contacts are created or updated in Salesforce with full dedup and audit trail

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS SPA (4-view workflow) |
| Backend | Python / Flask |
| Scraper | Playwright + BeautifulSoup (headless Chrome) |
| Salesforce | `simple-salesforce` (OAuth2 Connected App) |
| Auth | Google OAuth 2.0 via `authlib` |

---

## Prerequisites

- Python 3.9+
- Google Chrome installed (scraper uses `channel="chrome"`)
- A Salesforce sandbox with a Connected App configured
- A Google Cloud project with an OAuth 2.0 Web Client

---

## Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/apoorvarawat-hub/Hackathon.git
cd Hackathon
pip3 install -r requirements.txt
python3 -m playwright install chromium
```

### 2. Configure credentials

```bash
cp .env.example .env
```

Fill in `.env`:

```env
# Flask
FLASK_SECRET_KEY=replace-with-a-long-random-string

# Google OAuth  (console.cloud.google.com → APIs & Services → Credentials)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Salesforce sandbox
SF_USERNAME=your.name@company.com.sandbox
SF_PASSWORD=yourPassword
SF_SECURITY_TOKEN=yourSecurityToken
SF_CLIENT_ID=yourConnectedAppConsumerKey
SF_CLIENT_SECRET=yourConnectedAppConsumerSecret
```

> **Never commit `.env`** — it is in `.gitignore`.

### 3. Add authorised users

Edit `users.py` to map myKaarma Google emails to Salesforce usernames:

```python
USER_MAPPING = {
    'you@mykaarma.com': 'you@mykaarma.com.sandbox',
    'colleague@mykaarma.com': 'colleague@mykaarma.com.sandbox',
}
```

Only emails listed here can log in.

### 4. Configure Google OAuth redirect URI

In [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → your OAuth Client:

Add authorised redirect URI:
```
http://127.0.0.1:5001/auth/google/callback
```

### 5. Run

```bash
python3 app.py
```

Open [http://127.0.0.1:5001](http://127.0.0.1:5001) — you will be prompted to sign in with Google.

---

## Authentication Flow

```
User visits /
    → redirected to /login (if no session)
    → clicks "Sign in with Google"
    → Google OAuth callback
    → email checked against users.py
    → if authorised: session created, redirect to app
    → if not authorised: error shown on login page
```

---

## Salesforce Integration

- **Reads** `Account` records where `Account_Status__c = 'Prospect'` and `Website != null`
- **Writes** `Contact` records (create / update) after user approval
- **Updates** `Dawn_Status__c` on accounts that fail scraping
- Falls back to mock data if SF credentials are not configured

---

## Target Roles

The scraper filters for staff matching:

- General Manager
- Service Manager
- Service Director
- Fixed Operations Director
- Controller
- Dealer Principal
- Parts Manager

---

## Project Structure

```
app.py              Flask app + API endpoints
scraper.py          Playwright scraper engine
salesforce.py       Salesforce API helpers
users.py            User access control (Google → SF username mapping)
requirements.txt    Python dependencies
.env.example        Credential template
static/
  index.html        Main SPA shell
  app.js            SPA client logic
  theme.css         Design system
  login.html        Google login page
```
