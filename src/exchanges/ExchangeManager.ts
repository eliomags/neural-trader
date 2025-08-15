import ccxt from 'ccxt';
import { Logger } from '../utils/Logger';
import { ExchangeConfig, OrderType, OrderSide } from '../types';

export class ExchangeManager {
  private logger: Logger;
  private exchanges: Map<string, any> = new Map();
  private activeExchange: string = 'binance';

  constructor() {
    this.logger = new Logger('ExchangeManager');
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing exchange connections...');

    try {
      // Initialize Binance
      if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET) {
        const binance = new ccxt.binance({
          apiKey: process.env.BINANCE_API_KEY,
          secret: process.env.BINANCE_SECRET,
          enableRateLimit: true,
          options: {
            defaultType: 'spot',
            adjustForTimeDifference: true
          }
        });
        await this.testConnection(binance, 'Binance');
        this.exchanges.set('binance', binance);
      }

      // Initialize Coinbase
      if (process.env.COINBASE_API_KEY && process.env.COINBASE_SECRET) {
        const coinbase = new ccxt.coinbase({
          apiKey: process.env.COINBASE_API_KEY,
          secret: process.env.COINBASE_SECRET,
          enableRateLimit: true
        });
        await this.testConnection(coinbase, 'Coinbase');
        this.exchanges.set('coinbase', coinbase);
      }

      // Initialize Kraken
      if (process.env.KRAKEN_API_KEY && process.env.KRAKEN_SECRET) {
        const kraken = new ccxt.kraken({
          apiKey: process.env.KRAKEN_API_KEY,
          secret: process.env.KRAKEN_SECRET,
          enableRateLimit: true
        });
        await this.testConnection(kraken, 'Kraken');
        this.exchanges.set('kraken', kraken);
      }

      // Initialize paper trading exchange for testing
      this.initializePaperTrading();

      this.logger.info(`Initialized ${this.exchanges.size} exchanges`);
    } catch (error) {
      this.logger.error('Failed to initialize exchanges:', error);
      throw error;
    }
  }

  private initializePaperTrading(): void {
    // Create a mock exchange for paper trading
    const paperExchange = new ccxt.binance({
      apiKey: 'paper_trading',
      secret: 'paper_trading',
      enableRateLimit: true,
      options: {
        defaultType: 'spot'
      }
    });

    // Override methods for paper trading
    paperExchange.createOrder = this.createPaperOrder.bind(this);
    paperExchange.fetchBalance = this.fetchPaperBalance.bind(this);
    paperExchange.fetchTicker = this.fetchPaperTicker.bind(this);
    paperExchange.fetchOrderBook = this.fetchPaperOrderBook.bind(this);
    
    this.exchanges.set('paper', paperExchange);
    this.activeExchange = 'paper'; // Default to paper trading
    this.logger.info('Paper trading exchange initialized');
  }

  private async testConnection(exchange: any, name: string): Promise<void> {
    try {
      await exchange.loadMarkets();
      const balance = await exchange.fetchBalance();
      this.logger.info(`${name} connection successful`);
    } catch (error) {
      this.logger.warn(`${name} connection failed:`, error);
    }
  }

  getExchange(name?: string): any {
    const exchangeName = name || this.activeExchange;
    const exchange = this.exchanges.get(exchangeName);
    
    if (!exchange) {
      throw new Error(`Exchange ${exchangeName} not found`);
    }
    
    return exchange;
  }

  setActiveExchange(name: string): void {
    if (!this.exchanges.has(name)) {
      throw new Error(`Exchange ${name} not available`);
    }
    this.activeExchange = name;
    this.logger.info(`Active exchange set to ${name}`);
  }

  async getBalance(exchange?: string): Promise<any> {
    const ex = this.getExchange(exchange);
    return await ex.fetchBalance();
  }

  async getTicker(symbol: string, exchange?: string): Promise<any> {
    const ex = this.getExchange(exchange);
    return await ex.fetchTicker(symbol);
  }

  async getOrderBook(symbol: string, limit: number = 10, exchange?: string): Promise<any> {
    const ex = this.getExchange(exchange);
    return await ex.fetchOrderBook(symbol, limit);
  }

  async getOHLCV(
    symbol: string,
    timeframe: string = '1h',
    limit: number = 100,
    exchange?: string
  ): Promise<any[]> {
    const ex = this.getExchange(exchange);
    return await ex.fetchOHLCV(symbol, timeframe, undefined, limit);
  }

  async createOrder(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number,
    params?: any,
    exchange?: string
  ): Promise<any> {
    const ex = this.getExchange(exchange);
    return await ex.createOrder(symbol, type, side, amount, price, params);
  }

  async cancelOrder(orderId: string, symbol: string, exchange?: string): Promise<any> {
    const ex = this.getExchange(exchange);
    return await ex.cancelOrder(orderId, symbol);
  }

  async getOpenOrders(symbol?: string, exchange?: string): Promise<any[]> {
    const ex = this.getExchange(exchange);
    return await ex.fetchOpenOrders(symbol);
  }

  async getOrderHistory(symbol?: string, limit?: number, exchange?: string): Promise<any[]> {
    const ex = this.getExchange(exchange);
    return await ex.fetchClosedOrders(symbol, undefined, limit);
  }

  // Paper trading methods
  private paperBalance: any = {
    USDT: { free: 10000, used: 0, total: 10000 },
    BTC: { free: 0, used: 0, total: 0 },
    ETH: { free: 0, used: 0, total: 0 }
  };

  private paperOrders: any[] = [];
  private paperOrderId: number = 1;

  private async createPaperOrder(
    symbol: string,
    type: string,
    side: string,
    amount: number,
    price?: number,
    params?: any
  ): Promise<any> {
    const orderId = `paper_${this.paperOrderId++}`;
    const timestamp = Date.now();
    
    const order = {
      id: orderId,
      clientOrderId: orderId,
      timestamp,
      datetime: new Date(timestamp).toISOString(),
      lastTradeTimestamp: timestamp,
      symbol,
      type,
      side,
      price: price || 0,
      amount,
      cost: (price || 0) * amount,
      average: price || 0,
      filled: type === 'market' ? amount : 0,
      remaining: type === 'market' ? 0 : amount,
      status: type === 'market' ? 'closed' : 'open',
      fee: {
        cost: amount * 0.001,
        currency: 'USDT'
      },
      trades: []
    };

    // Update paper balance
    if (type === 'market') {
      const [base, quote] = symbol.split('/');
      if (side === 'buy') {
        this.paperBalance[quote].free -= order.cost;
        this.paperBalance[base].free += amount;
      } else {
        this.paperBalance[base].free -= amount;
        this.paperBalance[quote].free += order.cost;
      }
    }

    this.paperOrders.push(order);
    this.logger.info(`Paper order created: ${orderId}`);
    
    return order;
  }

  private async fetchPaperBalance(): Promise<any> {
    return this.paperBalance;
  }

  private async fetchPaperTicker(symbol: string): Promise<any> {
    // Return mock ticker data
    const basePrice = symbol.includes('BTC') ? 45000 : 
                     symbol.includes('ETH') ? 3000 : 100;
    
    return {
      symbol,
      timestamp: Date.now(),
      datetime: new Date().toISOString(),
      high: basePrice * 1.02,
      low: basePrice * 0.98,
      bid: basePrice * 0.999,
      bidVolume: 100,
      ask: basePrice * 1.001,
      askVolume: 100,
      vwap: basePrice,
      open: basePrice * 0.99,
      close: basePrice,
      last: basePrice,
      previousClose: basePrice * 0.99,
      change: basePrice * 0.01,
      percentage: 1,
      average: basePrice,
      baseVolume: 10000,
      quoteVolume: basePrice * 10000
    };
  }

  private async fetchPaperOrderBook(symbol: string, limit: number = 10): Promise<any> {
    const basePrice = symbol.includes('BTC') ? 45000 : 
                     symbol.includes('ETH') ? 3000 : 100;
    
    const bids: any[] = [];
    const asks: any[] = [];
    
    for (let i = 0; i < limit; i++) {
      bids.push([
        basePrice * (0.999 - i * 0.001),
        Math.random() * 10
      ]);
      asks.push([
        basePrice * (1.001 + i * 0.001),
        Math.random() * 10
      ]);
    }
    
    return {
      symbol,
      bids,
      asks,
      timestamp: Date.now(),
      datetime: new Date().toISOString(),
      nonce: Date.now()
    };
  }

  getSupportedExchanges(): string[] {
    return Array.from(this.exchanges.keys());
  }

  getExchangeStatus(): any {
    const status: any = {};
    
    for (const [name, exchange] of this.exchanges) {
      status[name] = {
        connected: exchange.apiKey ? true : false,
        rateLimit: exchange.rateLimit,
        enableRateLimit: exchange.enableRateLimit,
        markets: exchange.markets ? Object.keys(exchange.markets).length : 0
      };
    }
    
    return status;
  }
}