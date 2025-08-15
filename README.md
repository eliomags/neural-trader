# Neural Trader v3.0.0

Advanced ML-powered trading system for both cryptocurrency and stock markets, featuring neural network predictions, real-time data feeds, and sophisticated risk management.

## Features

### 🪙 Cryptocurrency Trading
- **Multi-Exchange Support**: Binance, Coinbase, Kraken integration
- **24/7 Trading**: Continuous market monitoring and execution
- **Real-time WebSocket**: Live price feeds and order updates
- **Crypto-specific Strategies**: Volatility-based trading algorithms

### 📈 Stock Market Trading
- **Broker Integration**: Alpaca, Interactive Brokers, TD Ameritrade support
- **Market Hours Aware**: Automatic scheduling for market sessions
- **Fundamental Analysis**: P/E ratios, earnings, financial metrics
- **Sector Analysis**: Track and trade sector rotations
- **Options Support**: Basic options chain analysis
- **News Sentiment**: Real-time news analysis for trading signals
- **Regulatory Compliance**: PDT rules, settlement tracking

### 🧠 Machine Learning
- **Neural Network Predictions**: LSTM-based models with ensemble learning
- **Adaptive Learning**: Models update based on market conditions
- **Multi-timeframe Analysis**: 1m to 1d predictions
- **Pattern Recognition**: Candlestick and chart pattern detection

### 💼 Portfolio Management
- **Unified Dashboard**: Monitor crypto and stocks in one place
- **Risk Management**: Kelly Criterion, position sizing, correlation analysis
- **Performance Tracking**: Real-time P&L, Sharpe ratio, drawdown metrics
- **Automated Rebalancing**: Maintain target allocations

### 🛠️ Additional Features
- **Backtesting Engine**: Test strategies on historical data
- **Paper Trading**: Risk-free testing environment
- **Technical Indicators**: 20+ indicators including RSI, MACD, Bollinger Bands
- **API Integration**: RESTful API for external tools
- **Real-time Alerts**: Telegram, Discord, email notifications

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Redis (optional, for caching)
- PostgreSQL (optional, uses SQLite by default)

### Installation

1. Clone the repository:
```bash
cd neural-trader
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your exchange API keys
```

4. Build the project:
```bash
npm run build
```

5. Start the trader:
```bash
npm start
```

The dashboards will be available at:
- Crypto Trading: http://localhost:3000
- Stock Trading: http://localhost:3000/stocks.html

## Configuration

### Exchange Setup

#### Cryptocurrency Exchanges
Add your crypto exchange API keys to the `.env` file:

```env
BINANCE_API_KEY=your_api_key
BINANCE_SECRET=your_secret_key
COINBASE_API_KEY=your_api_key
COINBASE_SECRET=your_secret_key
```

#### Stock Brokers
Add your stock broker API keys:

```env
# Alpaca (recommended for beginners - free paper trading)
ALPACA_KEY_ID=your_alpaca_key
ALPACA_SECRET_KEY=your_alpaca_secret
ALPACA_PAPER=true  # Set to false for live trading

# Market Data Providers
FINNHUB_API_KEY=your_finnhub_key
POLYGON_API_KEY=your_polygon_key
```

### Trading Configuration

Edit `config/trading.json` to customize:
- Trading pairs
- Risk parameters
- ML model settings
- Notification preferences

## Usage

### Starting Trading

```bash
# Start in paper trading mode (default)
npm start

# Start in live trading mode
TRADING_MODE=live npm start
```

### Training Models

```bash
npm run train
```

### Running Backtest

```bash
npm run backtest
```

### Development Mode

```bash
npm run dev
```

## Architecture

```
neural-trader/
├── src/
│   ├── core/           # Trading engine core
│   ├── ml/             # Neural network models
│   ├── exchanges/      # Exchange integrations
│   ├── risk/           # Risk management
│   ├── data/           # Data feed management
│   ├── portfolio/      # Portfolio management
│   ├── analysis/       # Technical analysis
│   ├── api/            # REST API
│   ├── database/       # Database models
│   └── utils/          # Utilities
├── models/             # Trained ML models
├── public/             # Web dashboard
├── config/             # Configuration files
└── logs/              # Application logs
```

## API Endpoints

- `GET /api/trading/status` - Trading engine status
- `POST /api/trading/start` - Start trading
- `POST /api/trading/stop` - Stop trading
- `GET /api/portfolio/balance` - Account balance
- `GET /api/portfolio/positions` - Open positions
- `GET /api/portfolio/performance` - Performance metrics
- `GET /api/signals/recent` - Recent trading signals
- `GET /api/market/:symbol/ticker` - Market ticker
- `POST /api/backtest/run` - Run backtest

## Risk Management

The system implements multiple risk controls:

- Maximum position size limits
- Stop-loss and take-profit orders
- Maximum drawdown protection
- Position correlation analysis
- Kelly Criterion position sizing
- Dynamic risk adjustment based on performance

## ML Models

The neural predictor uses:

- LSTM networks for time series prediction
- Ensemble learning combining multiple timeframes
- Online learning for model updates
- Technical indicators as features
- Pattern recognition for signal validation

## Safety Features

- Paper trading mode for testing
- Automatic position closing on shutdown
- Rate limiting on API calls
- Maximum open positions limit
- Drawdown-based trading suspension

## Performance Metrics

- Sharpe Ratio
- Win Rate
- Profit Factor
- Maximum Drawdown
- Value at Risk (VaR)
- Beta calculation

## Troubleshooting

### Common Issues

1. **Connection errors**: Check API keys and network connectivity
2. **Model loading fails**: Run `npm run train` to generate models
3. **Database errors**: Ensure write permissions for `data/` directory
4. **WebSocket disconnects**: Check firewall settings

### Logs

Check logs in the `logs/` directory:
- `combined.log` - All application logs
- `error.log` - Error logs only

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Type Checking

```bash
npm run typecheck
```

## Security

- Never commit API keys to version control
- Use environment variables for sensitive data
- Enable 2FA on exchange accounts
- Regularly rotate API keys
- Monitor for unusual activity

## Disclaimer

This software is for educational purposes. Cryptocurrency trading carries significant risk. Always test strategies in paper trading mode before using real funds. The authors are not responsible for any financial losses.

## License

MIT

## Support

For issues and questions, please open a GitHub issue.