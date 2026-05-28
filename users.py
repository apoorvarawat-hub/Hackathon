"""
User access control table.

Left column  : myKaarma Google email (who logs in via Google)
Right column : Salesforce username   (which SF account their API calls run as)

Only emails listed here can access the application.
To add a user: add a new entry to USER_MAPPING.
"""

USER_MAPPING: dict[str, str] = {
    'apoorva.rawat@mykaarma.com': 'apoorva.rawat@mykaarma.com.dev',
    # 'other.user@mykaarma.com': 'other.user@mykaarma.com.dev',
}


def is_authorized(email: str) -> bool:
    return email.strip().lower() in USER_MAPPING


def get_sf_username(email: str):
    return USER_MAPPING.get(email.strip().lower())
