let rawData = [];
let charts = {};

document.addEventListener('DOMContentLoaded', function() {
    // 1. Theme Logic (Priority)
    const savedTheme = localStorage.getItem('mtn_theme') || 'dark';
    applyTheme(savedTheme);
    
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
        themeSelector.value = savedTheme;
        themeSelector.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            localStorage.setItem('mtn_theme', newTheme);
            applyTheme(newTheme);
            window.location.reload(); // Reload to refresh charts with new theme colors
        });
    }

    // 2. Data Initialization (Dashboard Only)
    // Only init data if on a page that needs it (e.g. valid dashboardData)
    if (typeof dashboardData !== 'undefined' && dashboardData.raw_data) {
        rawData = dashboardData.raw_data;
        if (document.getElementById('stateFilter')) {
            populateFilters();
            updateDashboard();
        }
    }

    // 3. Event Listeners (Safe Attachment)
    const safeAddListener = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    safeAddListener('stateFilter', 'change', updateDashboard);
    safeAddListener('deviceFilter', 'change', updateDashboard);
    safeAddListener('planFilter', 'change', updateDashboard);
    safeAddListener('customerSearch', 'input', handleSearch);
    safeAddListener('prevPage', 'click', () => changePage(-1));
    safeAddListener('nextPage', 'click', () => changePage(1));

    // 4. Navigation Logic
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            
            // Update Active Link
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Show Target View
            document.querySelectorAll('.view-section').forEach(section => {
                section.style.display = 'none';
                section.classList.remove('active');
            });
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.style.display = 'block';
                targetSection.classList.add('active');
            }

            // Init view specific logic
            if (targetId === 'customers-view') {
                renderCustomersTable();
            }
        });
    });
});

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Chart Color Updates
    if (theme === 'light') {
        Chart.defaults.color = '#121212';
        Chart.defaults.borderColor = '#ccc';
    } else {
        Chart.defaults.color = '#ffffff';
        Chart.defaults.borderColor = '#333';
    }
}

// --- CUSTOMERS TABLE LOGIC ---
let currentPage = 1;
const rowsPerPage = 10;
let filteredCustomers = []; 

function renderCustomersTable() {
    // If not already filtered by search, use all rawData
    const query = document.getElementById('customerSearch').value.toLowerCase();
    
    if (filteredCustomers.length === 0 && query === '') {
        filteredCustomers = rawData;
    }

    const tbody = document.querySelector('#customersTable tbody');
    tbody.innerHTML = '';

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedItems = filteredCustomers.slice(start, end);

    paginatedItems.forEach(customer => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${customer['Customer ID']}</td>
            <td>${customer['Full Name']}</td>
            <td>${customer['State']}</td>
            <td>${customer['Subscription Plan']}</td>
            <td>₦${parseFloat(customer['Total Revenue']).toLocaleString()}</td>
            <td>
                <span style="color: ${customer['Customer Churn Status'] === 'Yes' ? '#ff4d4d' : '#00cc66'}">
                    ${customer['Customer Churn Status']}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Update Pagination Controls
    document.getElementById('pageInfo').innerText = `Page ${currentPage} of ${Math.ceil(filteredCustomers.length / rowsPerPage)}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = end >= filteredCustomers.length;
}

function changePage(direction) {
    currentPage += direction;
    renderCustomersTable();
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    filteredCustomers = rawData.filter(c => 
        c['Full Name'].toLowerCase().includes(query) || 
        c['Customer ID'].toLowerCase().includes(query)
    );
    currentPage = 1;
    renderCustomersTable();
}

// --- REPORTS LOGIC ---
function downloadReport(type) {
    let csvContent = "data:text/csv;charset=utf-8,";
    let dataToExport = [];
    let filename = `${type}_report.csv`;

    if (type === 'executive') {
        dataToExport = [['Metric', 'Value'], 
                        ['Total Customers', rawData.length],
                        ['Total Revenue', rawData.reduce((a, b) => a + (parseFloat(b['Total Revenue'])||0), 0)]];
    } else if (type === 'churn') {
        dataToExport = [['Reason', 'Count']];
        const reasons = {};
        rawData.filter(x => x['Customer Churn Status'] === 'Yes').forEach(x => {
            reasons[x['Reasons for Churn']] = (reasons[x['Reasons for Churn']] || 0) + 1;
        });
        for (const [key, val] of Object.entries(reasons)) {
            dataToExport.push([key, val]);
        }
    } else if (type === 'revenue') {
         dataToExport = [['State', 'Total Revenue']];
         const states = {};
         rawData.forEach(x => {
             states[x['State']] = (states[x['State']] || 0) + (parseFloat(x['Total Revenue'])||0);
         });
         for (const [key, val] of Object.entries(states)) {
             dataToExport.push([key, val]);
         }
    }

    dataToExport.forEach(row => {
        csvContent += row.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- DASHBOARD LOGIC (Existing) ---
function populateFilters() {
    // Helper to populate a specific select element
    const populate = (key, elementId) => {
        const uniqueValues = [...new Set(rawData.map(item => item[key]))].sort();
        const selectElement = document.getElementById(elementId);
        uniqueValues.forEach(val => {
            if (val) { // check for non-empty
                const option = document.createElement('option');
                option.value = val;
                option.textContent = val;
                selectElement.appendChild(option);
            }
        });
    };

    populate('State', 'stateFilter');
    populate('MTN Device', 'deviceFilter');
    populate('Subscription Plan', 'planFilter');
}


function processData(data) {
    // 1. Calculate Metrics
    const totalCustomers = data.length;
    
    // Revenue might need cleaning if not done in python properly for all rows?
    // The python script did convert to float, assuming JSON preserved it
    const totalRevenue = data.reduce((sum, item) => sum + (parseFloat(item['Total Revenue']) || 0), 0);
    
    const churnCount = data.filter(item => item['Customer Churn Status'] === 'Yes').length;
    const churnRate = totalCustomers > 0 ? (churnCount / totalCustomers) * 100 : 0;
    
    const satisfactionSum = data.reduce((sum, item) => sum + (parseFloat(item['Satisfaction Rate']) || 0), 0);
    const avgSatisfaction = totalCustomers > 0 ? (satisfactionSum / totalCustomers) : 0;
    
    const arpu = totalCustomers > 0 ? (totalRevenue / totalCustomers) : 0;

    // 2. Churn Distribution
    const churnDist = {};
    data.forEach(item => {
        const status = item['Customer Churn Status'];
        churnDist[status] = (churnDist[status] || 0) + 1;
    });

    // 3. Satisfaction by Device
    const deviceSat = {};
    const deviceCounts = {};
    data.forEach(item => {
        const device = item['MTN Device'];
        const sat = parseFloat(item['Satisfaction Rate']) || 0;
        deviceSat[device] = (deviceSat[device] || 0) + sat;
        deviceCounts[device] = (deviceCounts[device] || 0) + 1;
    });
    
    const satByDeviceLabels = Object.keys(deviceSat);
    const satByDeviceData = satByDeviceLabels.map(d => deviceSat[d] / deviceCounts[d]);

    // 4. Revenue by State
    // Sort top 10
    const stateRev = {};
    data.forEach(item => {
        const state = item['State'];
        const rev = parseFloat(item['Total Revenue']) || 0;
        stateRev[state] = (stateRev[state] || 0) + rev;
    });
    
    const sortedStates = Object.entries(stateRev).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const revByStateLabels = sortedStates.map(entry => entry[0]);
    const revByStateData = sortedStates.map(entry => entry[1]);

    // 5. Churn Reasons
    const reasonCounts = {};
    data.filter(item => item['Customer Churn Status'] === 'Yes').forEach(item => {
        const reason = item['Reasons for Churn'];
        if (reason) {
             reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
        }
    });
    const churnReasonsLabels = Object.keys(reasonCounts);
    const churnReasonsData = Object.values(reasonCounts);

    return {
        metrics: {
            total_customers: totalCustomers,
            total_revenue: totalRevenue,
            churn_rate: churnRate.toFixed(2),
            avg_satisfaction: avgSatisfaction.toFixed(2),
            arpu: arpu.toFixed(2)
        },
        churn_distribution: churnDist,
        satisfaction_by_device: { labels: satByDeviceLabels, data: satByDeviceData },
        revenue_by_state: { labels: revByStateLabels, data: revByStateData },
        churn_reasons: { labels: churnReasonsLabels, data: churnReasonsData }
    };
}

function updateDashboard() {
    const selectedState = document.getElementById('stateFilter').value;
    const selectedDevice = document.getElementById('deviceFilter').value;
    const selectedPlan = document.getElementById('planFilter').value;
    
    // Filter Data
    let filteredData = rawData;

    if (selectedState !== 'All') {
        filteredData = filteredData.filter(item => item['State'] === selectedState);
    }
    if (selectedDevice !== 'All') {
        filteredData = filteredData.filter(item => item['MTN Device'] === selectedDevice);
    }
    if (selectedPlan !== 'All') {
        filteredData = filteredData.filter(item => item['Subscription Plan'] === selectedPlan);
    }
    
    if (filteredData.length === 0) {
        // Handle empty scenario if needed, currently charts will just show empty or 0
    }

    const processed = processData(filteredData);
    
    updateMetrics(processed.metrics);
    updateCharts(processed);
}

function updateMetrics(metrics) {
    document.getElementById('total-revenue').innerText = '₦' + Math.round(metrics.total_revenue).toLocaleString();
    document.getElementById('total-customers').innerText = metrics.total_customers.toLocaleString();
    document.getElementById('churn-rate').innerText = metrics.churn_rate + '%';
    document.getElementById('avg-satisfaction').innerText = metrics.avg_satisfaction + '/5';
    document.getElementById('arpu').innerText = '₦' + Math.round(metrics.arpu).toLocaleString();
}

function updateCharts(data) {
    Chart.register(ChartDataLabels); 
    
    // Helper Calc Percentage
    const calculatePercentage = (value, ctx) => {
        let sum = 0;
        let dataArr = ctx.chart.data.datasets[0].data;
        dataArr.map(data => {
            sum += data;
        });
        if (sum === 0) return '0%';
        let percentage = (value*100 / sum).toFixed(1)+"%";
        return percentage;
    };

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#ffffff' } },
            datalabels: {
                color: '#ffffff',
                anchor: 'end',
                align: 'top',
                formatter: (value, ctx) => value, // Placeholder, overridden often
                font: { weight: 'bold' }
            }
        },
        scales: {
            x: { ticks: { color: '#b0b0b0' }, grid: { color: '#333333' } },
            y: { ticks: { color: '#b0b0b0' }, grid: { color: '#333333' } }
        }
    };
    
    const pieOptions = {
         responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#ffffff' } },
            datalabels: {
                color: '#ffffff',
                formatter: (value, ctx) => calculatePercentage(value, ctx)
            }
        }
    };

    // Helper to Create/Update Chart
    const createOrUpdate = (ctxId, type, chartData, options) => {
        const ctx = document.getElementById(ctxId).getContext('2d');
        if (charts[ctxId]) {
            charts[ctxId].destroy();
        }
        charts[ctxId] = new Chart(ctx, {
            type: type,
            data: chartData,
            options: options
        });
    };

    // 1. Churn Distribution
    createOrUpdate('churnChart', 'doughnut', {
        labels: Object.keys(data.churn_distribution),
        datasets: [{
            data: Object.values(data.churn_distribution),
            backgroundColor: ['#FFCC00', '#333333'],
            borderWidth: 0
        }]
    }, pieOptions);

    // 2. Satisfaction By Device
    createOrUpdate('satisfactionChart', 'bar', {
        labels: data.satisfaction_by_device.labels,
        datasets: [{
            label: 'Avg Satisfaction',
            data: data.satisfaction_by_device.data,
            backgroundColor: '#FFCC00',
            borderRadius: 4
        }]
    }, {
        ...commonOptions,
        plugins: {
            ...commonOptions.plugins,
            datalabels: {
                color: '#ffffff',
                anchor: 'end',
                align: 'bottom',
                formatter: (value) => Math.round((value/5)*100) + '%'
            }
        },
        scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, max: 5.5 } }
    });

    // 3. Revenue
    createOrUpdate('revenueChart', 'bar', {
        labels: data.revenue_by_state.labels,
        datasets: [{
            label: 'Total Revenue',
            data: data.revenue_by_state.data,
            backgroundColor: '#FFCC00',
            borderRadius: 4
        }]
    }, {
        ...commonOptions,
        plugins: {
            ...commonOptions.plugins,
            datalabels: {
                ...commonOptions.plugins.datalabels,
                formatter: (value, ctx) => calculatePercentage(value, ctx)
            }
        }
    });

    // 4. Reasons
    createOrUpdate('reasonsChart', 'bar', {
        labels: data.churn_reasons.labels,
        datasets: [{
            label: 'Count',
            data: data.churn_reasons.data,
            backgroundColor: '#555555',
            borderRadius: 4
        }]
    }, {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#ffffff' } },
            datalabels: {
                color: '#ffffff',
                anchor: 'end',
                align: 'end',
                formatter: (value, ctx) => calculatePercentage(value, ctx)
            }
        },
        scales: commonOptions.scales
    });
}
