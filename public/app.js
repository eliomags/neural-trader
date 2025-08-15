const API_URL = 'http://localhost:3001/api';
let socket;
let equityChart;
let isTrading = false;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initializeWebSocket();
    initializeChart();
    loadDashboardData();
    setupEventListeners();
    
    // Refresh data every 5 seconds
    setInterval(loadDashboardData, 5000);
});

function initializeWebSocket() {
    socket = io('http://localhost:3001');
    
    socket.on('connect', () => {
        document.getElementById('connection-status').classList.add('connected');
        console.log('Connected to server');
        
        // Subscribe to channels
        socket.emit('subscribe', {
            channel: 'ticker',
            symbols: ['BTC/USDT', 'ETH/USDT']
        });
    });
    
    socket.on('disconnect', () => {
        document.getElementById('connection-status').classList.remove('connected');
        document.getElementById('connection-status').classList.add('disconnected');
    });
    
    socket.on('trading-signal', (signal) => {
        addSignalToList(signal);
    });
    
    socket.on('position-update', (position) => {
        updatePositionsTable();
    });
    
    socket.on('ticker', (data) => {
        // Update ticker display if needed
    });
}

function initializeChart() {
    const ctx = document.getElementById('equity-chart').getContext('2d');
    equityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Equity',
                data: [],
                borderColor: 'rgb(102, 126, 234)',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)',
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

async function loadDashboardData() {
    try {
        // Load portfolio data
        const [status, balance, positions, performance, trades] = await Promise.all([
            fetch(`${API_URL}/trading/status`).then(r => r.json()),
            fetch(`${API_URL}/portfolio/balance`).then(r => r.json()),
            fetch(`${API_URL}/portfolio/positions`).then(r => r.json()),
            fetch(`${API_URL}/portfolio/performance`).then(r => r.json()),
            fetch(`${API_URL}/portfolio/history?limit=10`).then(r => r.json())
        ]);
        
        updateTradingStatus(status);
        updateBalance(balance);
        updatePositions(positions);
        updatePerformance(performance);
        updateTradesTable(trades);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function updateTradingStatus(status) {
    isTrading = status.isRunning;
    document.getElementById('trading-status').textContent = isTrading ? 'Trading Active' : 'Trading Stopped';
    
    const button = document.getElementById('toggle-trading');
    button.textContent = isTrading ? 'Stop Trading' : 'Start Trading';
    button.className = isTrading ? 'btn btn-danger' : 'btn btn-primary';
}

function updateBalance(balance) {
    const totalValue = Object.entries(balance).reduce((sum, [asset, amount]) => {
        if (asset === 'USDT' || asset === 'USD') {
            return sum + amount;
        }
        // Would need current prices to calculate non-USD values
        return sum;
    }, 0);
    
    document.getElementById('total-value').textContent = `$${totalValue.toFixed(2)}`;
    document.getElementById('available-balance').textContent = `$${(balance.USDT || 0).toFixed(2)}`;
}

function updatePerformance(performance) {
    // Handle undefined or null performance object
    if (!performance) {
        performance = {
            winRate: 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            profitFactor: 0,
            totalPnL: 0
        };
    }
    
    // Update metrics with null checks
    document.getElementById('win-rate').textContent = `${((performance.winRate || 0) * 100).toFixed(1)}%`;
    document.getElementById('sharpe-ratio').textContent = (performance.sharpeRatio || 0).toFixed(2);
    document.getElementById('max-drawdown').textContent = `${((performance.maxDrawdown || 0) * 100).toFixed(1)}%`;
    document.getElementById('profit-factor').textContent = (performance.profitFactor || 0).toFixed(2);
    
    const pnlElement = document.getElementById('pnl');
    const totalPnL = performance.totalPnL || 0;
    pnlElement.textContent = `$${totalPnL.toFixed(2)}`;
    pnlElement.className = totalPnL >= 0 ? 'pnl-value positive' : 'pnl-value negative';
    
    // Update equity chart
    if (equityChart && performance.equityCurve) {
        equityChart.data.labels = performance.equityCurve.map((_, i) => i);
        equityChart.data.datasets[0].data = performance.equityCurve;
        equityChart.update();
    }
}

function updatePositions(positions) {
    updatePositionsTable(positions);
}

function updatePositionsTable(positions) {
    const tbody = document.getElementById('positions-body');
    
    if (!positions || positions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No open positions</td></tr>';
        return;
    }
    
    tbody.innerHTML = positions.map(position => {
        const pnl = position.unrealizedPnl || 0;
        const pnlClass = pnl >= 0 ? 'positive' : 'negative';
        
        return `
            <tr>
                <td>${position.symbol}</td>
                <td>${position.side}</td>
                <td>${position.quantity.toFixed(4)}</td>
                <td>$${position.entryPrice.toFixed(2)}</td>
                <td>$${(position.currentPrice || position.entryPrice).toFixed(2)}</td>
                <td class="pnl-value ${pnlClass}">$${pnl.toFixed(2)}</td>
                <td>
                    <button class="btn btn-close" onclick="closePosition('${position.id}')">Close</button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateTradesTable(trades) {
    const tbody = document.getElementById('trades-body');
    
    if (!trades || trades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No recent trades</td></tr>';
        return;
    }
    
    tbody.innerHTML = trades.map(trade => {
        const pnlClass = trade.pnl >= 0 ? 'positive' : 'negative';
        const time = new Date(trade.timestamp).toLocaleTimeString();
        
        return `
            <tr>
                <td>${time}</td>
                <td>${trade.symbol}</td>
                <td>${trade.side}</td>
                <td>$${trade.exitPrice.toFixed(2)}</td>
                <td>${trade.quantity.toFixed(4)}</td>
                <td class="pnl-value ${pnlClass}">$${trade.pnl.toFixed(2)}</td>
            </tr>
        `;
    }).join('');
}

function addSignalToList(signal) {
    const signalsList = document.getElementById('signals-list');
    
    const signalElement = document.createElement('div');
    signalElement.className = `signal-item ${signal.action.toLowerCase()}`;
    signalElement.innerHTML = `
        <div class="signal-info">
            <div class="signal-symbol">${signal.symbol} - ${signal.action}</div>
            <div class="signal-details">
                Price: $${signal.price.toFixed(2)} | 
                Target: $${signal.targetPrice.toFixed(2)}
            </div>
        </div>
        <div class="signal-confidence">${(signal.confidence * 100).toFixed(0)}%</div>
    `;
    
    signalsList.insertBefore(signalElement, signalsList.firstChild);
    
    // Keep only last 10 signals
    while (signalsList.children.length > 10) {
        signalsList.removeChild(signalsList.lastChild);
    }
}

function setupEventListeners() {
    document.getElementById('toggle-trading').addEventListener('click', async () => {
        try {
            const endpoint = isTrading ? '/trading/stop' : '/trading/start';
            const response = await fetch(`${API_URL}${endpoint}`, { method: 'POST' });
            
            if (response.ok) {
                isTrading = !isTrading;
                loadDashboardData();
            }
        } catch (error) {
            console.error('Error toggling trading:', error);
        }
    });
}

async function closePosition(positionId) {
    if (!confirm('Are you sure you want to close this position?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/portfolio/positions/${positionId}/close`, {
            method: 'POST'
        });
        
        if (response.ok) {
            loadDashboardData();
        }
    } catch (error) {
        console.error('Error closing position:', error);
    }
}