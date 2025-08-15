const API_URL = 'http://localhost:3001/api';
let socket;
let chart;
let currentSymbol = 'AAPL';
let isTrading = false;
let marketStatus = 'closed';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeWebSocket();
    initializeChart();
    checkMarketStatus();
    loadDashboardData();
    setupEventListeners();
    
    // Update market status every minute
    setInterval(checkMarketStatus, 60000);
    
    // Refresh data every 5 seconds when market is open
    setInterval(() => {
        if (marketStatus === 'open') {
            loadDashboardData();
        }
    }, 5000);
});

function initializeWebSocket() {
    socket = io('http://localhost:3001');
    
    socket.on('connect', () => {
        console.log('Connected to server');
        
        // Subscribe to stock updates
        socket.emit('subscribe-stocks', {
            symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA']
        });
    });
    
    socket.on('stock-update', (data) => {
        updateStockPrice(data);
    });
    
    socket.on('trade-executed', (trade) => {
        showNotification(`Trade executed: ${trade.side} ${trade.qty} ${trade.symbol} @ $${trade.price}`);
        loadPositions();
    });
}

function initializeChart() {
    const chartContainer = document.getElementById('stock-chart');
    
    chart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: 400,
        layout: {
            backgroundColor: 'transparent',
            textColor: 'rgba(255, 255, 255, 0.9)',
        },
        grid: {
            vertLines: {
                color: 'rgba(255, 255, 255, 0.05)',
            },
            horzLines: {
                color: 'rgba(255, 255, 255, 0.05)',
            },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
        },
        timeScale: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
            timeVisible: true,
            secondsVisible: false,
        },
    });
    
    const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#4caf50',
        downColor: '#f44336',
        borderDownColor: '#f44336',
        borderUpColor: '#4caf50',
        wickDownColor: '#f44336',
        wickUpColor: '#4caf50',
    });
    
    // Load initial chart data
    loadChartData(currentSymbol);
}

async function loadChartData(symbol) {
    try {
        const response = await fetch(`${API_URL}/stocks/candles/${symbol}?timeframe=1D`);
        const data = await response.json();
        
        const chartData = data.map(candle => ({
            time: candle.timestamp / 1000,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
        }));
        
        chart.candlestickSeries().setData(chartData);
    } catch (error) {
        console.error('Error loading chart data:', error);
    }
}

async function checkMarketStatus() {
    try {
        const response = await fetch(`${API_URL}/stocks/market/status`);
        const data = await response.json();
        
        marketStatus = data.isOpen ? 'open' : 'closed';
        
        const indicator = document.getElementById('market-status-indicator');
        const text = document.getElementById('market-status-text');
        const time = document.getElementById('market-time');
        
        indicator.className = `status-indicator ${marketStatus}`;
        text.textContent = marketStatus === 'open' ? 'Market Open' : 'Market Closed';
        
        if (marketStatus === 'open') {
            time.textContent = `Closes at ${data.closeTime}`;
        } else {
            time.textContent = `Opens at ${data.nextOpen}`;
        }
    } catch (error) {
        console.error('Error checking market status:', error);
    }
}

async function loadDashboardData() {
    try {
        await Promise.all([
            loadIndices(),
            loadAccount(),
            loadPositions(),
            loadWatchlist(),
            updateSectorPerformance()
        ]);
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

async function loadIndices() {
    try {
        // Load major indices
        const indices = await Promise.all([
            fetch(`${API_URL}/stocks/quote/SPY`).then(r => r.json()),
            fetch(`${API_URL}/stocks/quote/QQQ`).then(r => r.json()),
            fetch(`${API_URL}/stocks/quote/DIA`).then(r => r.json()),
            fetch(`${API_URL}/stocks/quote/VIX`).then(r => r.json())
        ]);
        
        updateIndex('sp500', indices[0]);
        updateIndex('nasdaq', indices[1]);
        updateIndex('dow', indices[2]);
        updateIndex('vix', indices[3]);
    } catch (error) {
        console.error('Error loading indices:', error);
    }
}

function updateIndex(id, data) {
    const element = document.getElementById(id);
    if (element && data) {
        element.textContent = data.price.toFixed(2);
        const changeElement = element.parentElement.querySelector('.index-change');
        if (changeElement) {
            changeElement.textContent = `${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%`;
            changeElement.className = `index-change ${data.changePercent >= 0 ? 'positive' : 'negative'}`;
        }
    }
}

async function loadAccount() {
    try {
        const response = await fetch(`${API_URL}/stocks/account`);
        const account = await response.json();
        
        document.getElementById('portfolio-value').textContent = `$${account.portfolio_value.toFixed(2)}`;
        document.getElementById('buying-power').textContent = `$${account.buying_power.toFixed(2)}`;
        
        const dayPnl = document.getElementById('day-pnl');
        dayPnl.textContent = `${account.day_pnl >= 0 ? '+' : ''}$${Math.abs(account.day_pnl).toFixed(2)}`;
        dayPnl.className = `pnl-value ${account.day_pnl >= 0 ? 'positive' : 'negative'}`;
        
        const totalPnl = document.getElementById('total-pnl');
        totalPnl.textContent = `${account.total_pnl >= 0 ? '+' : ''}$${Math.abs(account.total_pnl).toFixed(2)}`;
        totalPnl.className = `pnl-value ${account.total_pnl >= 0 ? 'positive' : 'negative'}`;
    } catch (error) {
        console.error('Error loading account:', error);
    }
}

async function loadPositions() {
    try {
        const response = await fetch(`${API_URL}/stocks/positions`);
        const positions = await response.json();
        
        const tbody = document.getElementById('positions-body');
        
        if (positions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; opacity: 0.5;">No open positions</td></tr>';
            return;
        }
        
        tbody.innerHTML = positions.map(position => {
            const pnl = position.unrealized_pl;
            const pnlPercent = position.unrealized_plpc * 100;
            const pnlClass = pnl >= 0 ? 'positive' : 'negative';
            
            return `
                <tr>
                    <td>${position.symbol}</td>
                    <td>${position.qty}</td>
                    <td>$${position.avg_entry_price.toFixed(2)}</td>
                    <td>$${position.current_price.toFixed(2)}</td>
                    <td class="${pnlClass}">${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(2)}</td>
                    <td class="${pnlClass}">${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%</td>
                    <td>$${position.market_value.toFixed(2)}</td>
                    <td>
                        <button class="btn btn-small btn-sell" onclick="sellPosition('${position.symbol}', ${position.qty})">Sell</button>
                        <button class="btn btn-small" onclick="addToPosition('${position.symbol}')">Add</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading positions:', error);
    }
}

async function loadWatchlist() {
    try {
        const response = await fetch(`${API_URL}/stocks/watchlist`);
        const watchlist = await response.json();
        
        // Update watchlist UI
        updateWatchlistDisplay(watchlist);
    } catch (error) {
        console.error('Error loading watchlist:', error);
    }
}

function updateWatchlistDisplay(stocks) {
    const container = document.querySelector('.watchlist-grid');
    
    container.innerHTML = stocks.map(stock => {
        const changeClass = stock.change >= 0 ? 'positive' : 'negative';
        const signalClass = stock.signal?.action.toLowerCase() || 'hold';
        
        return `
            <div class="watchlist-item" onclick="selectStock('${stock.symbol}')">
                <div class="stock-info">
                    <span class="symbol">${stock.symbol}</span>
                    <span class="company">${stock.name}</span>
                </div>
                <div class="stock-price">
                    <span class="price">$${stock.price.toFixed(2)}</span>
                    <span class="change ${changeClass}">${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%</span>
                </div>
                <div class="stock-signals">
                    <span class="signal-badge ${signalClass}">${stock.signal?.action || 'HOLD'}</span>
                    <span class="confidence">${stock.signal ? (stock.signal.confidence * 100).toFixed(0) + '%' : '-'}</span>
                </div>
            </div>
        `;
    }).join('');
}

async function updateSectorPerformance() {
    try {
        const response = await fetch(`${API_URL}/stocks/sectors`);
        const sectors = await response.json();
        
        const container = document.querySelector('.sector-grid');
        
        container.innerHTML = Object.entries(sectors).map(([name, performance]) => {
            const perfClass = performance >= 0 ? 'positive' : 'negative';
            
            return `
                <div class="sector-item ${perfClass}">
                    <span>${name}</span>
                    <strong>${performance >= 0 ? '+' : ''}${performance.toFixed(2)}%</strong>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error updating sectors:', error);
    }
}

function setupEventListeners() {
    // Trading toggle
    document.getElementById('toggle-trading').addEventListener('click', toggleTrading);
    
    // Chart controls
    document.getElementById('chart-symbol').addEventListener('change', (e) => {
        currentSymbol = e.target.value.toUpperCase();
        loadChartData(currentSymbol);
        analyzeStock(currentSymbol);
    });
    
    document.getElementById('chart-timeframe').addEventListener('change', (e) => {
        loadChartData(currentSymbol);
    });
    
    // Chart type buttons
    document.querySelectorAll('.chart-type').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-type').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            // Change chart type
        });
    });
    
    // Analysis tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            document.getElementById(`${tabName}-analysis`).classList.add('active');
        });
    });
    
    // Order form
    document.getElementById('order-quantity').addEventListener('input', calculateOrderTotal);
    document.getElementById('order-price').addEventListener('input', calculateOrderTotal);
}

async function toggleTrading() {
    try {
        const endpoint = isTrading ? '/stocks/trading/stop' : '/stocks/trading/start';
        const response = await fetch(`${API_URL}${endpoint}`, { method: 'POST' });
        
        if (response.ok) {
            isTrading = !isTrading;
            const btn = document.getElementById('toggle-trading');
            btn.textContent = isTrading ? 'Stop Trading' : 'Start Trading';
            btn.className = isTrading ? 'btn btn-danger' : 'btn btn-primary';
            
            showNotification(`Trading ${isTrading ? 'started' : 'stopped'}`);
        }
    } catch (error) {
        console.error('Error toggling trading:', error);
    }
}

async function selectStock(symbol) {
    currentSymbol = symbol;
    document.getElementById('chart-symbol').value = symbol;
    loadChartData(symbol);
    await analyzeStock(symbol);
}

async function analyzeStock(symbol) {
    try {
        const response = await fetch(`${API_URL}/stocks/analyze/${symbol}`);
        const analysis = await response.json();
        
        // Update fundamental analysis
        updateFundamentals(analysis.fundamentals);
        
        // Update technical analysis
        updateTechnicals(analysis.technicals);
        
        // Update sentiment
        updateSentiment(analysis.sentiment);
    } catch (error) {
        console.error('Error analyzing stock:', error);
    }
}

function updateFundamentals(data) {
    if (!data) return;
    
    const container = document.querySelector('.fundamental-grid');
    const metrics = ['pe', 'marketCap', 'eps', 'dividendYield', 'beta', 'roe'];
    
    container.innerHTML = metrics.map(metric => `
        <div class="fundamental-item">
            <span>${formatMetricName(metric)}</span>
            <strong>${formatMetricValue(metric, data[metric])}</strong>
        </div>
    `).join('');
}

function updateTechnicals(data) {
    // Update technical indicators display
}

function updateSentiment(data) {
    // Update sentiment display
}

function formatMetricName(metric) {
    const names = {
        pe: 'P/E Ratio',
        marketCap: 'Market Cap',
        eps: 'EPS',
        dividendYield: 'Dividend Yield',
        beta: 'Beta',
        roe: 'ROE'
    };
    return names[metric] || metric;
}

function formatMetricValue(metric, value) {
    if (value === null || value === undefined) return 'N/A';
    
    switch(metric) {
        case 'marketCap':
            return formatMarketCap(value);
        case 'dividendYield':
        case 'roe':
            return `${(value * 100).toFixed(2)}%`;
        case 'eps':
            return `$${value.toFixed(2)}`;
        default:
            return value.toFixed(2);
    }
}

function formatMarketCap(value) {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toFixed(0)}`;
}

async function placeOrder(side) {
    const symbol = document.getElementById('order-symbol').value;
    const quantity = document.getElementById('order-quantity').value;
    const orderType = document.getElementById('order-type').value;
    const price = document.getElementById('order-price').value;
    const tif = document.getElementById('order-tif').value;
    
    if (!symbol || !quantity) {
        showNotification('Please enter symbol and quantity', 'error');
        return;
    }
    
    const order = {
        symbol: symbol.toUpperCase(),
        qty: parseInt(quantity),
        side,
        type: orderType,
        time_in_force: tif
    };
    
    if (orderType === 'limit' || orderType === 'stop_limit') {
        order.limit_price = parseFloat(price);
    }
    
    try {
        const response = await fetch(`${API_URL}/stocks/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order)
        });
        
        if (response.ok) {
            showNotification(`Order placed: ${side.toUpperCase()} ${quantity} ${symbol}`);
            clearOrderForm();
            loadPositions();
        } else {
            const error = await response.json();
            showNotification(`Order failed: ${error.message}`, 'error');
        }
    } catch (error) {
        console.error('Error placing order:', error);
        showNotification('Failed to place order', 'error');
    }
}

function calculateOrderTotal() {
    const quantity = parseFloat(document.getElementById('order-quantity').value) || 0;
    const price = parseFloat(document.getElementById('order-price').value) || 0;
    const total = quantity * price;
    
    document.getElementById('order-total').textContent = `$${total.toFixed(2)}`;
}

function clearOrderForm() {
    document.getElementById('order-symbol').value = '';
    document.getElementById('order-quantity').value = '';
    document.getElementById('order-price').value = '';
    document.getElementById('order-total').textContent = '$0.00';
}

async function sellPosition(symbol, qty) {
    if (!confirm(`Sell ${qty} shares of ${symbol}?`)) return;
    
    await placeOrder('sell');
}

function addToPosition(symbol) {
    document.getElementById('order-symbol').value = symbol;
    document.getElementById('order-quantity').focus();
}

function addToWatchlist() {
    const symbol = prompt('Enter stock symbol:');
    if (symbol) {
        // Add to watchlist via API
        fetch(`${API_URL}/stocks/watchlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: symbol.toUpperCase() })
        }).then(() => loadWatchlist());
    }
}

function updateStockPrice(data) {
    // Update real-time stock prices in UI
}

function showNotification(message, type = 'success') {
    // Create and show notification
    console.log(`[${type}] ${message}`);
}