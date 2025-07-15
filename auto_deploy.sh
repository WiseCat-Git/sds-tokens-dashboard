#!/bin/bash
# Automated deployment script for SDS Tokens Dashboard

cd /Users/lopezlozano/tokens-dashboard

echo "$(date): Checking for data file updates..." >> /tmp/deploy-debug.log

# Check if data file was recently updated (within last 2 minutes)
if find data/tokens-data.json -newermt "2 minutes ago" | grep -q .; then
    echo "$(date): Data file updated, deploying to GitHub..." | tee -a /tmp/deploy-debug.log
    
    # Check git status before changes
    git status >> /tmp/deploy-debug.log 2>&1
    
    # Add and commit the updated data file
    git add data/tokens-data.json >> /tmp/deploy-debug.log 2>&1
    git commit -m "Auto-update token data: $(date '+%Y-%m-%d %H:%M:%S')" >> /tmp/deploy-debug.log 2>&1
    
    # Push to GitHub (which triggers Netlify deployment)
    git push origin main >> /tmp/deploy-debug.log 2>&1
    
    echo "$(date): Deployment completed - Netlify will update automatically" | tee -a /tmp/deploy-debug.log
else
    echo "$(date): No recent data updates, skipping deployment" | tee -a /tmp/deploy-debug.log
fi
