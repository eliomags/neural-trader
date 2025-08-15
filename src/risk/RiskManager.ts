import { Logger } from '../utils/Logger';
import { Signal, Position, RiskMetrics } from '../types';
import { ConfigManager } from '../config/ConfigManager';

export class RiskManager {
  private logger: Logger;
  private maxPositionSize: number;
  private maxDrawdown: number;
  private riskPerTrade: number;
  private maxOpenPositions: number;
  private currentDrawdown: number = 0;
  private peakBalance: number = 0;
  private correlationMatrix: Map<string, Map<string, number>> = new Map();

  constructor(private configManager: ConfigManager) {
    this.logger = new Logger('RiskManager');
    this.loadRiskParameters();
  }

  private loadRiskParameters(): void {
    const config = this.configManager.getConfig();
    this.maxPositionSize = config.maxPositionSize || 10000;
    this.maxDrawdown = config.maxDrawdown || 0.2; // 20%
    this.riskPerTrade = config.riskPerTrade || 0.02; // 2%
    this.maxOpenPositions = config.maxOpenPositions || 10;
  }

  async validateSignal(signal: Signal): Promise<boolean> {
    try {
      // Check drawdown limits
      if (this.currentDrawdown > this.maxDrawdown) {
        this.logger.warn('Maximum drawdown exceeded, rejecting signal');
        return false;
      }

      // Check position limits
      const openPositions = await this.getOpenPositionsCount();
      if (openPositions >= this.maxOpenPositions) {
        this.logger.warn('Maximum open positions reached, rejecting signal');
        return false;
      }

      // Check correlation risk
      const correlationRisk = await this.checkCorrelationRisk(signal.symbol);
      if (correlationRisk > 0.8) {
        this.logger.warn(`High correlation risk for ${signal.symbol}, rejecting signal`);
        return false;
      }

      // Validate signal confidence
      if (signal.confidence < 0.65) {
        this.logger.warn(`Low confidence signal for ${signal.symbol}: ${signal.confidence}`);
        return false;
      }

      // Check volatility
      const volatility = signal.metadata?.volatility || 0;
      if (volatility > 0.5) {
        this.logger.warn(`High volatility for ${signal.symbol}: ${volatility}`);
        return false;
      }

      // Kelly Criterion check
      const kellyFraction = this.calculateKellyFraction(signal);
      if (kellyFraction < 0.01) {
        this.logger.warn(`Kelly fraction too low for ${signal.symbol}: ${kellyFraction}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Signal validation error:', error);
      return false;
    }
  }

  async calculatePositionSize(signal: Signal): Promise<number> {
    try {
      const accountBalance = await this.getAccountBalance();
      const riskAmount = accountBalance * this.riskPerTrade;
      
      // Calculate stop loss distance
      const stopLossDistance = Math.abs(signal.price - signal.stopLoss);
      const stopLossPercentage = stopLossDistance / signal.price;
      
      // Base position size
      let positionSize = riskAmount / stopLossDistance;
      
      // Apply Kelly Criterion
      const kellyFraction = this.calculateKellyFraction(signal);
      positionSize *= Math.min(kellyFraction, 0.25); // Cap at 25% Kelly
      
      // Apply volatility adjustment
      const volatilityMultiplier = this.getVolatilityMultiplier(signal);
      positionSize *= volatilityMultiplier;
      
      // Apply maximum position size limit
      positionSize = Math.min(positionSize, this.maxPositionSize);
      
      // Apply minimum position size
      const minimumSize = 10; // $10 minimum
      if (positionSize < minimumSize) {
        return 0;
      }
      
      // Round to appropriate decimal places
      positionSize = Math.round(positionSize * 100) / 100;
      
      this.logger.info(`Position size calculated for ${signal.symbol}: ${positionSize}`);
      
      return positionSize;
    } catch (error) {
      this.logger.error('Position size calculation error:', error);
      return 0;
    }
  }

  private calculateKellyFraction(signal: Signal): number {
    // Kelly Criterion: f = (p * b - q) / b
    // where f = fraction to bet, p = probability of win, 
    // b = odds received on the bet, q = probability of loss
    
    const winProbability = signal.confidence;
    const lossProbability = 1 - winProbability;
    
    const winAmount = Math.abs(signal.targetPrice - signal.price);
    const lossAmount = Math.abs(signal.price - signal.stopLoss);
    const odds = winAmount / lossAmount;
    
    const kellyFraction = (winProbability * odds - lossProbability) / odds;
    
    // Apply Kelly fraction safety factor (usually 0.25 to 0.5)
    return Math.max(0, kellyFraction * 0.25);
  }

  private getVolatilityMultiplier(signal: Signal): number {
    const volatility = signal.metadata?.volatility || 0.1;
    
    // Lower position size for higher volatility
    if (volatility > 0.3) return 0.5;
    if (volatility > 0.2) return 0.7;
    if (volatility > 0.1) return 0.9;
    return 1.0;
  }

  async checkCorrelationRisk(symbol: string): Promise<number> {
    // Check correlation with existing positions
    const openPositions = await this.getOpenPositions();
    let maxCorrelation = 0;
    
    for (const position of openPositions) {
      const correlation = this.getCorrelation(symbol, position.symbol);
      maxCorrelation = Math.max(maxCorrelation, Math.abs(correlation));
    }
    
    return maxCorrelation;
  }

  private getCorrelation(symbol1: string, symbol2: string): number {
    // Get or calculate correlation between two symbols
    if (!this.correlationMatrix.has(symbol1)) {
      this.correlationMatrix.set(symbol1, new Map());
    }
    
    const correlations = this.correlationMatrix.get(symbol1)!;
    
    if (!correlations.has(symbol2)) {
      // Calculate correlation (simplified - would use historical data in production)
      const baseCorrelation = this.calculateBaseCorrelation(symbol1, symbol2);
      correlations.set(symbol2, baseCorrelation);
    }
    
    return correlations.get(symbol2)!;
  }

  private calculateBaseCorrelation(symbol1: string, symbol2: string): number {
    // Simplified correlation calculation
    const base1 = symbol1.split('/')[0];
    const base2 = symbol2.split('/')[0];
    
    if (base1 === base2) return 1.0;
    
    // High correlation for similar assets
    const highCorrelationPairs = [
      ['BTC', 'ETH'],
      ['SOL', 'AVAX'],
      ['MATIC', 'BNB']
    ];
    
    for (const pair of highCorrelationPairs) {
      if ((pair.includes(base1) && pair.includes(base2))) {
        return 0.7;
      }
    }
    
    // Default low correlation
    return 0.3;
  }

  async updateDrawdown(currentBalance: number): Promise<void> {
    if (currentBalance > this.peakBalance) {
      this.peakBalance = currentBalance;
    }
    
    this.currentDrawdown = (this.peakBalance - currentBalance) / this.peakBalance;
    
    if (this.currentDrawdown > this.maxDrawdown * 0.8) {
      this.logger.warn(`Approaching maximum drawdown: ${(this.currentDrawdown * 100).toFixed(2)}%`);
    }
  }

  async getRiskMetrics(): Promise<RiskMetrics> {
    const openPositions = await this.getOpenPositions();
    const totalExposure = openPositions.reduce((sum, pos) => sum + pos.value, 0);
    const accountBalance = await this.getAccountBalance();
    
    return {
      currentDrawdown: this.currentDrawdown,
      maxDrawdown: this.maxDrawdown,
      openPositions: openPositions.length,
      maxOpenPositions: this.maxOpenPositions,
      totalExposure,
      exposureRatio: totalExposure / accountBalance,
      sharpeRatio: await this.calculateSharpeRatio(),
      winRate: await this.calculateWinRate(),
      profitFactor: await this.calculateProfitFactor(),
      valueAtRisk: await this.calculateVaR(),
      beta: await this.calculateBeta()
    };
  }

  private async calculateSharpeRatio(): Promise<number> {
    // Sharpe Ratio = (Return - Risk Free Rate) / Standard Deviation
    // Simplified implementation
    const returns = await this.getHistoricalReturns();
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const riskFreeRate = 0.02 / 365; // 2% annual, daily
    
    const variance = returns.reduce((sum, ret) => {
      return sum + Math.pow(ret - avgReturn, 2);
    }, 0) / returns.length;
    
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev : 0;
  }

  private async calculateWinRate(): Promise<number> {
    const trades = await this.getCompletedTrades();
    if (trades.length === 0) return 0;
    
    const wins = trades.filter(t => t.profit > 0).length;
    return wins / trades.length;
  }

  private async calculateProfitFactor(): Promise<number> {
    const trades = await this.getCompletedTrades();
    
    const grossProfit = trades
      .filter(t => t.profit > 0)
      .reduce((sum, t) => sum + t.profit, 0);
    
    const grossLoss = Math.abs(trades
      .filter(t => t.profit < 0)
      .reduce((sum, t) => sum + t.profit, 0));
    
    return grossLoss > 0 ? grossProfit / grossLoss : grossProfit;
  }

  private async calculateVaR(confidence: number = 0.95): Promise<number> {
    // Value at Risk calculation
    const returns = await this.getHistoricalReturns();
    returns.sort((a, b) => a - b);
    
    const index = Math.floor((1 - confidence) * returns.length);
    return returns[index] || 0;
  }

  private async calculateBeta(): Promise<number> {
    // Beta calculation against market (BTC)
    // Simplified implementation
    return 1.0;
  }

  // Mock methods - would connect to actual data sources
  private async getAccountBalance(): Promise<number> {
    return 10000; // Mock balance
  }

  private async getOpenPositionsCount(): Promise<number> {
    return 3; // Mock count
  }

  private async getOpenPositions(): Promise<any[]> {
    return []; // Mock positions
  }

  private async getHistoricalReturns(): Promise<number[]> {
    // Mock historical returns
    return Array(30).fill(0).map(() => (Math.random() - 0.5) * 0.1);
  }

  private async getCompletedTrades(): Promise<any[]> {
    // Mock completed trades
    return Array(100).fill(0).map(() => ({
      profit: (Math.random() - 0.45) * 100
    }));
  }

  adjustRiskParameters(metrics: RiskMetrics): void {
    // Dynamic risk adjustment based on performance
    if (metrics.currentDrawdown > this.maxDrawdown * 0.5) {
      // Reduce risk when in drawdown
      this.riskPerTrade *= 0.5;
      this.maxOpenPositions = Math.max(3, Math.floor(this.maxOpenPositions * 0.5));
      this.logger.warn('Risk parameters reduced due to drawdown');
    } else if (metrics.winRate > 0.6 && metrics.profitFactor > 2) {
      // Increase risk when performing well
      this.riskPerTrade = Math.min(0.03, this.riskPerTrade * 1.1);
      this.maxOpenPositions = Math.min(15, this.maxOpenPositions + 1);
      this.logger.info('Risk parameters increased due to good performance');
    }
  }
}