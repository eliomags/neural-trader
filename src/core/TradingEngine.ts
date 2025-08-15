import { EventEmitter } from 'events';
import { ExchangeManager } from '../exchanges/ExchangeManager';
import { NeuralPredictor } from '../ml/NeuralPredictor';
import { RiskManager } from '../risk/RiskManager';
import { PortfolioManager } from '../portfolio/PortfolioManager';
import { DataFeedManager } from '../data/DataFeedManager';
import { Logger } from '../utils/Logger';
import { Order, Signal, Position, MarketData } from '../types';
import * as cron from 'node-cron';

export class TradingEngine extends EventEmitter {
  private logger: Logger;
  private isRunning: boolean = false;
  private tradingPairs: string[] = [];
  private signalQueue: Signal[] = [];
  private executionTask: cron.ScheduledTask | null = null;
  private predictionTask: cron.ScheduledTask | null = null;

  constructor(
    private exchangeManager: ExchangeManager,
    private neuralPredictor: NeuralPredictor,
    private riskManager: RiskManager,
    private portfolioManager: PortfolioManager,
    private dataFeedManager: DataFeedManager
  ) {
    super();
    this.logger = new Logger('TradingEngine');
    this.setupTradingPairs();
  }

  private setupTradingPairs(): void {
    this.tradingPairs = [
      'BTC/USDT',
      'ETH/USDT',
      'BNB/USDT',
      'SOL/USDT',
      'ADA/USDT',
      'XRP/USDT',
      'DOT/USDT',
      'DOGE/USDT',
      'AVAX/USDT',
      'MATIC/USDT'
    ];
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Trading engine is already running');
      return;
    }

    this.logger.info('Starting trading engine...');
    this.isRunning = true;

    // Start prediction cycle (every 5 minutes)
    this.predictionTask = cron.schedule('*/5 * * * *', async () => {
      await this.runPredictionCycle();
    });

    // Start execution cycle (every minute)
    this.executionTask = cron.schedule('* * * * *', async () => {
      await this.executeSignals();
    });

    // Initial run
    await this.runPredictionCycle();

    this.logger.info('Trading engine started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Trading engine is not running');
      return;
    }

    this.logger.info('Stopping trading engine...');
    this.isRunning = false;

    if (this.predictionTask) {
      this.predictionTask.stop();
    }

    if (this.executionTask) {
      this.executionTask.stop();
    }

    // Close all open positions
    await this.closeAllPositions();

    this.logger.info('Trading engine stopped');
  }

  private async runPredictionCycle(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.debug('Running prediction cycle...');

    for (const pair of this.tradingPairs) {
      try {
        // Get market data
        const marketData = await this.dataFeedManager.getMarketData(pair);
        
        // Get predictions from neural network
        const prediction = await this.neuralPredictor.predict(marketData);
        
        // Analyze signal strength
        const signal = await this.analyzeSignal(pair, prediction, marketData);
        
        if (signal) {
          // Validate with risk manager
          const validated = await this.riskManager.validateSignal(signal);
          
          if (validated) {
            this.signalQueue.push(signal);
            this.emit('signal', signal);
            this.logger.info(`New trading signal generated for ${pair}: ${signal.action}`);
          }
        }
      } catch (error) {
        this.logger.error(`Error in prediction cycle for ${pair}:`, error);
      }
    }
  }

  private async analyzeSignal(
    pair: string,
    prediction: any,
    marketData: MarketData
  ): Promise<Signal | null> {
    const { confidence, direction, predictedPrice, timeframe } = prediction;
    
    // Minimum confidence threshold
    const confidenceThreshold = 0.65;
    
    if (confidence < confidenceThreshold) {
      return null;
    }

    const currentPrice = marketData.price;
    const priceChange = ((predictedPrice - currentPrice) / currentPrice) * 100;
    
    // Minimum price change threshold (1%)
    if (Math.abs(priceChange) < 1) {
      return null;
    }

    const signal: Signal = {
      id: this.generateSignalId(),
      symbol: pair,
      action: direction === 'up' ? 'BUY' : 'SELL',
      price: currentPrice,
      targetPrice: predictedPrice,
      stopLoss: this.calculateStopLoss(currentPrice, direction),
      takeProfit: this.calculateTakeProfit(currentPrice, direction),
      confidence,
      timeframe,
      timestamp: Date.now(),
      metadata: {
        priceChange,
        volume: marketData.volume,
        volatility: marketData.volatility,
        rsi: marketData.indicators?.rsi,
        macd: marketData.indicators?.macd
      }
    };

    return signal;
  }

  private calculateStopLoss(price: number, direction: 'up' | 'down'): number {
    const stopLossPercentage = 0.02; // 2%
    return direction === 'up' 
      ? price * (1 - stopLossPercentage)
      : price * (1 + stopLossPercentage);
  }

  private calculateTakeProfit(price: number, direction: 'up' | 'down'): number {
    const takeProfitPercentage = 0.05; // 5%
    return direction === 'up'
      ? price * (1 + takeProfitPercentage)
      : price * (1 - takeProfitPercentage);
  }

  private async executeSignals(): Promise<void> {
    if (!this.isRunning || this.signalQueue.length === 0) return;

    this.logger.debug(`Executing ${this.signalQueue.length} signals...`);

    while (this.signalQueue.length > 0) {
      const signal = this.signalQueue.shift();
      if (!signal) continue;

      try {
        // Check if signal is still valid
        if (Date.now() - signal.timestamp > 300000) { // 5 minutes
          this.logger.warn(`Signal for ${signal.symbol} expired`);
          continue;
        }

        // Calculate position size
        const positionSize = await this.riskManager.calculatePositionSize(signal);
        
        if (positionSize === 0) {
          this.logger.warn(`Position size is 0 for ${signal.symbol}, skipping`);
          continue;
        }

        // Execute order
        const order = await this.executeOrder(signal, positionSize);
        
        if (order) {
          // Record position
          await this.portfolioManager.addPosition({
            id: order.id,
            symbol: signal.symbol,
            side: signal.action,
            entryPrice: order.price,
            quantity: order.amount,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
            timestamp: Date.now()
          });

          this.logger.info(`Order executed for ${signal.symbol}: ${order.id}`);
          this.emit('order-executed', order);
        }
      } catch (error) {
        this.logger.error(`Error executing signal for ${signal.symbol}:`, error);
      }
    }
  }

  private async executeOrder(signal: Signal, amount: number): Promise<Order | null> {
    try {
      const exchange = this.exchangeManager.getExchange('binance');
      
      const orderParams = {
        symbol: signal.symbol,
        type: 'limit',
        side: signal.action.toLowerCase() as 'buy' | 'sell',
        amount,
        price: signal.price
      };

      const order = await exchange.createOrder(
        orderParams.symbol,
        orderParams.type,
        orderParams.side,
        orderParams.amount,
        orderParams.price
      );

      // Set stop loss and take profit orders
      if (order.id) {
        await this.setProtectionOrders(signal, amount, order.id);
      }

      return order;
    } catch (error) {
      this.logger.error('Order execution failed:', error);
      return null;
    }
  }

  private async setProtectionOrders(
    signal: Signal,
    amount: number,
    orderId: string
  ): Promise<void> {
    try {
      const exchange = this.exchangeManager.getExchange('binance');
      
      // Stop loss order
      await exchange.createOrder(
        signal.symbol,
        'stop_loss',
        signal.action === 'BUY' ? 'sell' : 'buy',
        amount,
        signal.stopLoss,
        { stopPrice: signal.stopLoss }
      );

      // Take profit order
      await exchange.createOrder(
        signal.symbol,
        'take_profit',
        signal.action === 'BUY' ? 'sell' : 'buy',
        amount,
        signal.takeProfit,
        { stopPrice: signal.takeProfit }
      );

      this.logger.debug(`Protection orders set for ${signal.symbol}`);
    } catch (error) {
      this.logger.error('Failed to set protection orders:', error);
    }
  }

  private async closeAllPositions(): Promise<void> {
    const positions = await this.portfolioManager.getOpenPositions();
    
    for (const position of positions) {
      try {
        await this.closePosition(position);
      } catch (error) {
        this.logger.error(`Failed to close position ${position.id}:`, error);
      }
    }
  }

  private async closePosition(position: Position): Promise<void> {
    const exchange = this.exchangeManager.getExchange('binance');
    
    await exchange.createOrder(
      position.symbol,
      'market',
      position.side === 'BUY' ? 'sell' : 'buy',
      position.quantity
    );

    await this.portfolioManager.closePosition(position.id);
    this.logger.info(`Position closed: ${position.id}`);
  }

  private generateSignalId(): string {
    return `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getStatus(): Promise<any> {
    return {
      isRunning: this.isRunning,
      tradingPairs: this.tradingPairs,
      pendingSignals: this.signalQueue.length,
      openPositions: await this.portfolioManager.getOpenPositions(),
      performance: await this.portfolioManager.getPerformanceMetrics()
    };
  }
}