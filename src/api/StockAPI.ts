import { Router, Request, Response } from 'express';
import { StockTradingEngine } from '../stocks/StockTradingEngine';
import { StockExchangeManager } from '../stocks/StockExchangeManager';
import { StockAnalyzer } from '../stocks/StockAnalyzer';
import { Logger } from '../utils/Logger';

export class StockAPI {
  private router: Router;
  private logger: Logger;
  private tradingEngine: StockTradingEngine;
  private exchangeManager: StockExchangeManager;
  private analyzer: StockAnalyzer;

  constructor() {
    this.router = Router();
    this.logger = new Logger('StockAPI');
    this.tradingEngine = new StockTradingEngine();
    this.exchangeManager = new StockExchangeManager();
    this.analyzer = new StockAnalyzer();
    this.setupRoutes();
  }

  async initialize(): Promise<void> {
    await this.tradingEngine.initialize();
    await this.exchangeManager.initialize();
  }

  private setupRoutes(): void {
    // Market status
    this.router.get('/market/status', this.getMarketStatus.bind(this));
    
    // Account
    this.router.get('/account', this.getAccount.bind(this));
    this.router.get('/positions', this.getPositions.bind(this));
    
    // Trading
    this.router.post('/trading/start', this.startTrading.bind(this));
    this.router.post('/trading/stop', this.stopTrading.bind(this));
    this.router.get('/trading/status', this.getTradingStatus.bind(this));
    
    // Orders
    this.router.post('/orders', this.createOrder.bind(this));
    this.router.get('/orders', this.getOrders.bind(this));
    this.router.delete('/orders/:id', this.cancelOrder.bind(this));
    
    // Market data
    this.router.get('/quote/:symbol', this.getQuote.bind(this));
    this.router.get('/candles/:symbol', this.getCandles.bind(this));
    this.router.get('/fundamentals/:symbol', this.getFundamentals.bind(this));
    
    // Analysis
    this.router.get('/analyze/:symbol', this.analyzeStock.bind(this));
    this.router.post('/screen', this.screenStocks.bind(this));
    
    // Watchlist
    this.router.get('/watchlist', this.getWatchlist.bind(this));
    this.router.post('/watchlist', this.addToWatchlist.bind(this));
    this.router.delete('/watchlist/:symbol', this.removeFromWatchlist.bind(this));
    
    // News & Events
    this.router.get('/news/:symbol?', this.getNews.bind(this));
    this.router.get('/earnings', this.getEarningsCalendar.bind(this));
    this.router.get('/ipos', this.getIPOCalendar.bind(this));
    
    // Sectors
    this.router.get('/sectors', this.getSectorPerformance.bind(this));
    
    // Options
    this.router.get('/options/:symbol', this.getOptionsChain.bind(this));
  }

  private async getMarketStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await this.exchangeManager.getMarketHours();
      res.json(status);
    } catch (error) {
      this.logger.error('Error getting market status:', error);
      res.status(500).json({ error: 'Failed to get market status' });
    }
  }

  private async getAccount(req: Request, res: Response): Promise<void> {
    try {
      const account = await this.exchangeManager.getAccount();
      res.json(account);
    } catch (error) {
      this.logger.error('Error getting account:', error);
      res.status(500).json({ error: 'Failed to get account' });
    }
  }

  private async getPositions(req: Request, res: Response): Promise<void> {
    try {
      const positions = await this.exchangeManager.getPositions();
      res.json(positions);
    } catch (error) {
      this.logger.error('Error getting positions:', error);
      res.status(500).json({ error: 'Failed to get positions' });
    }
  }

  private async startTrading(req: Request, res: Response): Promise<void> {
    try {
      await this.tradingEngine.start();
      res.json({ message: 'Stock trading started' });
    } catch (error) {
      this.logger.error('Error starting trading:', error);
      res.status(500).json({ error: 'Failed to start trading' });
    }
  }

  private async stopTrading(req: Request, res: Response): Promise<void> {
    try {
      await this.tradingEngine.stop();
      res.json({ message: 'Stock trading stopped' });
    } catch (error) {
      this.logger.error('Error stopping trading:', error);
      res.status(500).json({ error: 'Failed to stop trading' });
    }
  }

  private async getTradingStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await this.tradingEngine.getStatus();
      res.json(status);
    } catch (error) {
      this.logger.error('Error getting trading status:', error);
      res.status(500).json({ error: 'Failed to get trading status' });
    }
  }

  private async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const order = await this.exchangeManager.createOrder(req.body);
      res.json(order);
    } catch (error) {
      this.logger.error('Error creating order:', error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  }

  private async getOrders(req: Request, res: Response): Promise<void> {
    try {
      const status = req.query.status as string;
      const orders = await this.exchangeManager.getOpenOrders();
      res.json(orders);
    } catch (error) {
      this.logger.error('Error getting orders:', error);
      res.status(500).json({ error: 'Failed to get orders' });
    }
  }

  private async cancelOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.exchangeManager.cancelOrder(id, '');
      res.json({ message: 'Order cancelled' });
    } catch (error) {
      this.logger.error('Error cancelling order:', error);
      res.status(500).json({ error: 'Failed to cancel order' });
    }
  }

  private async getQuote(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      const quote = await this.exchangeManager.getQuote(symbol);
      res.json(quote);
    } catch (error) {
      this.logger.error('Error getting quote:', error);
      res.status(500).json({ error: 'Failed to get quote' });
    }
  }

  private async getCandles(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      const { timeframe = '1D' } = req.query;
      // Implementation would fetch candle data
      res.json([]);
    } catch (error) {
      this.logger.error('Error getting candles:', error);
      res.status(500).json({ error: 'Failed to get candles' });
    }
  }

  private async getFundamentals(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      const fundamentals = await this.exchangeManager.getFundamentals(symbol);
      res.json(fundamentals);
    } catch (error) {
      this.logger.error('Error getting fundamentals:', error);
      res.status(500).json({ error: 'Failed to get fundamentals' });
    }
  }

  private async analyzeStock(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      const analysis = await this.analyzer.analyzeStock(symbol);
      res.json(analysis);
    } catch (error) {
      this.logger.error('Error analyzing stock:', error);
      res.status(500).json({ error: 'Failed to analyze stock' });
    }
  }

  private async screenStocks(req: Request, res: Response): Promise<void> {
    try {
      const criteria = req.body;
      const stocks = await this.analyzer.screenStocks(criteria);
      res.json(stocks);
    } catch (error) {
      this.logger.error('Error screening stocks:', error);
      res.status(500).json({ error: 'Failed to screen stocks' });
    }
  }

  private async getWatchlist(req: Request, res: Response): Promise<void> {
    try {
      const watchlist = this.tradingEngine.getWatchlist();
      
      // Get current data for each symbol
      const watchlistData = await Promise.all(
        watchlist.map(async (symbol) => {
          const quote = await this.exchangeManager.getQuote(symbol);
          const signal = await this.analyzer.analyzeStock(symbol);
          
          return {
            symbol,
            name: symbol, // Would fetch company name
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            signal: signal ? {
              action: signal.action,
              confidence: signal.confidence
            } : null
          };
        })
      );
      
      res.json(watchlistData);
    } catch (error) {
      this.logger.error('Error getting watchlist:', error);
      res.status(500).json({ error: 'Failed to get watchlist' });
    }
  }

  private async addToWatchlist(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.body;
      await this.tradingEngine.addToWatchlist(symbol);
      res.json({ message: 'Added to watchlist' });
    } catch (error) {
      this.logger.error('Error adding to watchlist:', error);
      res.status(500).json({ error: 'Failed to add to watchlist' });
    }
  }

  private async removeFromWatchlist(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      await this.tradingEngine.removeFromWatchlist(symbol);
      res.json({ message: 'Removed from watchlist' });
    } catch (error) {
      this.logger.error('Error removing from watchlist:', error);
      res.status(500).json({ error: 'Failed to remove from watchlist' });
    }
  }

  private async getNews(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      const news = await this.exchangeManager.getNews(symbol);
      res.json(news);
    } catch (error) {
      this.logger.error('Error getting news:', error);
      res.status(500).json({ error: 'Failed to get news' });
    }
  }

  private async getEarningsCalendar(req: Request, res: Response): Promise<void> {
    try {
      const earnings = await this.analyzer.getEarningsCalendar();
      res.json(earnings);
    } catch (error) {
      this.logger.error('Error getting earnings calendar:', error);
      res.status(500).json({ error: 'Failed to get earnings calendar' });
    }
  }

  private async getIPOCalendar(req: Request, res: Response): Promise<void> {
    try {
      const ipos = await this.analyzer.getIPOCalendar();
      res.json(ipos);
    } catch (error) {
      this.logger.error('Error getting IPO calendar:', error);
      res.status(500).json({ error: 'Failed to get IPO calendar' });
    }
  }

  private async getSectorPerformance(req: Request, res: Response): Promise<void> {
    try {
      const sectors = await this.exchangeManager.getSectorPerformance();
      res.json(sectors);
    } catch (error) {
      this.logger.error('Error getting sector performance:', error);
      res.status(500).json({ error: 'Failed to get sector performance' });
    }
  }

  private async getOptionsChain(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      const options = await this.exchangeManager.getOptionsChain(symbol);
      res.json(options || { message: 'Options not available' });
    } catch (error) {
      this.logger.error('Error getting options chain:', error);
      res.status(500).json({ error: 'Failed to get options chain' });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}