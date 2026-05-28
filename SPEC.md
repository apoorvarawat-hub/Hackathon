# Autonomous Salesforce Contact Discovery Agent
## Final Hackathon Specification (v2)

---

# 1. Executive Summary

The Autonomous Salesforce Contact Discovery Agent is a human-in-the-loop AI enrichment platform designed to automate dealership personnel discovery while preserving CRM trust and data quality.

The system reduces manual dealership research by:
- Discovering dealership staff from public websites
- Extracting and validating contact information
- Presenting results in a review workflow
- Updating Salesforce only after human approval

This specification follows the Value & Viable framework outlined in the uploaded skill document. fileciteturn0file0

---

# 2. Problem Statement

Sales representatives and account managers currently spend significant time manually researching dealership personnel and updating Salesforce Contacts.

Current workflow:
1. Open Salesforce Account
2. Visit dealership website
3. Search for staff pages
4. Identify decision-makers
5. Validate contact information
6. Create/update Salesforce Contacts manually

This creates:
- High manual effort
- Inconsistent CRM quality
- Duplicate contacts
- Outdated records
- Slow prospecting workflows

Additionally, direct automated CRM mutation introduces:
- Incorrect updates
- Invalid emails/phones
- Duplicate creation
- Low user trust
- Governance concerns

---

# 3. Root Cause Analysis

## 5 Whys

### Problem
Sales users spend excessive time maintaining dealership contacts.

### Why 1
Dealership personnel information exists on external websites.

### Why 2
Salesforce does not automatically synchronize dealership staff data.

### Why 3
Current workflows rely on manual research and manual CRM updates.

### Why 4
Fully automated enrichment introduces trust and data quality risks.

### Why 5
Scraped web data can be incomplete, stale, duplicated, or invalid.

## Root Cause

The core problem is the absence of a trusted and reviewable workflow that converts unstructured dealership website data into validated Salesforce contact updates.

---

# 4. User Need Alignment

## User Need

Sales users need a fast and trustworthy way to discover and validate dealership personnel information so that Salesforce remains accurate without requiring extensive manual research.

## Job To Be Done (JTBD)

When managing dealership accounts, I want the system to automatically gather potential dealership contacts and allow me to review and approve updates before Salesforce is modified, so I can save time while maintaining confidence in CRM accuracy.

---

# 5. Solution Exploration

## Approach A — Fully Automated Updates

### Description
The agent scrapes websites and directly updates Salesforce Contacts automatically.

### Advantages
- Fastest automation
- Minimal user interaction

### Drawbacks
- High risk of bad data
- Duplicate creation
- Low trust
- Governance concerns

---

## Approach B — Human-in-the-Loop Review GUI (Selected)

### Description
The agent scrapes dealership websites and presents discovered contacts in a review interface before Salesforce updates are committed.

### Advantages
- Human validation before CRM mutation
- Higher trust
- Better data quality
- Easier operational governance
- Safer production rollout

### Drawbacks
- Slightly slower than full automation
- Requires GUI implementation

### Why Selected
This approach balances automation speed with CRM trust, governance, usability, and operational safety.

---

## Approach C — CSV Export Workflow

### Description
Export discovered contacts into CSV for manual Salesforce import.

### Advantages
- Simple implementation
- Low operational risk

### Drawbacks
- Poor UX
- Still manual
- No integrated workflow

---

# 6. Selected Solution Architecture

## High-Level Workflow

```text
User Selects Salesforce Account
            ↓
Agent Retrieves Website
            ↓
Agent Crawls Website
            ↓
Agent Extracts Staff Information
            ↓
Validation Layer
(Email + Phone Validation)
            ↓
Review GUI
(User Approves/Rejects/Edits)
            ↓
Salesforce Create/Update
```

---

# 7. Milestones

## Milestone 1 — User Selects Salesforce Account

### Objective
Allow users to search and select Salesforce Accounts before enrichment begins.

### Functional Requirements
- Search Accounts by:
  - Account Name
  - Dealer Code
  - Region
- Display selected account details
- Auto-fetch associated website

### Inputs
- Salesforce Account data

### Outputs
- Selected account context
- Website URL

### Success Criteria
- Account selection completed in under 10 seconds
- Website auto-populates successfully

---

## Milestone 2 — Agent Retrieves Website

### Objective
Retrieve dealership website associated with the selected Salesforce Account.

### Functional Requirements
- Pull website from Salesforce Account
- Validate URL structure
- Handle missing URLs gracefully

### Outputs
- Website URL ready for crawling

### Failure Handling
- Invalid URL warning
- Missing website fallback state

---

## Milestone 3 — Agent Crawls Website

### Objective
Discover dealership staff-related pages.

### Target Pages
- /staff
- /team
- /service
- /about-us
- /meet-our-staff
- /departments
- /contact-us

### Functional Requirements
- Crawl dealership website
- Discover internal pages
- Prioritize staff-related pages
- Respect crawl limits

### Outputs
- Crawl results
- Indexed staff pages

### Success Criteria
- Crawl completes within 60 seconds
- At least one staff page identified

---

## Milestone 4 — Agent Extracts Staff Information

### Objective
Extract dealership personnel details from crawled pages.

### Extracted Fields
- Full Name
- Title
- Email
- Phone Number
- Department
- Source URL

### Functional Requirements
- Parse HTML content
- Identify personnel cards/sections
- Normalize extracted fields
- Store extraction metadata

### Role Classification
Target roles include:
- Service Manager
- General Manager
- Service Director
- Fixed Operations Director
- Controller
- Dealer Principal
- Parts Manager

### Classification Methods
- Keyword matching
- LLM-assisted normalization
- Confidence scoring

### Outputs
- Candidate contacts

---

## Milestone 5 — Validation Layer (Email + Phone Validation)

### Objective
Validate extracted contact data before user review.

## Email Validation Rules
- RFC-compliant format
- Valid domain structure
- Reject disposable domains
- Reject malformed addresses

### Email Outcomes
- VALID
- INVALID
- SUSPICIOUS

## Phone Validation Rules
- Country-aware formatting
- Numeric validation
- Duplicate removal
- Standardized formatting

### Example
```text
(555) 555-5555
→ +1-555-555-5555
```

## Confidence Scoring Inputs
- Role confidence
- Email validity
- Phone validity
- Full name presence
- Source page quality
- Duplicate likelihood

## Thresholds
| Score | Meaning |
|---|---|
| 0.90+ | High Confidence |
| 0.75+ | Review Recommended |
| Below 0.75 | Flagged |

### Outputs
- Validated contacts
- Confidence scores
- Validation statuses

---

## Milestone 6 — Review GUI (User Approves/Rejects/Edits)

### Objective
Provide a trusted review workflow before Salesforce mutation.

## Primary Screens

### Account Selection Screen
- Search Accounts
- Select Account
- Start Discovery

### Discovery Progress Screen
- Crawl status
- Pages scanned
- Contacts discovered

### Review Queue Screen
- Editable contact grid
- Validation warnings
- Approval actions

### Salesforce Sync Results
- Contacts created
- Contacts updated
- Failed records

## Review Dashboard Features

### Account Context
- Account Name
- Website
- Dealer metadata

### Contact Grid Columns
- Name
- Role
- Email
- Phone
- Confidence Score
- Validation Status
- Action Type

### User Actions
- Approve
- Reject
- Edit
- Bulk Approve
- Bulk Reject

### Outputs
- Approved contacts
- Rejected contacts
- Edited records

---

## Milestone 7 — Salesforce Create/Update

### Objective
Update Salesforce only after explicit user approval.

## Supported Operations
- Create Contact
- Update Existing Contact
- Skip Duplicate
- Flag Ambiguous Match

## Duplicate Detection Rules
- Match by Email
- Match by Name + Account
- Match by Phone + Account

## Salesforce Mutation Policy
- No automatic updates
- User approval required
- Only validated contacts processed

### Outputs
- Salesforce sync results
- Audit trail
- Error logs

---

# 8. Validation & Governance

## No Automatic CRM Mutation

Salesforce updates must never occur before user review and approval.

## Only Approved Contacts Updated

Only contacts explicitly approved by the user may be synchronized.

## Only Valid Contacts Updated

All synchronized contacts must pass:
- Email validation
- Phone validation

---

# 9. Temporal Logic of Actions (TLA+)

## System Variables

```tla
VARIABLES
  accounts,
  selectedAccount,
  website,
  pages,
  scrapedPeople,
  candidateContacts,
  validatedContacts,
  reviewedContacts,
  approvedContacts,
  salesforceContacts,
  errors,
  status
```

## Initial State

```tla
Init ==
  /\ selectedAccount = NULL
  /\ website = NULL
  /\ pages = {}
  /\ scrapedPeople = {}
  /\ candidateContacts = {}
  /\ validatedContacts = {}
  /\ reviewedContacts = {}
  /\ approvedContacts = {}
  /\ status = "Idle"
```

---

# 10. TLA+ Actions

## Select Account

```tla
SelectAccount ==
  /\ status = "Idle"
  /\ selectedAccount' \in accounts
  /\ website' = selectedAccount'.Website
  /\ status' = "AccountSelected"
```

## Scrape Website

```tla
ScrapeWebsite ==
  /\ status = "AccountSelected"
  /\ pages' = Crawl(website)
  /\ status' = "WebsiteScraped"
```

## Extract Contacts

```tla
ExtractCandidates ==
  /\ status = "WebsiteScraped"
  /\ candidateContacts' = ExtractPeople(pages)
  /\ status' = "CandidatesExtracted"
```

## Validate Contacts

```tla
ValidateContacts ==
  /\ status = "CandidatesExtracted"
  /\ validatedContacts' =
      {c \in candidateContacts :
          ValidEmail(c.email)
          /\ ValidPhone(c.phone)}
  /\ status' = "Validated"
```

## Review Contacts

```tla
ReviewContacts ==
  /\ status = "Validated"
  /\ reviewedContacts' = UserReviewed(validatedContacts)
  /\ approvedContacts' =
      {c \in reviewedContacts' :
          c.approved = TRUE}
  /\ status' = "Reviewed"
```

## Update Salesforce

```tla
UpdateSalesforce ==
  /\ status = "Reviewed"
  /\ salesforceContacts' =
      UpsertContacts(
          salesforceContacts,
          approvedContacts)
  /\ status' = "SalesforceUpdated"
```

---

# 11. Safety Properties

## No Automatic Updates

```tla
NoAutomaticUpdates ==
  [](status # "Reviewed" =>
      UNCHANGED salesforceContacts)
```

## Only Approved Contacts

```tla
OnlyApprovedContacts ==
  \A c \in salesforceContacts :
      c.approved = TRUE
```

## Only Valid Contacts

```tla
OnlyValidatedContacts ==
  \A c \in salesforceContacts :
      ValidEmail(c.email)
      /\ ValidPhone(c.phone)
```

---

# 12. Technology Stack Recommendations

## Frontend
- Vanilla JS
- HTML
- Vanilla CSS

## Backend
- Python Flask
- Queue-based crawling workers

## AI / NLP
- OpenAI API
- Role normalization models

## Web Crawling
- Playwright
- BeautifulSoup
- Scrapy

## Validation
- Email validation libraries
- libphonenumber

## Salesforce Integration
- Salesforce REST API
- OAuth 2.0

---

# 13. Operational Considerations

## Scalability
- Async crawling workers
- Queue-based processing
- Retry mechanisms

## Failure Handling
- Crawl timeouts
- Partial extraction fallback
- Salesforce API retry logic

## Security
- OAuth-secured Salesforce access
- Audit logging
- Role-based approvals

## Governance
- Human approval required
- Validation logs retained
- Duplicate prevention rules

---

# 14. Success Metrics

| Metric | Target | Kill Threshold | Tracking | Review |
|---|---|---|---|---|
| Contact discovery accuracy | >85% | <50% | Validation logs | 30 days |
| User approval rate | >70% | <30% | GUI analytics | 30 days |
| Reduction in manual effort | 50% reduction | <10% | User survey | 60 days |
| Duplicate prevention | >95% | <70% | CRM audit logs | 30 days |

---

# 15. Kill Criteria

If:
- Users reject most scraped contacts
- Validation quality remains poor
- Review takes longer than manual research
- Duplicate creation remains high

Then:
- Re-evaluate extraction logic
- Simplify role targeting
- Pivot toward recommendation-only workflows

---

# 16. Demo Scenario

## End-to-End Demo Flow

1. User opens GUI
2. Searches and selects dealership account
3. Agent retrieves website
4. Agent crawls dealership website
5. Contacts are extracted and validated
6. Review dashboard displays discovered contacts
7. User approves updates
8. Salesforce Contacts are created/updated
9. Sync results dashboard confirms completion

---

# 17. Final Conclusion

The Autonomous Salesforce Contact Discovery Agent provides a scalable and trustworthy CRM enrichment workflow optimized for real-world sales operations.

The solution balances:
- Automation
- Human trust
- Data quality
- Governance
- Operational safety
- User adoption

By introducing a human-in-the-loop review workflow, the platform avoids the risks associated with direct autonomous CRM mutation while significantly reducing manual dealership research effort.

This creates a practical foundation for AI-assisted Salesforce enrichment at scale.
