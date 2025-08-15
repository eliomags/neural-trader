import { Logger } from '../utils/Logger';
import axios from 'axios';
import WebSocket from 'ws';

interface StockOrder {
  symbol: string;
  qty: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  time_in_force: 'day' | 'gtc' | 'ioc' | 'fok';
  limit_price?: number;
  stop_price?: number;
}

interface StockPosition {
  symbol: string;
  qty: number;
  avg_entry_price: number;
  market_value: number;
  cost_basis: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  current_price: number;
}

export class StockExchangeManager {
  private logger: Logger;
  private alpacaClient: AlpacaClient | null = null;
  private ibkrClient: any = null;
  private tdClient: any = null;
  private finnhubWs: WebSocket | null = null;
  private polygonWs: WebSocket | null = null;

  constructor() {
    this.logger = new Logger('StockExchangeManager');
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing stock exchange connections...');

    // Initialize Alpaca (commission-free stock trading)
    if (process.env.ALPACA_KEY_ID && process.env.ALPACA_SECRET_KEY) {
      this.alpacaClient = new AlpacaClient(
        process.env.ALPACA_KEY_ID,
        process.env.ALPACA_SECRET_KEY,
        process.env.ALPACA_PAPER === 'true'
      );
      await this.alpacaClient.initialize();
    }

    // Initialize data feeds
    this.initializeDataFeeds();

    this.logger.info('Stock exchanges initialized');
  }

  private initializeDataFeeds(): void {
    // Finnhub WebSocket for real-time data
    if (process.env.FINNHUB_API_KEY && process.env.FINNHUB_API_KEY !== 'your_finnhub_api_key') {
      this.finnhubWs = new WebSocket(`wss://ws.finnhub.io?token=${process.env.FINNHUB_API_KEY}`);
      
      this.finnhubWs.on('open', () => {
        this.logger.info('Finnhub WebSocket connected');
      });

      this.finnhubWs.on('message', (data: WebSocket.Data) => {
        this.handleFinnhubMessage(JSON.parse(data.toString()));
      });
    }

    // Polygon.io WebSocket for market data
    if (process.env.POLYGON_API_KEY && process.env.POLYGON_API_KEY !== 'your_polygon_api_key') {
      this.polygonWs = new WebSocket(`wss://socket.polygon.io/stocks`);
      
      this.polygonWs.on('open', () => {
        this.polygonWs?.send(JSON.stringify({
          action: 'auth',
          params: process.env.POLYGON_API_KEY
        }));
      });
    }
  }

  private handleFinnhubMessage(data: any): void {
    // Process real-time stock data
    if (data.type === 'trade') {
      // Emit trade data
    }
  }

  async getAccount(): Promise<any> {
    if (this.alpacaClient) {
      return await this.alpacaClient.getAccount();
    }
    throw new Error('No stock exchange connected');
  }

  async getPositions(): Promise<StockPosition[]> {
    if (this.alpacaClient) {
      return await this.alpacaClient.getPositions();
    }
    return [];
  }

  async createOrder(order: StockOrder): Promise<any> {
    if (this.alpacaClient) {
      return await this.alpacaClient.createOrder(order);
    }
    throw new Error('No stock exchange connected');
  }

  async getMarketHours(date?: Date): Promise<any> {
    const targetDate = date || new Date();
    if (this.alpacaClient) {
      return await this.alpacaClient.getMarketCalendar(targetDate);
    }
    
    // Default market hours
    return {
      isOpen: this.isMarketOpen(targetDate),
      openTime: '09:30',
      closeTime: '16:00',
      timezone: 'America/New_York'
    };
  }

  private isMarketOpen(date: Date): boolean {
    const day = date.getDay();
    if (day === 0 || day === 6) return false; // Weekend
    
    const easternTime = new Date(date.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const hours = easternTime.getHours();
    const minutes = easternTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    
    // Market hours: 9:30 AM - 4:00 PM ET
    return totalMinutes >= 570 && totalMinutes <= 960;
  }

  async getQuote(symbol: string): Promise<any> {
    if (this.alpacaClient) {
      return await this.alpacaClient.getLatestQuote(symbol);
    }
    
    // Fallback to free API
    return await this.getYahooFinanceQuote(symbol);
  }

  private async getYahooFinanceQuote(symbol: string): Promise<any> {
    // Yahoo Finance API (free tier)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const response = await axios.get(url);
    const data = response.data.chart.result[0];
    
    return {
      symbol,
      price: data.meta.regularMarketPrice,
      volume: data.meta.regularMarketVolume,
      previousClose: data.meta.previousClose,
      change: data.meta.regularMarketPrice - data.meta.previousClose,
      changePercent: ((data.meta.regularMarketPrice - data.meta.previousClose) / data.meta.previousClose) * 100
    };
  }

  async getFundamentals(symbol: string): Promise<any> {
    // Get fundamental data (P/E, Market Cap, etc.)
    try {
      const response = await axios.get(`https://finnhub.io/api/v1/stock/metric`, {
        params: {
          symbol,
          metric: 'all',
          token: process.env.FINNHUB_API_KEY
        }
      });
      
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get fundamentals:', error);
      return null;
    }
  }

  async getNews(symbol?: string): Promise<any[]> {
    try {
      const response = await axios.get(`https://finnhub.io/api/v1/news`, {
        params: {
          category: symbol ? 'company' : 'general',
          symbol,
          token: process.env.FINNHUB_API_KEY
        }
      });
      
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get news:', error);
      return [];
    }
  }

  async getOptionsChain(symbol: string): Promise<any> {
    if (this.alpacaClient) {
      // Get options data if available
      return await this.alpacaClient.getOptionsChain(symbol);
    }
    return null;
  }

  async getOpenOrders(symbol?: string): Promise<any[]> {
    if (this.alpacaClient) {
      return await this.alpacaClient.getOrders('open');
    }
    return [];
  }

  async cancelOrder(orderId: string, symbol: string): Promise<any> {
    if (this.alpacaClient) {
      return await this.alpacaClient.cancelOrder(orderId);
    }
    throw new Error('No exchange connected');
  }

  async getSectorPerformance(): Promise<any> {
    // Get sector performance data
    const sectors = ['XLK', 'XLF', 'XLV', 'XLE', 'XLI', 'XLY', 'XLP', 'XLB', 'XLRE', 'XLU'];
    const performance: any = {};
    
    for (const sector of sectors) {
      const quote = await this.getQuote(sector);
      performance[sector] = quote.changePercent;
    }
    
    return performance;
  }
}

class AlpacaClient {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;
  private logger: Logger;

  constructor(apiKey: string, secretKey: string, paper: boolean = true) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.baseUrl = paper 
      ? 'https://paper-api.alpaca.markets'
      : 'https://api.alpaca.markets';
    this.logger = new Logger('AlpacaClient');
  }

  async initialize(): Promise<void> {
    try {
      const account = await this.getAccount();
      this.logger.info(`Alpaca connected with $${account.cash} available`);
    } catch (error) {
      this.logger.warn('Alpaca connection failed, using paper trading mode');
    }
  }

  private async request(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    const response = await axios({
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers: {
        'APCA-API-KEY-ID': this.apiKey,
        'APCA-API-SECRET-KEY': this.secretKey
      },
      data
    });
    
    return response.data;
  }

  async getAccount(): Promise<any> {
    return await this.request('/v2/account');
  }

  async getPositions(): Promise<any[]> {
    return await this.request('/v2/positions');
  }

  async createOrder(order: StockOrder): Promise<any> {
    return await this.request('/v2/orders', 'POST', order);
  }

  async cancelOrder(orderId: string): Promise<any> {
    return await this.request(`/v2/orders/${orderId}`, 'DELETE');
  }

  async getOrders(status?: string): Promise<any[]> {
    const params = status ? `?status=${status}` : '';
    return await this.request(`/v2/orders${params}`);
  }

  async getLatestQuote(symbol: string): Promise<any> {
    return await this.request(`/v2/stocks/${symbol}/quotes/latest`);
  }

  async getBars(symbol: string, timeframe: string, start: string, end: string): Promise<any> {
    return await this.request(`/v2/stocks/${symbol}/bars`, 'GET', {
      timeframe,
      start,
      end
    });
  }

  async getMarketCalendar(date: Date): Promise<any> {
    const dateStr = date.toISOString().split('T')[0];
    return await this.request(`/v2/calendar?start=${dateStr}&end=${dateStr}`);
  }

  async getOptionsChain(symbol: string): Promise<any> {
    // Alpaca doesn't support options yet, would need another provider
    return null;
  }

  async getWatchlist(): Promise<any[]> {
    return await this.request('/v2/watchlists');
  }

  async addToWatchlist(watchlistId: string, symbol: string): Promise<any> {
    return await this.request(`/v2/watchlists/${watchlistId}`, 'POST', { symbol });
  }
}