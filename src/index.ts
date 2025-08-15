import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { TradingEngine } from './core/TradingEngine';
import { ExchangeManager } from './exchanges/ExchangeManager';
import { NeuralPredictor } from './ml/NeuralPredictor';
import { RiskManager } from './risk/RiskManager';
import { DataFeedManager } from './data/DataFeedManager';
import { BacktestEngine } from './backtest/BacktestEngine';
import { PortfolioManager } from './portfolio/PortfolioManager';
import { Logger } from './utils/Logger';
import { Database } from './database/Database';
import { WebAPI } from './api/WebAPI';
import { StockAPI } from './api/StockAPI';
import { StrategyManager } from './strategies/StrategyManager';
import { NotificationService } from './services/NotificationService';
import { ConfigManager } from './config/ConfigManager';

dotenv.config();

const logger = new Logger('Main');

class NeuralTrader {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private io: Server;
  private tradingEngine: TradingEngine;
  private exchangeManager: ExchangeManager;
  private neuralPredictor: NeuralPredictor;
  private riskManager: RiskManager;
  private dataFeedManager: DataFeedManager;
  private portfolioManager: PortfolioManager;
  private database: Database;
  private configManager: ConfigManager;
  private stockAPI: StockAPI;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Neural Trader v2.5.0...');

      // Initialize configuration
      this.configManager = new ConfigManager();
      await this.configManager.load();

      // Initialize database
      this.database = new Database();
      await this.database.connect();

      // Initialize core components
      this.exchangeManager = new ExchangeManager();
      await this.exchangeManager.initialize();

      this.neuralPredictor = new NeuralPredictor();
      await this.neuralPredictor.loadModels();

      this.riskManager = new RiskManager(this.configManager);
      this.dataFeedManager = new DataFeedManager(this.exchangeManager);
      this.portfolioManager = new PortfolioManager(this.database);

      // Initialize trading engine
      this.tradingEngine = new TradingEngine(
        this.exchangeManager,
        this.neuralPredictor,
        this.riskManager,
        this.portfolioManager,
        this.dataFeedManager
      );

      // Setup API routes for crypto
      const webAPI = new WebAPI(
        this.app,
        this.tradingEngine,
        this.portfolioManager,
        this.database
      );
      webAPI.setupRoutes();

      // Setup API routes for stocks
      this.stockAPI = new StockAPI();
      await this.stockAPI.initialize();
      this.app.use('/api/stocks', this.stockAPI.getRouter());

      // Setup WebSocket events
      this.setupWebSocket();

      // Start data feeds
      await this.dataFeedManager.startAllFeeds();

      // Start trading engine
      await this.tradingEngine.start();

      logger.info('Neural Trader initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Neural Trader:', error);
      throw error;
    }
  }

  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      socket.on('subscribe', (data) => {
        const { channel, symbols } = data;
        symbols.forEach((symbol: string) => {
          socket.join(`${channel}:${symbol}`);
        });
      });

      socket.on('unsubscribe', (data) => {
        const { channel, symbols } = data;
        symbols.forEach((symbol: string) => {
          socket.leave(`${channel}:${symbol}`);
        });
      });

      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });

    // Broadcast market data updates
    this.dataFeedManager.on('ticker', (data) => {
      this.io.to(`ticker:${data.symbol}`).emit('ticker', data);
    });

    this.dataFeedManager.on('orderbook', (data) => {
      this.io.to(`orderbook:${data.symbol}`).emit('orderbook', data);
    });

    // Broadcast trading signals
    this.tradingEngine.on('signal', (signal) => {
      this.io.emit('trading-signal', signal);
    });

    // Broadcast position updates
    this.portfolioManager.on('position-update', (position) => {
      this.io.emit('position-update', position);
    });
  }

  async start(): Promise<void> {
    const port = process.env.PORT || 3000;
    
    this.server.listen(port, () => {
      logger.info(`Neural Trader server running on port ${port}`);
      logger.info('Dashboard available at http://localhost:' + port);
    });
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Neural Trader...');
    
    await this.tradingEngine.stop();
    await this.dataFeedManager.stopAllFeeds();
    await this.database.disconnect();
    
    this.server.close();
    logger.info('Neural Trader shutdown complete');
  }
}

// Main execution
const trader = new NeuralTrader();

async function main() {
  try {
    await trader.initialize();
    await trader.start();
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGINT', async () => {
  await trader.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await trader.shutdown();
  process.exit(0);
});

main();