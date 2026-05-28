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
# Feedback after working on Milestone 1
After completing the first milestone, the Account Selection experience must support richer filtering, clearer table columns, and multi-account selection.

### Salesforce Account Fields / API Names
Use the following Account object fields:

| UI Label | Salesforce Account API Name | Purpose |
|---|---|---|
| Account Name | `Name` | Search/filter by dealership account name |
| Territory Region | `Territory_Region__c` | Filter accounts by territory/region |
| Account Status | `Account_Status__c` | Filter accounts by account lifecycle/status |
| Payment Status | `Payments_Stage__c` | Filter accounts by payment status/stage |
| Website | `Website` | Display website and automatically filter to accounts with websites |
| Last Modified Date | `LastModifiedDate` | Show when the Account record was last modified |

> Dealer Code should not be shown in the Account Selection table.

### Functional Requirements
- Provide filters for:
  - Account Name using an operator-style text filter
  - Territory Region using `Territory_Region__c`
  - Account Status using `Account_Status__c`
  - Payment Status using `Payments_Stage__c`
- Automatically apply a default filter so only Accounts with a non-empty `Website` field are shown.
- Display selected account details.
- Auto-fetch the associated website from `Website`.
- Support selecting multiple Accounts from the result table.
- Add a checkbox next to each Account row.
- Add a "Select All" control for selecting all currently filtered Accounts.

### Account Results Table Columns
The Account Selection table must display:

| Column | Field / Source |
|---|---|
| Select | Row checkbox |
| Account Name | `Name` |
| Territory Region | `Territory_Region__c` |
| Account Status | `Account_Status__c` |
| Payment Status | `Payments_Stage__c` |
| Website | `Website` |
| Last Modified | `LastModifiedDate` |

The table must not display Dealer Code.

### Default Query Behavior
The initial Account query must include a website-only filter:

```sql
WHERE Website != null
```

Additional filters should be layered on top of this default condition.

### Example SOQL Shape
```sql
SELECT
  Id,
  Name,
  Territory_Region__c,
  Account_Status__c,
  Payments_Stage__c,
  Website,
  LastModifiedDate
FROM Account
WHERE Website != null
ORDER BY LastModifiedDate DESC
LIMIT 200
```

### Inputs
- Salesforce Account data

### Outputs
- Selected Account record(s)
- Website URL(s)
- Filtered Account result set

### Success Criteria
- User can filter Accounts by name, territory region, account status, payment status, and website availability.
- Accounts without websites are excluded by default.
- Account table shows last modified date and website.
- Dealer Code is not shown.
- User can select one Account, multiple Accounts, or all currently filtered Accounts.
- Website values are available for downstream discovery.
---

## Milestone 2 — Agent Retrieves Website

## Milestone 2 — Agent Retrieves Website

### Objective

Retrieve dealership website information associated with the selected Salesforce Account(s) and prepare valid websites for crawling.

### Functional Requirements

- User selects one or more Accounts and clicks the **Next** button to start the discovery workflow.
- The system retrieves the website value from the Salesforce Account field `Website`.
- The retrieved website URL is used as the input for the crawling process.
- Validate URL structure before sending the website for crawling.
- Handle missing or invalid website URLs gracefully.
- If no valid website is available, update the Salesforce Account field `Dawn_Status__c` with:
  ```text
  No website available - YYYY-MM-DD HH:mm:ss
  ```
* The timestamp should use the system-generated current date and time.

### Validation Rules

- Website must contain a valid URL structure.
- Website must include a supported protocol (`http://` or `https://`).
- Empty, malformed, or unsupported URLs should be excluded from crawling.

### Outputs

- Validated website URL(s) ready for crawling
- Updated `Dawn_Status__c` value for Accounts missing websites

### Failure Handling

- Invalid URL warning displayed in UI
- Missing website fallback state
- Accounts without valid websites are skipped from crawling
- Failure reason logged for audit and troubleshooting


---
# Feedback 2: After Milestone 2 Feedback 1 updates

## Observation
During Milestone 2 validation, the **Next** button currently does not trigger the expected discovery workflow behavior.

## Issue Identified
Clicking the **Next** button does not:
- Start the discovery workflow
- Process selected Account records
- Trigger website retrieval logic
- Provide any visible confirmation that the workflow has started

## Required Enhancements

### Next Button Workflow Trigger
The **Next** button must:
- Read all selected Salesforce Account records
- Validate that at least one Account has been selected
- Pass selected Account records into the website retrieval workflow
- Trigger the next stage of the discovery pipeline

If no Accounts are selected:
- Display a validation warning to the user
- Prevent progression to the next step

## Console Logging Requirement
For debugging and milestone verification purposes, the system should log the selected Account records to the browser console when the **Next** button is clicked.

Example:

```javascript
console.log("Selected Accounts:", selectedAccounts);
```

## Expected Debug Output
The console output should include:
- Account Id
- Account Name
- Website
- Account Status
- Territory Region

## Success Criteria
- Clicking **Next** successfully starts the workflow
- Selected Accounts are correctly passed to downstream processing
- Console logs confirm selected records are captured properly
- Validation prevents progression when no Accounts are selected
- Workflow behavior is visible and verifiable during testing

---
# Feedback After Milestone 2 — Account Selection and Start Discovery UX Fixes

## Observation
During Milestone 2 validation, selecting Account records does not fully update the discovery workflow UI as expected.

## Issues Identified
- Selecting one or more Account records does not enable the **Next** button.
- The **Next** button label is not specific enough for the discovery workflow.
- Selecting Account records does not update the Account Details panel on the right side of the screen.

## Required Enhancements

### Enable Discovery Button on Account Selection
When the user selects one or more Account records:
- The discovery action button must become enabled.
- The selected Account records must be stored in the UI state.
- The selected Account count should be available for validation and downstream processing.

If no Accounts are selected:
- The discovery action button must remain disabled.
- The user should not be able to start the discovery workflow.

### Rename Button
Rename the **Next** button to:

```text
Start Discovery
```

This label more clearly communicates that clicking the button begins the contact discovery workflow.

### Update Account Details Panel
When the user selects an Account record, the Account Details panel on the right side of the screen must update to show the selected Account details.

The Account Details panel should display:
- Account Name
- Website
- Territory Region
- Account Status
- Payment Status
- Last Modified Date

If multiple Accounts are selected:
- Display the primary/most recently selected Account details.
- Optionally show the total number of selected Accounts.

## Expected Behavior
- Selecting at least one Account enables the **Start Discovery** button.
- Deselecting all Accounts disables the **Start Discovery** button.
- The right-side Account Details panel updates immediately when an Account is selected.
- The selected Account data is available for the discovery workflow.

## Success Criteria
- Account selection correctly controls the enabled/disabled state of the discovery button.
- The button label reads **Start Discovery**.
- The Account Details panel reflects the selected Account record.
- Multi-account selection still works as expected.
- UI state remains consistent between the table, action button, and details panel.

---

# Feedback: Header Button Alignment

## Observation
The **Refresh**, **Start Discovery**, and **Extract Staff** buttons should be in the same alignment.

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
- Crawl results - this should be shown on the website details panel for. now just to validate the response
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
# Feedback After Milestone 6 — Review/Edit Flow and Account Selection Constraints

## Observation
After Milestone 6 validation, the staff review workflow and Account selection behavior need additional refinements.

## Issues Identified
- After staff information is extracted, users cannot currently update or edit the fetched information before approval.
- The Account selection screen currently allows more Accounts than desired for the initial workflow.
- `Account_Status__c` should not be user-controlled from the filter UI for this workflow.

## Required Enhancements

### Editable Staff Review
After staff information is extracted, the Review GUI must allow users to edit fetched contact information before approval.

Editable fields should include:
- Name
- Title / Role
- Email
- Phone
- Department
- Source URL, if needed

### Account Selection Limit
The Account selection screen should limit the user to selecting a maximum of 10 Accounts.

If the user attempts to select more than 10 Accounts:
- Prevent the additional selection
- Display a validation message explaining the 10 Account limit

### Account Status Backend Filter
Remove Account Status from the visible filter UI.

Instead, the backend query must automatically filter Accounts where:

```sql
Account_Status__c = 'Prospect'
```

## Updated Query Requirement

```sql
SELECT
  Id,
  Name,
  Territory_Region__c,
  Payments_Stage__c,
  Website,
  LastModifiedDate
FROM Account
WHERE Website != null
AND Account_Status__c = 'Prospect'
ORDER BY LastModifiedDate DESC
LIMIT 200
```

## Success Criteria
- Users can edit extracted staff details before approving Salesforce updates.
- Users cannot select more than 10 Accounts.
- Account Status is removed from the UI filters.
- Backend query only returns Accounts with `Account_Status__c = 'Prospect'`.
- Review flow supports user correction before Salesforce create/update.

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