import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger';
import { StockExchangeManager } from './StockExchangeManager';
import { StockAnalyzer, StockSignal } from './StockAnalyzer';
import * as cron from 'node-cron';

export class StockTradingEngine extends EventEmitter {
  private logger: Logger;
  private isRunning: boolean = false;
  private exchangeManager: StockExchangeManager;
  private analyzer: StockAnalyzer;
  private watchlist: string[] = [];
  private signalQueue: StockSignal[] = [];
  private scanTask: cron.ScheduledTask | null = null;
  private executeTask: cron.ScheduledTask | null = null;

  constructor() {
    super();
    this.logger = new Logger('StockTradingEngine');
    this.exchangeManager = new StockExchangeManager();
    this.analyzer = new StockAnalyzer();
    this.initializeWatchlist();
  }

  private initializeWatchlist(): void {
    // Default watchlist - top tech stocks
    this.watchlist = [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META',
      'NVDA', 'TSLA', 'AMD', 'INTC', 'NFLX',
      'JPM', 'BAC', 'V', 'MA', 'WMT',
      'JNJ', 'PG', 'UNH', 'HD', 'DIS'
    ];
  }

  async initialize(): Promise<void> {
    await this.exchangeManager.initialize();
    this.logger.info('Stock trading engine initialized');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Stock trading engine already running');
      return;
    }

    this.logger.info('Starting stock trading engine...');
    this.isRunning = true;

    // Check market hours before starting
    const marketHours = await this.exchangeManager.getMarketHours();
    if (!marketHours.isOpen) {
      this.logger.info(`Market is closed. Will start at ${marketHours.openTime}`);
      this.scheduleMarketOpen(marketHours.openTime);
      return;
    }

    // Start scanning for opportunities (every 5 minutes during market hours)
    this.scanTask = cron.schedule('*/5 9-16 * * 1-5', async () => {
      await this.scanForOpportunities();
    });

    // Execute signals (every minute during market hours)
    this.executeTask = cron.schedule('* 9-16 * * 1-5', async () => {
      await this.executeQueuedSignals();
    });

    // Initial scan
    await this.scanForOpportunities();

    this.logger.info('Stock trading engine started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Stock trading engine not running');
      return;
    }

    this.logger.info('Stopping stock trading engine...');
    this.isRunning = false;

    if (this.scanTask) {
      this.scanTask.stop();
    }

    if (this.executeTask) {
      this.executeTask.stop();
    }

    this.logger.info('Stock trading engine stopped');
  }

  private scheduleMarketOpen(openTime: string): void {
    // Schedule engine to start at market open
    const [hour, minute] = openTime.split(':').map(Number);
    
    cron.schedule(`${minute} ${hour} * * 1-5`, async () => {
      if (!this.isRunning) return;
      await this.start();
    });
  }

  private async scanForOpportunities(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.debug('Scanning for trading opportunities...');

    for (const symbol of this.watchlist) {
      try {
        // Analyze each stock
        const signal = await this.analyzer.analyzeStock(symbol);
        
        if (signal && signal.confidence > 0.7) {
          // Check if we should act on this signal
          const shouldTrade = await this.validateSignal(signal);
          
          if (shouldTrade) {
            this.signalQueue.push(signal);
            this.emit('signal', signal);
            this.logger.info(`Signal generated for ${symbol}: ${signal.action} (${(signal.confidence * 100).toFixed(1)}%)`);
          }
        }
      } catch (error) {
        this.logger.error(`Error analyzing ${symbol}:`, error);
      }
    }

    // Also scan for new opportunities
    await this.discoverNewStocks();
  }

  private async validateSignal(signal: StockSignal): Promise<boolean> {
    // Check existing positions
    const positions = await this.exchangeManager.getPositions();
    const hasPosition = positions.some(p => p.symbol === signal.symbol);
    
    // Don't duplicate positions
    if (hasPosition && signal.action === 'BUY') {
      return false;
    }
    
    // Check account constraints
    const account = await this.exchangeManager.getAccount();
    const buyingPower = account.buying_power || account.cash;
    
    // Need sufficient buying power
    if (signal.action === 'BUY' && buyingPower < 1000) {
      this.logger.warn('Insufficient buying power');
      return false;
    }
    
    // Additional validation rules
    if (signal.confidence < 0.65) return false;
    if (signal.fundamentalScore < 40) return false;
    if (signal.technicalScore < 40) return false;
    
    return true;
  }

  private async executeQueuedSignals(): Promise<void> {
    if (!this.isRunning || this.signalQueue.length === 0) return;

    while (this.signalQueue.length > 0) {
      const signal = this.signalQueue.shift();
      if (!signal) continue;

      try {
        // Check if signal is still valid (not stale)
        const age = Date.now() - (signal.timestamp || 0);
        if (age > 300000) { // 5 minutes
          this.logger.warn(`Signal for ${signal.symbol} expired`);
          continue;
        }

        // Execute the trade
        await this.executeTrade(signal);
      } catch (error) {
        this.logger.error(`Error executing signal for ${signal.symbol}:`, error);
      }
    }
  }

  private async executeTrade(signal: StockSignal): Promise<void> {
    const quote = await this.exchangeManager.getQuote(signal.symbol);
    const currentPrice = quote.price;
    
    // Calculate position size
    const account = await this.exchangeManager.getAccount();
    const buyingPower = account.buying_power || account.cash;
    const positionSize = this.calculatePositionSize(buyingPower, signal);
    
    if (positionSize === 0) {
      this.logger.warn(`Position size is 0 for ${signal.symbol}`);
      return;
    }

    const order = {
      symbol: signal.symbol,
      qty: positionSize,
      side: signal.action.toLowerCase() as 'buy' | 'sell',
      type: 'limit' as const,
      time_in_force: 'day' as const,
      limit_price: currentPrice * (signal.action === 'BUY' ? 1.001 : 0.999) // Slight buffer
    };

    try {
      const result = await this.exchangeManager.createOrder(order);
      
      this.logger.info(`Order placed for ${signal.symbol}: ${order.side} ${order.qty} @ $${order.limit_price}`);
      this.emit('order-placed', { signal, order, result });
      
      // Set stop loss and take profit
      if (signal.action === 'BUY') {
        await this.setProtectionOrders(signal.symbol, positionSize, signal);
      }
    } catch (error) {
      this.logger.error(`Failed to execute trade for ${signal.symbol}:`, error);
    }
  }

  private calculatePositionSize(buyingPower: number, signal: StockSignal): number {
    // Risk 2% per trade
    const riskAmount = buyingPower * 0.02;
    
    // Adjust based on confidence
    const confidenceMultiplier = signal.confidence;
    
    // Calculate shares
    const targetValue = riskAmount * confidenceMultiplier;
    const sharePrice = signal.targetPrice || 100; // Need current price
    let shares = Math.floor(targetValue / sharePrice);
    
    // Min/max constraints
    shares = Math.max(1, Math.min(shares, 100));
    
    return shares;
  }

  private async setProtectionOrders(symbol: string, qty: number, signal: StockSignal): Promise<void> {
    try {
      // Stop loss order
      if (signal.stopLoss) {
        await this.exchangeManager.createOrder({
          symbol,
          qty,
          side: 'sell',
          type: 'stop',
          time_in_force: 'gtc',
          stop_price: signal.stopLoss
        });
      }

      // Take profit order (using limit order)
      if (signal.targetPrice) {
        await this.exchangeManager.createOrder({
          symbol,
          qty,
          side: 'sell',
          type: 'limit',
          time_in_force: 'gtc',
          limit_price: signal.targetPrice
        });
      }

      this.logger.debug(`Protection orders set for ${symbol}`);
    } catch (error) {
      this.logger.error(`Failed to set protection orders for ${symbol}:`, error);
    }
  }

  private async discoverNewStocks(): Promise<void> {
    try {
      // Screen for stocks meeting criteria
      const criteria = {
        minConfidence: 0.75,
        action: 'BUY',
        minFundamental: 60,
        minTechnical: 60
      };

      const candidates = await this.analyzer.screenStocks(criteria);
      
      // Add high-confidence stocks to watchlist
      for (const symbol of candidates) {
        if (!this.watchlist.includes(symbol)) {
          this.watchlist.push(symbol);
          this.logger.info(`Added ${symbol} to watchlist`);
        }
      }
    } catch (error) {
      this.logger.error('Error discovering new stocks:', error);
    }
  }

  async addToWatchlist(symbol: string): Promise<void> {
    if (!this.watchlist.includes(symbol)) {
      this.watchlist.push(symbol);
      this.emit('watchlist-updated', this.watchlist);
    }
  }

  async removeFromWatchlist(symbol: string): Promise<void> {
    const index = this.watchlist.indexOf(symbol);
    if (index > -1) {
      this.watchlist.splice(index, 1);
      this.emit('watchlist-updated', this.watchlist);
    }
  }

  getWatchlist(): string[] {
    return [...this.watchlist];
  }

  async getStatus(): Promise<any> {
    const marketHours = await this.exchangeManager.getMarketHours();
    const account = await this.exchangeManager.getAccount();
    const positions = await this.exchangeManager.getPositions();
    
    return {
      isRunning: this.isRunning,
      marketStatus: marketHours,
      account: {
        buyingPower: account.buying_power,
        portfolioValue: account.portfolio_value,
        dayPnl: account.unrealized_pl
      },
      positions: positions.length,
      watchlistSize: this.watchlist.length,
      pendingSignals: this.signalQueue.length
    };
  }
}