"""
Salesforce sandbox integration.

Reads accounts via SOQL and writes Contacts back.
Falls back silently if credentials are missing (USE_SALESFORCE = False).
"""
import os
from dotenv import load_dotenv

load_dotenv()

USE_SALESFORCE = all([
    os.getenv('SF_USERNAME'),
    os.getenv('SF_PASSWORD'),
    os.getenv('SF_SECURITY_TOKEN'),
    os.getenv('SF_CLIENT_ID'),
    os.getenv('SF_CLIENT_SECRET'),
])

_sf = None


def _get_sf():
    global _sf
    if _sf is None:
        from simple_salesforce import Salesforce
        _sf = Salesforce(
            username=os.getenv('SF_USERNAME'),
            password=os.getenv('SF_PASSWORD'),
            security_token=os.getenv('SF_SECURITY_TOKEN'),
            consumer_key=os.getenv('SF_CLIENT_ID'),
            consumer_secret=os.getenv('SF_CLIENT_SECRET'),
            domain='test',  # sandbox
        )
    return _sf


def _safe(value, default=''):
    """Return value or default if None."""
    return value if value is not None else default


def _escape(s: str) -> str:
    """Escape single quotes for SOQL string literals."""
    return s.replace("'", "\\'")


# ── Accounts ──────────────────────────────────────────────────────────────────

def fetch_prospect_accounts(name: str = '', region: str = '', payments_stage: str = '') -> list[dict]:
    sf = _get_sf()

    clauses = ["Account_Status__c = 'Prospect'", "Website != null", "Website != ''"]
    if name:
        clauses.append(f"Name LIKE '%{_escape(name)}%'")
    if region:
        clauses.append(f"Territory_Region__c = '{_escape(region)}'")
    if payments_stage:
        clauses.append(f"Payments_Stage__c = '{_escape(payments_stage)}'")

    soql = """
        SELECT Id, Name, Territory_Region__c, Account_Status__c, Payments_Stage__c,
               Website, Dawn_Status__c, LastModifiedDate, Phone,
               Owner.Name, AnnualRevenue, Industry
        FROM Account
        WHERE {where}
        ORDER BY LastModifiedDate DESC
        LIMIT 200
    """.format(where=' AND '.join(clauses))

    records = sf.query_all(soql)['records']
    result = []
    for r in records:
        result.append({
            'Id': r['Id'],
            'Name': r['Name'],
            'Territory_Region__c': _safe(r.get('Territory_Region__c')),
            'Account_Status__c': _safe(r.get('Account_Status__c')),
            'Payments_Stage__c': _safe(r.get('Payments_Stage__c')),
            'Website': _safe(r.get('Website')),
            'Dawn_Status__c': _safe(r.get('Dawn_Status__c')),
            'LastModifiedDate': _safe(r.get('LastModifiedDate')),
            'Phone': _safe(r.get('Phone')),
            'Owner': r['Owner']['Name'] if r.get('Owner') else '',
            'AnnualRevenue': r.get('AnnualRevenue') or 0,
            'Industry': _safe(r.get('Industry')),
        })
    return result


def update_account_dawn_status(account_id: str, dawn_status: str) -> None:
    sf = _get_sf()
    sf.Account.update(account_id, {'Dawn_Status__c': dawn_status})


# ── Contacts ──────────────────────────────────────────────────────────────────

def fetch_contacts_for_account(account_id: str) -> list[dict]:
    sf = _get_sf()
    soql = f"""
        SELECT Id, AccountId, FirstName, LastName, Name, Email, Phone, Title
        FROM Contact
        WHERE AccountId = '{_escape(account_id)}'
    """
    records = sf.query_all(soql)['records']
    return [
        {
            'Id': r['Id'],
            'AccountId': r['AccountId'],
            'Name': r['Name'],
            'Email': _safe(r.get('Email')),
            'Phone': _safe(r.get('Phone')),
            'Title': _safe(r.get('Title')),
        }
        for r in records
    ]


def create_contact(account_id: str, full_name: str, email: str, phone: str, title: str, department: str = '') -> str:
    """Create a Contact and return the new Salesforce Id."""
    sf = _get_sf()
    parts = full_name.strip().split()
    last = parts[-1] if parts else 'Unknown'
    first = ' '.join(parts[:-1]) if len(parts) > 1 else ''

    payload = {
        'AccountId': account_id,
        'FirstName': first,
        'LastName': last,
        'Email': email or '',
        'Phone': phone or '',
        'Title': title or '',
    }
    if department:
        payload['Department'] = department

    result = sf.Contact.create(payload)
    return result['id']


def update_contact(contact_id: str, email: str = None, phone: str = None, title: str = None) -> None:
    sf = _get_sf()
    payload = {}
    if email is not None:
        payload['Email'] = email
    if phone is not None:
        payload['Phone'] = phone
    if title is not None:
        payload['Title'] = title
    if payload:
        sf.Contact.update(contact_id, payload)
