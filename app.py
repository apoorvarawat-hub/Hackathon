import os
from flask import Flask, jsonify, request

app = Flask(__name__, static_folder='static', static_url_path='')

# Salesforce-compliant Mock Account Database
SALESFORCE_ACCOUNTS = [
    {
        "Id": "ACC-83921-X3",
        "Name": "AutoNation Ford of North Scottsdale",
        "Territory_Region__c": "Southwest",
        "Account_Status__c": "Active",
        "Payments_Stage__c": "Paid",
        "Website": "https://www.autonationfordnorthscottsdale.com",
        "Dawn_Status__c": "",
        "LastModifiedDate": "2026-05-27T10:00:00Z",
        "Phone": "+1-480-555-0199",
        "Owner": "Sarah Jenkins",
        "AnnualRevenue": 45000000,
        "Industry": "Automotive Retail"
    },
    {
        "Id": "ACC-10492-Y8",
        "Name": "myKaarma Premium Auto Dealership",
        "Territory_Region__c": "Pacific Northwest",
        "Account_Status__c": "Active",
        "Payments_Stage__c": "Trial",
        "Website": "https://www.mykaarmapremiumdealers.com",
        "Dawn_Status__c": "",
        "LastModifiedDate": "2026-05-26T14:30:00Z",
        "Phone": "+1-206-555-0144",
        "Owner": "Marcus Aurelius",
        "AnnualRevenue": 72000000,
        "Industry": "Automotive Retail"
    },
    {
        "Id": "ACC-57382-Z2",
        "Name": "Penske Chevrolet Indianapolis",
        "Territory_Region__c": "Midwest",
        "Account_Status__c": "Active",
        "Payments_Stage__c": "Paid",
        "Website": "www.penskechevrolet.com", # Invalid because no http/https
        "Dawn_Status__c": "",
        "LastModifiedDate": "2026-05-25T09:15:00Z",
        "Phone": "+1-317-555-0123",
        "Owner": "David Penske",
        "AnnualRevenue": 58000000,
        "Industry": "Automotive Retail"
    },
    {
        "Id": "ACC-29481-W4",
        "Name": "Hendrick Honda Charlotte",
        "Territory_Region__c": "Southeast",
        "Account_Status__c": "Inactive",
        "Payments_Stage__c": "Pending",
        "Website": "https://www.hendrickhonda.com",
        "Dawn_Status__c": "",
        "LastModifiedDate": "2026-05-24T16:45:00Z",
        "Phone": "+1-704-555-0188",
        "Owner": "Linda Hendrick",
        "AnnualRevenue": 64000000,
        "Industry": "Automotive Retail"
    },
    {
        "Id": "ACC-90412-V9",
        "Name": "Sewell Lexus of Dallas",
        "Territory_Region__c": "South",
        "Account_Status__c": "Active",
        "Payments_Stage__c": "Paid",
        "Website": "https://www.sewelllexus.com",
        "Dawn_Status__c": "",
        "LastModifiedDate": "2026-05-27T11:20:00Z",
        "Phone": "+1-214-555-0108",
        "Owner": "Robert Sewell",
        "AnnualRevenue": 89000000,
        "Industry": "Automotive Retail"
    },
    {
        "Id": "ACC-44910-K2",
        "Name": "Dallas Dodge Chrysler Jeep",
        "Territory_Region__c": "South",
        "Account_Status__c": "Active",
        "Payments_Stage__c": "Pending",
        "Website": None, # Should be filtered out by default (Website != null)
        "Dawn_Status__c": "",
        "LastModifiedDate": "2026-05-23T08:00:00Z",
        "Phone": "+1-214-555-0777",
        "Owner": "Robert Sewell",
        "AnnualRevenue": 34000000,
        "Industry": "Automotive Retail"
    },
    {
        "Id": "ACC-33104-M8",
        "Name": "Chicago Toyota Center",
        "Territory_Region__c": "Midwest",
        "Account_Status__c": "Inactive",
        "Payments_Stage__c": "Unpaid",
        "Website": "", # Should be filtered out by default (Website != null)
        "Dawn_Status__c": "",
        "LastModifiedDate": "2026-05-22T13:10:00Z",
        "Phone": "+1-312-555-0988",
        "Owner": "David Penske",
        "AnnualRevenue": 29000000,
        "Industry": "Automotive Retail"
    }
]

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/accounts', methods=['GET'])
def get_accounts():
    name_filter = request.args.get('name', '').strip().lower()
    region_filter = request.args.get('region', '').strip()
    status_filter = request.args.get('status', '').strip()
    payments_stage_filter = request.args.get('payments_stage', '').strip()
    
    filtered = []
    
    for acc in SALESFORCE_ACCOUNTS:
        # Default Filter: Exclude accounts without websites
        if not acc.get('Website'):
            continue
            
        # Apply layered filters
        if name_filter and name_filter not in acc['Name'].lower():
            continue
            
        if region_filter and acc['Territory_Region__c'] != region_filter:
            continue
            
        if status_filter and acc['Account_Status__c'] != status_filter:
            continue
            
        if payments_stage_filter and acc['Payments_Stage__c'] != payments_stage_filter:
            continue
            
        filtered.append(acc)
        
    # Sort by LastModifiedDate DESC (matching example SOQL shape)
    filtered.sort(key=lambda x: x['LastModifiedDate'], reverse=True)
    
    return jsonify(filtered)

import urllib.parse
from datetime import datetime

@app.route('/api/discovery/start', methods=['POST'])
def start_discovery():
    data = request.get_json()
    if not data or 'accountIds' not in data:
        return jsonify({"error": "Missing accountIds"}), 400
        
    account_ids = data['accountIds']
    valid_accounts = []
    invalid_accounts = []
    
    for acc in SALESFORCE_ACCOUNTS:
        if acc['Id'] in account_ids:
            website = acc.get('Website', '')
            is_valid = False
            
            if website:
                try:
                    result = urllib.parse.urlparse(website)
                    if result.scheme in ['http', 'https'] and result.netloc:
                        is_valid = True
                except ValueError:
                    is_valid = False
                    
            if is_valid:
                valid_accounts.append({
                    "Id": acc['Id'],
                    "Name": acc['Name'],
                    "Website": website
                })
            else:
                timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                reason = f"No website available - {timestamp}"
                acc['Dawn_Status__c'] = reason
                invalid_accounts.append({
                    "Id": acc['Id'],
                    "Name": acc['Name'],
                    "Reason": "Invalid or missing website structure",
                    "Dawn_Status__c": reason
                })
                print(f"Audit Log: Account {acc['Id']} ({acc['Name']}) failed website validation. Reason: {reason}")
                
    return jsonify({
        "valid": valid_accounts,
        "invalid": invalid_accounts
    })

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
