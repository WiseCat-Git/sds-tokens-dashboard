#!/bin/bash
# Automated deployment script for SDS Tokens Dashboard

cd /Users/lopezlozano/tokens-dashboard

echo "$(date): Checking for data file updates..." >> /tmp/deploy-debug.log

# Check if data file was recently updated (within last 2 minutes)
if find data/tokens-data.json -newermt "2 minutes ago" | grep -q .; then
    echo "$(date): Data file updated, deploying to GitHub..." | tee -a /tmp/deploy-debug.log
    
    # Add the updated data file
    if git add data/tokens-data.json >> /tmp/deploy-debug.log 2>&1; then
        echo "$(date): Git add successful" >> /tmp/deploy-debug.log
    else
        echo "$(date): Git add failed" >> /tmp/deploy-debug.log
        exit 1
    fi
    
    # Check if there are changes to commit
    if git diff --cached --quiet; then
        echo "$(date): No changes in git index after add, skipping commit" | tee -a /tmp/deploy-debug.log
    else
        echo "$(date): Changes detected in git index, committing..." | tee -a /tmp/deploy-debug.log
        
        # Commit with proper error checking
        if git commit -m "Auto-update token data: $(date '+%Y-%m-%d %H:%M:%S')" >> /tmp/deploy-debug.log 2>&1; then
            echo "$(date): Git commit successful" >> /tmp/deploy-debug.log
            
            # Push with proper error checking
            if git push origin main >> /tmp/deploy-debug.log 2>&1; then
                echo "$(date): Git push successful" >> /tmp/deploy-debug.log
            else
                echo "$(date): Git push FAILED" >> /tmp/deploy-debug.log
                exit 1
            fi
        else
            echo "$(date): Git commit FAILED" >> /tmp/deploy-debug.log
            exit 1
        fi
    fi
    
    echo "$(date): Deployment completed - Netlify will update automatically" | tee -a /tmp/deploy-debug.log
else
    echo "$(date): No recent data updates, skipping deployment" | tee -a /tmp/deploy-debug.log
fi
