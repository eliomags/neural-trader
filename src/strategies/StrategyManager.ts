import { Logger } from '../utils/Logger';
import { MarketData, Signal } from '../types';

export abstract class Strategy {
  abstract name: string;
  abstract analyze(marketData: MarketData): Promise<Signal | null>;
}

export class MomentumStrategy extends Strategy {
  name = 'Momentum';

  async analyze(marketData: MarketData): Promise<Signal | null> {
    // Momentum strategy implementation
    const rsi = marketData.indicators?.rsi || 50;
    const macd = marketData.indicators?.macd;
    
    if (rsi < 30 && macd?.histogram > 0) {
      return {
        id: `mom_${Date.now()}`,
        symbol: marketData.symbol,
        action: 'BUY',
        price: marketData.price,
        targetPrice: marketData.price * 1.03,
        stopLoss: marketData.price * 0.98,
        takeProfit: marketData.price * 1.05,
        confidence: 0.7,
        timeframe: '1h',
        timestamp: Date.now()
      };
    }
    
    if (rsi > 70 && macd?.histogram < 0) {
      return {
        id: `mom_${Date.now()}`,
        symbol: marketData.symbol,
        action: 'SELL',
        price: marketData.price,
        targetPrice: marketData.price * 0.97,
        stopLoss: marketData.price * 1.02,
        takeProfit: marketData.price * 0.95,
        confidence: 0.7,
        timeframe: '1h',
        timestamp: Date.now()
      };
    }
    
    return null;
  }
}

export class MeanReversionStrategy extends Strategy {
  name = 'MeanReversion';

  async analyze(marketData: MarketData): Promise<Signal | null> {
    const bollinger = marketData.indicators?.bollinger;
    if (!bollinger) return null;
    
    const price = marketData.price;
    
    if (price < bollinger.lower) {
      return {
        id: `mr_${Date.now()}`,
        symbol: marketData.symbol,
        action: 'BUY',
        price: marketData.price,
        targetPrice: bollinger.middle,
        stopLoss: price * 0.97,
        takeProfit: bollinger.middle,
        confidence: 0.65,
        timeframe: '1h',
        timestamp: Date.now()
      };
    }
    
    if (price > bollinger.upper) {
      return {
        id: `mr_${Date.now()}`,
        symbol: marketData.symbol,
        action: 'SELL',
        price: marketData.price,
        targetPrice: bollinger.middle,
        stopLoss: price * 1.03,
        takeProfit: bollinger.middle,
        confidence: 0.65,
        timeframe: '1h',
        timestamp: Date.now()
      };
    }
    
    return null;
  }
}

export class StrategyManager {
  private logger: Logger;
  private strategies: Map<string, Strategy> = new Map();

  constructor() {
    this.logger = new Logger('StrategyManager');
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    this.strategies.set('momentum', new MomentumStrategy());
    this.strategies.set('meanReversion', new MeanReversionStrategy());
  }

  async analyzeWithStrategy(strategyName: string, marketData: MarketData): Promise<Signal | null> {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      this.logger.warn(`Strategy ${strategyName} not found`);
      return null;
    }
    
    return strategy.analyze(marketData);
  }

  async analyzeWithAllStrategies(marketData: MarketData): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    for (const [name, strategy] of this.strategies) {
      try {
        const signal = await strategy.analyze(marketData);
        if (signal) {
          signals.push(signal);
        }
      } catch (error) {
        this.logger.error(`Strategy ${name} analysis failed:`, error);
      }
    }
    
    return signals;
  }

  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}