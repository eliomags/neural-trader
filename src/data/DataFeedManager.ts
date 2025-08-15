import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { ExchangeManager } from '../exchanges/ExchangeManager';
import { Logger } from '../utils/Logger';
import { MarketData, Candle } from '../types';
import * as cron from 'node-cron';

export class DataFeedManager extends EventEmitter {
  private logger: Logger;
  private websockets: Map<string, WebSocket> = new Map();
  private dataCache: Map<string, MarketData> = new Map();
  private historicalData: Map<string, Candle[]> = new Map();
  private updateTasks: Map<string, cron.ScheduledTask> = new Map();

  constructor(private exchangeManager: ExchangeManager) {
    super();
    this.logger = new Logger('DataFeedManager');
  }

  async startAllFeeds(): Promise<void> {
    this.logger.info('Starting all data feeds...');

    const symbols = [
      'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT',
      'ADA/USDT', 'XRP/USDT', 'DOT/USDT', 'DOGE/USDT',
      'AVAX/USDT', 'MATIC/USDT'
    ];

    for (const symbol of symbols) {
      await this.startFeed(symbol);
    }

    // Start historical data collection
    this.startHistoricalDataCollection();

    this.logger.info('All data feeds started');
  }

  async startFeed(symbol: string): Promise<void> {
    try {
      // Initialize WebSocket for real-time data
      await this.initWebSocket(symbol);

      // Start periodic data updates
      const task = cron.schedule('*/10 * * * * *', async () => {
        await this.updateMarketData(symbol);
      });

      this.updateTasks.set(symbol, task);

      // Initial data fetch
      await this.updateMarketData(symbol);
      await this.fetchHistoricalData(symbol);

      this.logger.info(`Data feed started for ${symbol}`);
    } catch (error) {
      this.logger.error(`Failed to start feed for ${symbol}:`, error);
    }
  }

  private async initWebSocket(symbol: string): Promise<void> {
    // Skip WebSocket in paper trading mode
    const exchange = this.exchangeManager.getExchange();
    if (exchange.apiKey === 'paper_trading') {
      this.logger.debug(`Skipping WebSocket for ${symbol} in paper trading mode`);
      return;
    }

    const streamName = this.getStreamName(symbol);
    const wsUrl = `wss://stream.binance.com:9443/ws/${streamName}`;

    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      this.logger.debug(`WebSocket connected for ${symbol}`);
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const parsed = JSON.parse(data.toString());
        this.handleWebSocketMessage(symbol, parsed);
      } catch (error) {
        this.logger.error(`WebSocket message parse error for ${symbol}:`, error);
      }
    });

    ws.on('error', (error) => {
      this.logger.error(`WebSocket error for ${symbol}:`, error);
    });

    ws.on('close', () => {
      this.logger.warn(`WebSocket closed for ${symbol}, reconnecting...`);
      setTimeout(() => this.initWebSocket(symbol), 5000);
    });

    this.websockets.set(symbol, ws);
  }

  private getStreamName(symbol: string): string {
    // Convert symbol to Binance stream format
    const formatted = symbol.replace('/', '').toLowerCase();
    return `${formatted}@ticker`;
  }

  private handleWebSocketMessage(symbol: string, data: any): void {
    // Update cache with real-time data
    const currentData = this.dataCache.get(symbol) || this.createEmptyMarketData(symbol);

    currentData.price = parseFloat(data.c || data.price || currentData.price);
    currentData.volume = parseFloat(data.v || data.volume || currentData.volume);
    currentData.timestamp = Date.now();

    this.dataCache.set(symbol, currentData);

    // Emit ticker update
    this.emit('ticker', {
      symbol,
      price: currentData.price,
      volume: currentData.volume,
      timestamp: currentData.timestamp
    });
  }

  private async updateMarketData(symbol: string): Promise<void> {
    try {
      const exchange = this.exchangeManager.getExchange();
      
      // Fetch ticker
      const ticker = await exchange.fetchTicker(symbol);
      
      // Fetch order book
      const orderBook = await exchange.fetchOrderBook(symbol, 20);
      
      // Calculate market metrics
      const volatility = this.calculateVolatility(symbol);
      const indicators = await this.calculateIndicators(symbol);
      
      const marketData: MarketData = {
        symbol,
        price: ticker.last,
        volume: ticker.baseVolume,
        volatility,
        timestamp: Date.now(),
        history: this.historicalData.get(symbol),
        indicators
      };

      this.dataCache.set(symbol, marketData);

      // Emit updates
      this.emit('market-update', marketData);
      this.emit('orderbook', {
        symbol,
        bids: orderBook.bids.slice(0, 10),
        asks: orderBook.asks.slice(0, 10),
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error(`Failed to update market data for ${symbol}:`, error);
    }
  }

  private async fetchHistoricalData(symbol: string): Promise<void> {
    try {
      const exchange = this.exchangeManager.getExchange();
      const ohlcv = await exchange.fetchOHLCV(symbol, '1h', undefined, 500);
      
      const candles: Candle[] = ohlcv.map(([timestamp, open, high, low, close, volume]) => ({
        timestamp,
        open,
        high,
        low,
        close,
        volume
      }));

      this.historicalData.set(symbol, candles);
      this.logger.debug(`Fetched ${candles.length} historical candles for ${symbol}`);
    } catch (error) {
      this.logger.error(`Failed to fetch historical data for ${symbol}:`, error);
    }
  }

  private startHistoricalDataCollection(): void {
    // Update historical data every hour
    cron.schedule('0 * * * *', async () => {
      for (const symbol of this.dataCache.keys()) {
        await this.fetchHistoricalData(symbol);
      }
    });
  }

  private calculateVolatility(symbol: string): number {
    const history = this.historicalData.get(symbol);
    if (!history || history.length < 20) return 0;

    const returns = [];
    for (let i = 1; i < Math.min(20, history.length); i++) {
      const ret = (history[i].close - history[i - 1].close) / history[i - 1].close;
      returns.push(ret);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => {
      return sum + Math.pow(ret - mean, 2);
    }, 0) / returns.length;

    return Math.sqrt(variance);
  }

  private async calculateIndicators(symbol: string): Promise<any> {
    const history = this.historicalData.get(symbol);
    if (!history || history.length < 26) return {};

    const closes = history.map(c => c.close);
    
    return {
      rsi: this.calculateRSI(closes),
      macd: this.calculateMACD(closes),
      bollinger: this.calculateBollingerBands(closes),
      ema: {
        ema12: this.calculateEMA(closes, 12),
        ema26: this.calculateEMA(closes, 26)
      }
    };
  }

  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[]): any {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    const signal = this.calculateEMA([macd], 9);
    
    return {
      macd,
      signal,
      histogram: macd - signal
    };
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    
    const k = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    
    return ema;
  }

  private calculateBollingerBands(prices: number[], period: number = 20): any {
    if (prices.length < period) {
      return { upper: 0, middle: 0, lower: 0 };
    }

    const slice = prices.slice(-period);
    const sma = slice.reduce((a, b) => a + b, 0) / period;
    
    const variance = slice.reduce((sum, price) => {
      return sum + Math.pow(price - sma, 2);
    }, 0) / period;
    
    const stdDev = Math.sqrt(variance);
    
    return {
      upper: sma + (stdDev * 2),
      middle: sma,
      lower: sma - (stdDev * 2)
    };
  }

  async getMarketData(symbol: string): Promise<MarketData> {
    let data = this.dataCache.get(symbol);
    
    if (!data) {
      await this.updateMarketData(symbol);
      data = this.dataCache.get(symbol);
    }
    
    if (!data) {
      throw new Error(`No market data available for ${symbol}`);
    }
    
    return data;
  }

  private createEmptyMarketData(symbol: string): MarketData {
    return {
      symbol,
      price: 0,
      volume: 0,
      volatility: 0,
      timestamp: Date.now(),
      history: [],
      indicators: {}
    };
  }

  async stopFeed(symbol: string): Promise<void> {
    // Stop WebSocket
    const ws = this.websockets.get(symbol);
    if (ws) {
      ws.close();
      this.websockets.delete(symbol);
    }

    // Stop update task
    const task = this.updateTasks.get(symbol);
    if (task) {
      task.stop();
      this.updateTasks.delete(symbol);
    }

    // Clear cache
    this.dataCache.delete(symbol);
    this.historicalData.delete(symbol);

    this.logger.info(`Data feed stopped for ${symbol}`);
  }

  async stopAllFeeds(): Promise<void> {
    this.logger.info('Stopping all data feeds...');

    for (const symbol of this.dataCache.keys()) {
      await this.stopFeed(symbol);
    }

    this.logger.info('All data feeds stopped');
  }

  getActiveFeeds(): string[] {
    return Array.from(this.dataCache.keys());
  }

  getFeedStatus(): any {
    const status: any = {};
    
    for (const [symbol, data] of this.dataCache) {
      status[symbol] = {
        price: data.price,
        volume: data.volume,
        volatility: data.volatility,
        lastUpdate: new Date(data.timestamp).toISOString(),
        historicalDataPoints: this.historicalData.get(symbol)?.length || 0,
        websocketConnected: this.websockets.get(symbol)?.readyState === WebSocket.OPEN
      };
    }
    
    return status;
  }
}