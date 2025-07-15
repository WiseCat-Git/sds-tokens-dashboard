#!/usr/bin/env python3
"""
SDS Tokens Dashboard - BigQuery Sync Script
Automatically pulls fresh data from BigQuery and updates local dashboard
"""

import json
import os
import sys
from datetime import datetime
from google.cloud import bigquery
from google.oauth2 import service_account
import argparse

# Configuration
PROJECT_ID = "aff-2025-fe-14wnaz"
DATASET_ID = "sds_tokens"
TABLE_ID = "token_launches_json"
LOCAL_JSON_PATH = "./data/tokens-data.json"

def setup_bigquery_client():
    """Set up BigQuery client with authentication"""
    try:
        # Try default credentials first (if running on your machine with gcloud auth)
        client = bigquery.Client(project=PROJECT_ID)
        print("✅ Using default Google Cloud credentials")
        return client
    except Exception as e:
        print(f"❌ Failed to authenticate with default credentials: {e}")
        print("💡 Run: gcloud auth application-default login")
        return None

def get_latest_data(client):
    """Query BigQuery for the latest token data"""
    print(f"🔍 Querying BigQuery: {PROJECT_ID}.{DATASET_ID}.{TABLE_ID}")
    
    query = f"""
        SELECT 
            json_data, 
            record_count, 
            last_updated,
            export_timestamp
        FROM `{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}`
        ORDER BY export_timestamp DESC
        LIMIT 1
    """
    
    try:
        query_job = client.query(query)
        results = query_job.result()
        
        for row in results:
            print(f"📊 Found data: {row.record_count} records, updated: {row.last_updated}")
            
            # Parse the JSON data
            json_data = json.loads(row.json_data)
            
            # Add metadata
            json_data['bigquery_sync'] = {
                'synced_at': datetime.now().isoformat(),
                'source': 'BigQuery Python Sync',
                'bigquery_updated': row.last_updated.isoformat() if row.last_updated else None,
                'export_timestamp': row.export_timestamp.isoformat() if row.export_timestamp else None
            }
            
            return json_data
            
        print("⚠️ No data found in BigQuery table")
        return None
        
    except Exception as e:
        print(f"❌ BigQuery query failed: {e}")
        return None

def update_local_file(data, file_path):
    """Update the local JSON file with fresh data"""
    try:
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Backup existing file
        if os.path.exists(file_path):
            backup_path = f"{file_path}.backup"
            os.rename(file_path, backup_path)
            print(f"📁 Backed up existing file to: {backup_path}")
        
        # Write new data
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Updated local file: {file_path}")
        print(f"📊 Records: {data.get('recordCount', 'Unknown')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to update local file: {e}")
        return False

def verify_data_freshness(data):
    """Check if the data is recent"""
    try:
        if 'lastUpdated' in data:
            last_updated = datetime.fromisoformat(data['lastUpdated'].replace('Z', '+00:00'))
            age_hours = (datetime.now().astimezone() - last_updated).total_seconds() / 3600
            
            print(f"📅 Data age: {age_hours:.1f} hours")
            
            if age_hours > 24:
                print("⚠️ Warning: Data is more than 24 hours old")
            elif age_hours > 1:
                print("⚠️ Warning: Data is more than 1 hour old")
            else:
                print("✅ Data is fresh")
                
        return True
        
    except Exception as e:
        print(f"⚠️ Could not verify data freshness: {e}")
        return True

def main():
    """Main sync function"""
    parser = argparse.ArgumentParser(description='Sync SDS Tokens data from BigQuery')
    parser.add_argument('--output', '-o', default=LOCAL_JSON_PATH, help='Output JSON file path')
    parser.add_argument('--verify', '-v', action='store_true', help='Verify data freshness')
    parser.add_argument('--quiet', '-q', action='store_true', help='Quiet mode (minimal output)')
    
    args = parser.parse_args()
    
    if not args.quiet:
        print("🔄 SDS Tokens Dashboard - BigQuery Sync")
        print("=" * 50)
    
    # Setup BigQuery client
    client = setup_bigquery_client()
    if not client:
        sys.exit(1)
    
    # Get latest data
    data = get_latest_data(client)
    if not data:
        sys.exit(1)
    
    # Verify data freshness
    if args.verify:
        verify_data_freshness(data)
    
    # Update local file
    success = update_local_file(data, args.output)
    if not success:
        sys.exit(1)
    
    if not args.quiet:
        print("\n🎉 Sync completed successfully!")
        print(f"📁 File updated: {args.output}")
        print(f"📊 Records: {data.get('recordCount', 0)}")
        print(f"🕒 Last updated: {data.get('lastUpdated', 'Unknown')}")
    
    return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)