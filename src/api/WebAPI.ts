import express, { Application, Request, Response } from 'express';
import { TradingEngine } from '../core/TradingEngine';
import { PortfolioManager } from '../portfolio/PortfolioManager';
import { Database } from '../database/Database';
import { Logger } from '../utils/Logger';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export class WebAPI {
  private logger: Logger;

  constructor(
    private app: Application,
    private tradingEngine: TradingEngine,
    private portfolioManager: PortfolioManager,
    private database: Database
  ) {
    this.logger = new Logger('WebAPI');
  }

  setupRoutes(): void {
    // Middleware
    this.app.use(express.json());
    this.app.use(express.static('public'));
    
    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      next();
    });

    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: Date.now() });
    });

    // Trading endpoints
    this.app.get('/api/trading/status', this.getTradingStatus.bind(this));
    this.app.post('/api/trading/start', this.startTrading.bind(this));
    this.app.post('/api/trading/stop', this.stopTrading.bind(this));

    // Portfolio endpoints
    this.app.get('/api/portfolio/balance', this.getBalance.bind(this));
    this.app.get('/api/portfolio/positions', this.getPositions.bind(this));
    this.app.get('/api/portfolio/performance', this.getPerformance.bind(this));
    this.app.get('/api/portfolio/history', this.getTradeHistory.bind(this));

    // Signal endpoints
    this.app.get('/api/signals/recent', this.getRecentSignals.bind(this));
    this.app.get('/api/signals/stats', this.getSignalStats.bind(this));

    // Configuration endpoints
    this.app.get('/api/config', this.getConfig.bind(this));
    this.app.put('/api/config', this.updateConfig.bind(this));

    // Market data endpoints
    this.app.get('/api/market/:symbol/ticker', this.getTicker.bind(this));
    this.app.get('/api/market/:symbol/orderbook', this.getOrderBook.bind(this));
    this.app.get('/api/market/:symbol/candles', this.getCandles.bind(this));

    // Backtesting endpoints
    this.app.post('/api/backtest/run', this.runBacktest.bind(this));
    this.app.get('/api/backtest/results/:id', this.getBacktestResults.bind(this));

    this.logger.info('API routes configured');
  }

  private async getTradingStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await this.tradingEngine.getStatus();
      res.json(status);
    } catch (error) {
      this.logger.error('Error getting trading status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async startTrading(req: Request, res: Response): Promise<void> {
    try {
      await this.tradingEngine.start();
      res.json({ message: 'Trading started successfully' });
    } catch (error) {
      this.logger.error('Error starting trading:', error);
      res.status(500).json({ error: 'Failed to start trading' });
    }
  }

  private async stopTrading(req: Request, res: Response): Promise<void> {
    try {
      await this.tradingEngine.stop();
      res.json({ message: 'Trading stopped successfully' });
    } catch (error) {
      this.logger.error('Error stopping trading:', error);
      res.status(500).json({ error: 'Failed to stop trading' });
    }
  }

  private async getBalance(req: Request, res: Response): Promise<void> {
    try {
      const balance = this.portfolioManager.getBalance();
      res.json(Object.fromEntries(balance));
    } catch (error) {
      this.logger.error('Error getting balance:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getPositions(req: Request, res: Response): Promise<void> {
    try {
      const positions = await this.portfolioManager.getOpenPositions();
      res.json(positions);
    } catch (error) {
      this.logger.error('Error getting positions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getPerformance(req: Request, res: Response): Promise<void> {
    try {
      const performance = await this.portfolioManager.getPerformanceMetrics();
      res.json(performance);
    } catch (error) {
      this.logger.error('Error getting performance:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getTradeHistory(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const history = await this.portfolioManager.getTradeHistory(limit);
      res.json(history);
    } catch (error) {
      this.logger.error('Error getting trade history:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getRecentSignals(req: Request, res: Response): Promise<void> {
    try {
      const signals = await this.database.getSignalHistory(20);
      res.json(signals);
    } catch (error) {
      this.logger.error('Error getting signals:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getSignalStats(req: Request, res: Response): Promise<void> {
    try {
      // Implementation would calculate signal statistics
      res.json({
        totalSignals: 0,
        executedSignals: 0,
        successRate: 0,
        averageConfidence: 0
      });
    } catch (error) {
      this.logger.error('Error getting signal stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getConfig(req: Request, res: Response): Promise<void> {
    try {
      // Implementation would return current configuration
      res.json({});
    } catch (error) {
      this.logger.error('Error getting config:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      // Implementation would update configuration
      res.json({ message: 'Configuration updated' });
    } catch (error) {
      this.logger.error('Error updating config:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getTicker(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      // Implementation would fetch ticker data
      res.json({ symbol, price: 0, volume: 0 });
    } catch (error) {
      this.logger.error('Error getting ticker:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getOrderBook(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      // Implementation would fetch order book
      res.json({ symbol, bids: [], asks: [] });
    } catch (error) {
      this.logger.error('Error getting order book:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getCandles(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      const { timeframe = '1h', limit = '100' } = req.query;
      // Implementation would fetch candle data
      res.json({ symbol, timeframe, candles: [] });
    } catch (error) {
      this.logger.error('Error getting candles:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async runBacktest(req: Request, res: Response): Promise<void> {
    try {
      const { strategy, startDate, endDate, symbols } = req.body;
      // Implementation would start backtest
      res.json({ id: 'backtest_123', status: 'running' });
    } catch (error) {
      this.logger.error('Error running backtest:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getBacktestResults(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Implementation would fetch backtest results
      res.json({ id, status: 'completed', results: {} });
    } catch (error) {
      this.logger.error('Error getting backtest results:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}