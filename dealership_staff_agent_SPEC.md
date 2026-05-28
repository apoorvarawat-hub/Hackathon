# SPEC.md — Dealership Staff Intelligence Agent

_Last Updated: 2026-05-28 07:05 UTC_

## 1. Overview

Build an AI-powered crawler/agent capable of discovering dealership websites, navigating staff/team pages, extracting dealership employee information for target leadership roles, and normalizing the data into a structured format.

## Inputs

### Option A — Website URL
```json
{
  "website": "https://www.exampledealer.com"
}
```

### Option B — Dealership Identity
```json
{
  "dealership_name": "ABC Toyota",
  "address": "123 Main St, Dallas, TX"
}
```

## Target Roles

- Service Manager
- General Manager
- Service Director
- Fixed Operations Director
- Controller
- Dealer Principal
- Parts Manager

## Required Fields

| Field | Description |
|---|---|
| Full Name | Employee full name |
| Title | Exact title found |
| Email | Business email |
| Phone Number | Direct or dealership phone |
| Department | Service / Parts / Executive / Accounting |
| Source URL | Exact page URL |

## Output Example

```json
[
  {
    "full_name": "Jane Smith",
    "title": "Service Director",
    "normalized_role": "Service Director",
    "email": "jsmith@exampledealer.com",
    "phone_number": "(555) 123-4567",
    "department": "Service",
    "source_url": "https://dealer.com/service-team",
    "confidence": 0.94
  }
]
```

## Functional Requirements

### Discovery Workflow
1. Accept dealership website OR dealership name/address
2. Discover official website if needed
3. Crawl staff/team/contact pages
4. Extract and normalize staff data
5. Export JSON or CSV

### Crawl Targets
- /staff
- /about-us
- /meet-the-team
- /service
- /parts
- /management
- /contact-us
- sitemap.xml

## AI Requirements

### Role Classification
- Exact role matching
- Fuzzy title matching
- Title normalization

Examples:
- “Fixed Ops Director” → “Fixed Operations Director”
- “GM” → “General Manager”

### Confidence Scoring
Each extracted record should include a confidence score.

## Suggested Stack

### Backend
- Python
- FastAPI

### Crawling
- Playwright
- Scrapy
- BeautifulSoup

### AI/NLP
- OpenAI API
- spaCy

## Compliance Constraints

The system MUST:
- respect robots.txt where applicable
- avoid bypassing authentication
- avoid scraping private data
- limit request rates
- store only public business information

The system MUST NOT:
- scrape protected systems
- collect sensitive personal data
- bypass anti-bot protections illegally

## MVP Deliverables
- crawler service
- extraction engine
- role normalization
- JSON/CSV export
- API endpoints
- deployment instructions
