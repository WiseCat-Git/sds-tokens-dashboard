// Global variables
let tokenData = [];
let filteredData = [];

// Configuration
const CONFIG = {
    // Local fallback data source
    DATA_SOURCE: './data/tokens-data.json',
    UPDATE_INTERVAL: 300000, // 5 minutes in milliseconds
};

// BigQuery Configuration
const BIGQUERY_CONFIG = {
    projectId: 'aff-2025-fe-14wnaz',
    datasetId: 'sds_tokens',
    tableId: 'token_launches',
    jsonTableId: 'token_launches_json'
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initializing...');
    loadTokenData();
});

// Main data loading function - tries BigQuery first, falls back to local
async function loadTokenData() {
    try {
        showLoading(true);
        console.log('🔄 Starting data load process...');
        
        // Try BigQuery first (but don't fail if no auth)
        const bigQuerySuccess = await tryLoadFromBigQuery();
        
        if (bigQuerySuccess) {
            console.log('✅ Successfully loaded data from BigQuery');
            return;
        }
        
        // Fallback to local data
        console.log('📁 Falling back to local data...');
        await loadFromLocalData();
        
    } catch (error) {
        console.error('❌ Error in main data load:', error);
        showLoading(false);
        showError(`Failed to load data: ${error.message}`);
    }
}

// Try to load data from BigQuery (graceful failure)
async function tryLoadFromBigQuery() {
    try {
        console.log('🔍 Attempting BigQuery data load...');
        
        // Check if we have authentication available
        const accessToken = window.ACCESS_CONTROL?.getAccessToken();
        
        if (!accessToken) {
            console.log('📝 No authentication available, skipping BigQuery');
            return false;
        }

        console.log('🔑 Authentication found, querying BigQuery...');

        // Try JSON table first (simpler and more reliable)
        const jsonData = await queryBigQueryJsonTable(accessToken);
        
        if (jsonData && jsonData.success && jsonData.data) {
            console.log(`✅ Loaded ${jsonData.data.length} records from BigQuery JSON table`);
            processJsonBigQueryData(jsonData);
            return true;
        }

        // Try structured table as backup
        const structuredData = await queryBigQueryStructuredTable(accessToken);
        
        if (structuredData && structuredData.length > 0) {
            console.log(`✅ Loaded ${structuredData.length} records from BigQuery structured table`);
            processStructuredBigQueryData(structuredData);
            return true;
        }

        console.log('⚠️ BigQuery tables found but no data returned');
        return false;
        
    } catch (error) {
        console.log('⚠️ BigQuery load failed (this is normal without auth):', error.message);
        return false;
    }
}

// Query the JSON BigQuery table
async function queryBigQueryJsonTable(accessToken) {
    const query = `
        SELECT json_data, record_count, last_updated
        FROM \`${BIGQUERY_CONFIG.projectId}.${BIGQUERY_CONFIG.datasetId}.${BIGQUERY_CONFIG.jsonTableId}\`
        ORDER BY export_timestamp DESC
        LIMIT 1
    `;

    const response = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${BIGQUERY_CONFIG.projectId}/queries`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: query,
            useLegacySql: false
        })
    });

    if (!response.ok) {
        throw new Error(`BigQuery JSON API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
        throw new Error(`BigQuery JSON query error: ${result.error.message}`);
    }

    if (result.rows && result.rows.length > 0) {
        const jsonString = result.rows[0].f[0].v; // json_data column
        return JSON.parse(jsonString);
    }

    return null;
}

// Query the structured BigQuery table
async function queryBigQueryStructuredTable(accessToken) {
    const query = `
        SELECT 
            tokenType,
            sageTeam,
            srpAdUseCase,
            textAdComponents,
            tokenCategory,
            sdsToken,
            surface,
            theme,
            currentSdsValue,
            upcomingSdsValue,
            sdsLaunchTarget,
            sdsStatus,
            sdsPoc,
            sdsLaunchDoc,
            affStatus,
            leName,
            leTargetLaunchQuarter,
            impactLevel,
            recordCount,
            lastUpdated,
            uniqueKey
        FROM \`${BIGQUERY_CONFIG.projectId}.${BIGQUERY_CONFIG.datasetId}.${BIGQUERY_CONFIG.tableId}\`
        ORDER BY lastUpdated DESC
        LIMIT 1000
    `;

    const response = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${BIGQUERY_CONFIG.projectId}/queries`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: query,
            useLegacySql: false
        })
    });

    if (!response.ok) {
        throw new Error(`BigQuery API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
        throw new Error(`BigQuery query error: ${result.error.message}`);
    }

    // Transform BigQuery result to our format
    if (result.rows && result.schema) {
        return result.rows.map(row => {
            const record = {};
            result.schema.fields.forEach((field, index) => {
                record[field.name] = row.f[index].v;
            });
            return record;
        });
    }

    return [];
}

// Process JSON BigQuery data
function processJsonBigQueryData(jsonData) {
    tokenData = jsonData.data;
    filteredData = [...tokenData];
    
    console.log('📄 Data processed from BigQuery JSON table:', tokenData.length, 'records');
    
    const lastUpdated = jsonData.lastUpdated ? new Date(jsonData.lastUpdated) : new Date();
    updateLastUpdatedDisplay(lastUpdated);
    
    initializeDashboard();
    showLoading(false);
}

// Process structured BigQuery data
function processStructuredBigQueryData(data) {
    tokenData = data;
    filteredData = [...tokenData];
    
    console.log('📊 Data processed from BigQuery structured table:', tokenData.length, 'records');
    
    if (tokenData.length > 0 && tokenData[0].lastUpdated) {
        const lastUpdated = new Date(tokenData[0].lastUpdated);
        updateLastUpdatedDisplay(lastUpdated);
    } else {
        updateLastUpdatedDisplay(new Date());
    }
    
    initializeDashboard();
    showLoading(false);
}

// Load data from local JSON file (fallback)
async function loadFromLocalData() {
    try {
        console.log('📁 Loading data from local JSON file...');
        
        const response = await fetch(CONFIG.DATA_SOURCE, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            throw new Error(`Local file error: ${response.status} ${response.statusText}`);
        }
        
        const jsonData = await response.json();
        
        // Handle response data
        if (Array.isArray(jsonData)) {
            // Direct JSON array (local file)
            tokenData = jsonData;
            console.log('📄 Data loaded from local JSON array:', tokenData.length, 'records');
            updateLastUpdatedDisplay(new Date()); // Use current time for local data
        } else if (jsonData.success && jsonData.data) {
            // API response format (Google Apps Script export)
            tokenData = jsonData.data;
            console.log('📄 Data loaded from local JSON (API format):', tokenData.length, 'records');
            
            // Use API's lastUpdated timestamp
            const lastUpdated = jsonData.lastUpdated ? new Date(jsonData.lastUpdated) : new Date();
            updateLastUpdatedDisplay(lastUpdated);
        } else {
            throw new Error('Invalid local data format received');
        }
        
        filteredData = [...tokenData];
        
        initializeDashboard();
        showLoading(false);
        
    } catch (error) {
        console.error('❌ Error loading local data:', error);
        showLoading(false);
        
        if (error.message.includes('404')) {
            showError(`
                <strong>Local data file not found</strong><br><br>
                Please update the dashboard with fresh data:<br>
                1. Run exportForDashboard in Google Apps Script<br>
                2. Download the JSON file<br>
                3. Replace data/tokens-data.json<br>
                4. Deploy to Netlify
            `);
        } else {
            showError(`Failed to load local data: ${error.message}`);
        }
    }
}

// Update last updated display
function updateLastUpdatedDisplay(timestamp) {
    const lastUpdatedElement = document.getElementById('last-updated');
    
    if (lastUpdatedElement) {
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        };
        
        const formattedTime = timestamp.toLocaleString('en-US', options);
        
        lastUpdatedElement.innerHTML = `
            <span class="last-updated-label">Last updated:</span>
            <span class="last-updated-time">${formattedTime}</span>
        `;
    }
}

// Initialize dashboard components
function initializeDashboard() {
    generateOverviewCards();
    generateDetailsTable();
    generateFilters();
    
    // Set up auto-refresh (will try BigQuery first, then local)
    setInterval(loadTokenData, CONFIG.UPDATE_INTERVAL);
}

// generateOverviewCards function (around line 245)
function generateOverviewCards() {
    const container = document.getElementById('le-cards-container');
    container.innerHTML = '';
    
    // Group data by LE name
    const groupedData = groupDataByLE(filteredData);
    
    // Filter out old LEs and sort by priority
    const recentLEs = Object.entries(groupedData)
        .filter(([leName, leData]) => isRecentLE(leData))
        .sort(([nameA, dataA], [nameB, dataB]) => {
            const getStatusPriority = (leData) => {
                const statuses = leData.map(item => item.affStatus || item.status || 'Unknown');
                if (statuses.includes('LCs being validated')) return 1;      // HIGHEST PRIORITY
                if (statuses.includes('Recently launched')) return 2;        // SECOND PRIORITY
                if (statuses.includes('LE in Progress')) return 3;
                if (statuses.includes('LE Planning')) return 4;
                return 5;
            };
            
            return getStatusPriority(dataA) - getStatusPriority(dataB);
        });
    
    // Create cards only for recent LEs
    recentLEs.forEach(([leName, leData]) => {
        const card = createLECard(leName, leData);
        container.appendChild(card);
    });
    
    // Show count of hidden LEs (optional info for stakeholders)
    const hiddenCount = Object.keys(groupedData).length - recentLEs.length;
    if (hiddenCount > 0) {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'hidden-les-info';
        infoDiv.innerHTML = `
            <div style="text-align: center; color: #5f6368; font-size: 14px; padding: 16px; background: #f8f9fa; border-radius: 8px; margin-top: 16px;">
                📊 ${hiddenCount} older LE${hiddenCount > 1 ? 's' : ''} hidden (more than 1 quarter old)
            </div>
        `;
        container.appendChild(infoDiv);
    }
}

// Group data by LE name
function groupDataByLE(data) {
    return data.reduce((groups, item) => {
        const leName = extractLEName(item);
        if (!groups[leName]) {
            groups[leName] = [];
        }
        groups[leName].push(item);
        return groups;
    }, {});
}

// Extract LE name from various fields
function extractLEName(record) {
    // Try leName first (from processed data)
    if (record.leName && record.leName.toString().trim() !== '') {
        return record.leName.toString().trim();
    }
    
    // Try sdsStatus (most descriptive from Google Sheets)
    if (record.sdsStatus && record.sdsStatus.toString().trim() !== '') {
        return record.sdsStatus.toString().trim();
    }
    
    // Try Token Category 
    if (record.tokenCategory && record.tokenCategory.toString().trim() !== '') {
        return record.tokenCategory.toString().trim();
    }
    
    // Try to create a meaningful name from token and surface
    if (record.sdsToken && record.surface) {
        const tokenPart = record.sdsToken.toString().split('.').pop() || record.sdsToken;
        return `${record.tokenType || record.tokenChange} Changes - ${tokenPart} (${record.surface})`;
    }
    
    // Default based on token type and surface
    const tokenType = record.tokenType || record.tokenChange || 'Unknown';
    const surface = record.surface || '';
    
    if (surface) {
        return `${tokenType} Changes - ${surface}`;
    }
    
    return `${tokenType} Token Changes`;
}

// Check if an LE is recent (within the last quarter)
function isRecentLE(leData) {
    // Get current date and calculate one quarter ago
    const now = new Date();
    const oneQuarterAgo = new Date();
    oneQuarterAgo.setMonth(now.getMonth() - 3);
    
    // Check if any record in this LE has recent activity
    return leData.some(record => {
        const targetQuarter = record.leTargetLaunchQuarter || record.sdsLaunchTarget;
        
        if (!targetQuarter) return true; // Include if no date specified
        
        // Parse quarter format (e.g., "2025 Q1", "Q1 2025")
        const quarterDate = parseQuarterToDate(targetQuarter);
        return quarterDate >= oneQuarterAgo;
    });
}

// Helper function to parse quarter strings to dates
function parseQuarterToDate(quarterStr) {
    if (!quarterStr) return new Date();
    
    const str = quarterStr.toString().trim();
    
    // Handle different quarter formats
    const yearMatch = str.match(/(\d{4})/);
    const quarterMatch = str.match(/Q(\d)/i);
    
    if (yearMatch && quarterMatch) {
        const year = parseInt(yearMatch[1]);
        const quarter = parseInt(quarterMatch[1]);
        
        // Convert quarter to month (Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct)
        const month = (quarter - 1) * 3;
        return new Date(year, month, 1);
    }
    
    // Handle date objects or other formats
    if (str.includes('2024') || str.includes('2025')) {
        // Extract year and assume current quarter if no Q specified
        const year = parseInt(yearMatch[1]);
        return new Date(year, 0, 1); // Default to start of year
    }
    
    return new Date(); // Default to current date if parsing fails
}

// Create LE card element
function createLECard(leName, leData) {
    const card = document.createElement('div');
    card.className = 'le-card';
    
    const tokensCount = leData.length;
    
    // Count unique components properly
    const componentSets = leData.map(item => {
        const components = item.textAdComponents || item.component || item.components || '';
        return components.toString().split(/[\n,]/).map(c => c.trim()).filter(c => c);
    });
    const allComponents = [...new Set(componentSets.flat())];
    const componentsCount = allComponents.length;
    
    const impactLevel = calculateImpactLevel(leData);
    const statusSegments = calculateStatusSegments(leData);
    
    card.innerHTML = `
    <div class="le-card-header">
        <div class="le-header-content">
            <div class="le-title">${leName}</div>
            <div class="impact-badge impact-${impactLevel.toLowerCase()}">${impactLevel} Impact</div>
        </div>
        <button class="view-details-btn" onclick="showLEDetailsModal('${leName.replace(/'/g, "\\'")}', ${JSON.stringify(leData).replace(/'/g, "\\'")})">View Details</button>
    </div>
    
    <div class="metrics-row">
        <div class="metric-item">
            <div class="metric-value">${tokensCount}</div>
            <div class="metric-label">Tokens Changed</div>
        </div>
        <div class="metric-item">
            <div class="metric-value">${componentsCount}</div>
            <div class="metric-label">Components Affected</div>
        </div>
        <div class="metric-item">
            <div class="metric-value">1</div>
            <div class="metric-label">Ad Format Affected</div>
        </div>
    </div>
    
    <div class="status-timeline">
        ${statusSegments.map(segment => 
            `<div class="status-segment status-${segment}"></div>`
        ).join('')}
    </div>
    <div class="status-labels">
        <span>LE Planning</span>
        <span>LE in Progress</span>
        <span>Validating LC</span>
        <span>Recently Launched</span>
    </div>
`;

return card;
}

// Calculate impact level based on data
function calculateImpactLevel(leData) {
    // Try multiple component field names and count unique components
    const componentSets = leData.map(item => {
        const components = item.textAdComponents || item.component || item.components || '';
        // Split by newlines and commas, filter empty strings
        return components.toString().split(/[\n,]/).map(c => c.trim()).filter(c => c);
    });
    
    // Flatten and get unique components
    const allComponents = [...new Set(componentSets.flat())];
    const componentsCount = allComponents.length;
    
    if (componentsCount >= 5) return 'High';
    if (componentsCount >= 3) return 'Medium';
    return 'Low';
}

// Calculate status segments for timeline
function calculateStatusSegments(leData) {
    const statuses = leData.map(item => item.affStatus || item.status || 'Unknown');
    const uniqueStatuses = [...new Set(statuses)];
    
    // Default segments
    const segments = ['inactive', 'inactive', 'inactive', 'inactive'];
    
    // Map statuses in priority order (FIXED NAMES)
    if (uniqueStatuses.includes('Recently launched')) {
        segments[3] = 'launched';
    }
    // FIX: Use the correct status name from Apps Script
    if (uniqueStatuses.includes('LCs being validated')) {  // ✅ CORRECTED
        segments[2] = 'validating';
    }
    if (uniqueStatuses.includes('LE in Progress')) {
        segments[1] = 'progress';
    }
    if (uniqueStatuses.includes('LE Planning')) {
        segments[0] = 'planning';
    }
    
    return segments;
}

// Generate details table
function generateDetailsTable() {
    const tableHeader = document.getElementById('table-header');
    const tableBody = document.getElementById('table-body');
    
    // Generate headers
    const headers = [
        'Type', 'Ad Format', 'Component(s)', 'Category',
        'Token', 'Surface', 'Theme', 'Old Value', 'New Value',
        'Launch Target', 'Status', 'Doc'
    ];
    
    tableHeader.innerHTML = `
        <tr>
            ${headers.map(header => `<th>${header}</th>`).join('')}
        </tr>
    `;
    
    // Generate rows
    generateTableRows();
}

// Generate table rows
function generateTableRows() {
    const tableBody = document.getElementById('table-body');
    
    tableBody.innerHTML = filteredData.map(item => `
        <tr>
            <td><span class="token-type-badge type-${(item.tokenChange || item.tokenType || '').toLowerCase().includes('color') ? 'color' : 'font'}">${item.tokenChange || item.tokenType || 'Unknown'}</span></td>
            <td>${item.srpAdUseCase || 'Text Ad'}</td>
            <td>${(item.textAdComponents || item.component || '').replace(/\n/g, '<br>')}</td>
            <td>${item.tokenCategory || '-'}</td>
            <td>${item.sdsToken || '-'}</td>
            <td>${item.surface || '-'}</td>
            <td>${item.theme || '-'}</td>
            <td>${formatValue(item.currentSdsValue)}</td>
            <td>${formatValue(item.upcomingSdsValue)}</td>
            <td>${item.leTargetLaunchQuarter || item.sdsLaunchTarget || '-'}</td>
            <td><span class="status-badge status-${getStatusClass(item.affStatus)}">${item.affStatus || '-'}</span></td>
            <td>${item.sdsLaunchDoc ? `<a href="${item.sdsLaunchDoc}" style="color: #1a73e8;" target="_blank">Link</a>` : '-'}</td>
        </tr>
    `).join('');
}

// Format color/font values
function formatValue(value) {
    if (!value) return '-';
    
    // Check if it's a color value (starts with #)
    if (typeof value === 'string' && value.startsWith('#')) {
        return `<span class="color-preview" style="background: ${value};"></span>${value}`;
    }
    
    return value;
}

// Get CSS class for status badge
function getStatusClass(status) {
    if (!status) return '';
    
    const statusLower = status.toLowerCase();
    if (statusLower.includes('recently launched')) return 'recently-launched';
    if (statusLower.includes('lcs being validated')) return 'validating-lc';  // ✅ CORRECTED
    if (statusLower.includes('unlaunched')) return 'unlaunched';
    
    return '';
}

// Generate filter controls
function generateFilters() {
    const filtersGrid = document.getElementById('filters-grid');
    
    const filters = [
        { key: 'leTargetLaunchQuarter', label: 'LE Target Launch Quarter' },
        { key: 'affStatus', label: 'LE Status' },
        { key: 'textAdComponents', label: 'Text Ad Component' },
        { key: 'tokenType', label: 'Token Type' },
        { key: 'surface', label: 'Surface' },
        { key: 'theme', label: 'Theme' }
    ];
    
    filtersGrid.innerHTML = filters.map(filter => {
        const uniqueValues = [...new Set(tokenData.map(item => {
            let value = item[filter.key];
            // Handle special cases
            if (filter.key === 'textAdComponents' && !value) {
                value = item.component; // fallback
            }
            if (filter.key === 'leTargetLaunchQuarter' && !value) {
                value = item.sdsLaunchTarget; // fallback
            }
            return value;
        }).filter(value => value && value.toString().trim() !== ''))].sort();
        
        return `
            <div class="filter-group">
                <label class="filter-label">${filter.label}</label>
                <select class="filter-select" onchange="applyFilter('${filter.key}', this.value)">
                    <option value="">All ${filter.label}</option>
                    ${uniqueValues.map(value => `<option value="${value}">${value}</option>`).join('')}
                </select>
            </div>
        `;
    }).join('');
}

// Apply filter
function applyFilter(filterKey, filterValue) {
    console.log('Applying filter:', filterKey, filterValue);
    
    if (!filterValue) {
        // Reset to show all data
        filteredData = [...tokenData];
    } else {
        // Apply the filter
        filteredData = tokenData.filter(item => {
            let itemValue = item[filterKey];
            
            // Handle special cases and fallbacks
            if (filterKey === 'textAdComponents' && !itemValue) {
                itemValue = item.component; // fallback
            }
            if (filterKey === 'leTargetLaunchQuarter' && !itemValue) {
                itemValue = item.sdsLaunchTarget; // fallback
            }
            if (filterKey === 'tokenType' && !itemValue) {
                itemValue = item.tokenChange; // fallback
            }
            
            return itemValue && itemValue.toString().includes(filterValue);
        });
    }
    
    console.log(`Filtered to ${filteredData.length} records`);
    
    // Re-generate components with filtered data
    generateOverviewCards();
    generateTableRows();
}

// Show/hide loading state
function showLoading(show) {
    const loading = document.getElementById('loading');
    const overview = document.getElementById('overview-page');
    const details = document.getElementById('details-page');
    
    if (show) {
        loading.style.display = 'flex';
        overview.style.display = 'none';
        details.style.display = 'none';
    } else {
        loading.style.display = 'none';
        // Show the appropriate page
        if (document.querySelector('.tab.active').textContent === 'Overview') {
            overview.style.display = 'block';
        } else {
            details.style.display = 'block';
        }
    }
}

// Show error message
function showError(message) {
    const loading = document.getElementById('loading');
    loading.innerHTML = `
        <div style="color: #d93025; text-align: center;">
            <h3>Error</h3>
            <div>${message}</div>
            <button onclick="loadTokenData()" style="margin-top: 16px; padding: 8px 16px; background: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Retry
            </button>
        </div>
    `;
}

// Page navigation functions
function showOverview() {
    document.getElementById('overview-page').style.display = 'block';
    document.getElementById('details-page').style.display = 'none';
    
    // Update tab styling
    const tabs = document.querySelectorAll('.tab');
    tabs[0].classList.add('active');
    tabs[1].classList.remove('active');
}

function showDetails() {
    document.getElementById('overview-page').style.display = 'none';
    document.getElementById('details-page').style.display = 'block';
    
    // Update tab styling
    const tabs = document.querySelectorAll('.tab');
    tabs[0].classList.remove('active');
    tabs[1].classList.add('active');
}

// Debug function to test BigQuery connection
function testBigQueryConnection() {
    console.log('🧪 Testing BigQuery connection...');
    
    const accessToken = window.ACCESS_CONTROL?.getAccessToken();
    if (!accessToken) {
        console.log('❌ No access token available for BigQuery test');
        console.log('💡 This is normal - dashboard will use local data instead');
        return;
    }
    
    queryBigQueryJsonTable(accessToken)
        .then(result => {
            if (result) {
                console.log('✅ BigQuery test successful:', result.recordCount, 'records');
            } else {
                console.log('⚠️ BigQuery test returned no data');
            }
        })
        .catch(error => {
            console.log('❌ BigQuery test failed:', error.message);
        });
}

// Expose test function globally for debugging
window.testBigQueryConnection = testBigQueryConnection;

// Add these functions to your script.js file

// Show LE Details Modal
function showLEDetailsModal(leName, leData) {
    const modal = document.getElementById('le-details-modal');
    
    // Populate modal header
    document.getElementById('modal-le-title').textContent = leName;
    
    const impactLevel = calculateImpactLevel(leData);
    const impactBadge = document.getElementById('modal-le-impact');
    impactBadge.textContent = `${impactLevel} Impact`;
    impactBadge.className = `impact-badge impact-${impactLevel.toLowerCase()}`;
    
    // Populate metrics
    document.getElementById('modal-tokens-count').textContent = leData.length;
    
    const componentSets = leData.map(item => {
        const components = item.textAdComponents || item.component || item.components || '';
        return components.toString().split(/[\n,]/).map(c => c.trim()).filter(c => c);
    });
    const allComponents = [...new Set(componentSets.flat())];
    document.getElementById('modal-components-count').textContent = allComponents.length;
    
    // Populate status timeline
    const statusSegments = calculateStatusSegments(leData);
    const statusTimeline = document.getElementById('modal-status-timeline');
    statusTimeline.innerHTML = statusSegments.map(segment => 
        `<div class="status-segment status-${segment}"></div>`
    ).join('');
    
    // Populate details table
    const tableBody = document.getElementById('modal-table-body');
    tableBody.innerHTML = leData.map(item => `
        <tr>
            <td><span class="token-type-badge type-${(item.tokenChange || item.tokenType || '').toLowerCase().includes('color') ? 'color' : 'font'}">${item.tokenChange || item.tokenType || 'Unknown'}</span></td>
            <td>${item.sdsToken || '-'}</td>
            <td>${(item.textAdComponents || item.component || '').replace(/\n/g, '<br>')}</td>
            <td>${item.surface || '-'}</td>
            <td>${item.theme || '-'}</td>
            <td>${formatValue(item.currentSdsValue)}</td>
            <td>${formatValue(item.upcomingSdsValue)}</td>
            <td>${item.sdsLaunchDoc ? `<a href="${item.sdsLaunchDoc}" style="color: #1a73e8;" target="_blank">Link</a>` : '-'}</td>
        </tr>
    `).join('');
    
    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

// Close LE Details Modal
function closeLEDetailsModal() {
    const modal = document.getElementById('le-details-modal');
    modal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('le-details-modal');
    if (event.target === modal) {
        closeLEDetailsModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('le-details-modal');
        if (modal.style.display === 'flex') {
            closeLEDetailsModal();
        }
    }
});