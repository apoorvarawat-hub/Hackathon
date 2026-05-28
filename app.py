import os
from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder='static', static_url_path='')

# Robust Mock Salesforce Account Database
SALESFORCE_ACCOUNTS = [
    {
        "id": "ACC-83921-X3",
        "name": "AutoNation Ford of North Scottsdale",
        "code": "ANFNS-01",
        "region": "Southwest",
        "website": "https://www.autonationfordnorthscottsdale.com",
        "phone": "+1-480-555-0199",
        "owner": "Sarah Jenkins",
        "annual_revenue": 45000000,
        "industry": "Automotive Retail",
        "status": "Active"
    },
    {
        "id": "ACC-10492-Y8",
        "name": "myKaarma Premium Auto Dealership",
        "code": "MKPAD-88",
        "region": "Pacific Northwest",
        "website": "https://www.mykaarmapremiumdealers.com",
        "phone": "+1-206-555-0144",
        "owner": "Marcus Aurelius",
        "annual_revenue": 72000000,
        "industry": "Automotive Retail",
        "status": "Active"
    },
    {
        "id": "ACC-57382-Z2",
        "name": "Penske Chevrolet Indianapolis",
        "code": "PENCH-12",
        "region": "Midwest",
        "website": "https://www.penskechevrolet.com",
        "phone": "+1-317-555-0123",
        "owner": "David Penske",
        "annual_revenue": 58000000,
        "industry": "Automotive Retail",
        "status": "Active"
    },
    {
        "id": "ACC-29481-W4",
        "name": "Hendrick Honda Charlotte",
        "code": "HENHN-44",
        "region": "Southeast",
        "website": "https://www.hendrickhonda.com",
        "phone": "+1-704-555-0188",
        "owner": "Linda Hendrick",
        "annual_revenue": 64000000,
        "industry": "Automotive Retail",
        "status": "Active"
    },
    {
        "id": "ACC-90412-V9",
        "name": "Sewell Lexus of Dallas",
        "code": "SEWLEX-08",
        "region": "South",
        "website": "https://www.sewelllexus.com",
        "phone": "+1-214-555-0108",
        "owner": "Robert Sewell",
        "annual_revenue": 89000000,
        "industry": "Automotive Retail",
        "status": "Active"
    }
]

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/accounts', methods=['GET'])
def get_accounts():
    query = request.args.get('query', '').strip().lower()
    
    if not query:
        return jsonify(SALESFORCE_ACCOUNTS)
        
    filtered = []
    for acc in SALESFORCE_ACCOUNTS:
        if (query in acc['name'].lower() or 
            query in acc['code'].lower() or 
            query in acc['region'].lower()):
            filtered.append(acc)
            
    return jsonify(filtered)

if __name__ == '__main__':
    # Run server locally on port 5000
    app.run(debug=True, host='127.0.0.1', port=5000)
