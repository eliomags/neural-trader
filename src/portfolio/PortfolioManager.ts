import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger';
import { Position } from '../types';
import { Database } from '../database/Database';

export class PortfolioManager extends EventEmitter {
  private logger: Logger;
  private positions: Map<string, Position> = new Map();
  private balance: Map<string, number> = new Map();
  private performanceHistory: any[] = [];

  constructor(private database: Database) {
    super();
    this.logger = new Logger('PortfolioManager');
    this.initializeBalance();
  }

  private initializeBalance(): void {
    // Initialize with default balance
    this.balance.set('USDT', 10000);
    this.balance.set('BTC', 0);
    this.balance.set('ETH', 0);
  }

  async addPosition(position: Position): Promise<void> {
    try {
      this.positions.set(position.id, position);
      
      // Update balance
      const [base, quote] = position.symbol.split('/');
      const currentQuote = this.balance.get(quote) || 0;
      const cost = position.entryPrice * position.quantity;
      
      if (position.side === 'BUY') {
        this.balance.set(quote, currentQuote - cost);
        const currentBase = this.balance.get(base) || 0;
        this.balance.set(base, currentBase + position.quantity);
      } else {
        const currentBase = this.balance.get(base) || 0;
        this.balance.set(base, currentBase - position.quantity);
        this.balance.set(quote, currentQuote + cost);
      }

      // Save to database
      await this.database.savePosition(position);
      
      this.emit('position-update', position);
      this.logger.info(`Position added: ${position.id}`);
    } catch (error) {
      this.logger.error('Failed to add position:', error);
      throw error;
    }
  }

  async updatePosition(positionId: string, updates: Partial<Position>): Promise<void> {
    const position = this.positions.get(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    const updatedPosition = { ...position, ...updates };
    this.positions.set(positionId, updatedPosition);
    
    await this.database.updatePosition(positionId, updates);
    
    this.emit('position-update', updatedPosition);
  }

  async closePosition(positionId: string, exitPrice?: number): Promise<void> {
    const position = this.positions.get(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    const price = exitPrice || position.currentPrice || position.entryPrice;
    const pnl = this.calculatePnL(position, price);
    
    // Update balance
    const [base, quote] = position.symbol.split('/');
    const proceeds = price * position.quantity;
    
    if (position.side === 'BUY') {
      const currentBase = this.balance.get(base) || 0;
      this.balance.set(base, currentBase - position.quantity);
      const currentQuote = this.balance.get(quote) || 0;
      this.balance.set(quote, currentQuote + proceeds);
    } else {
      const currentBase = this.balance.get(base) || 0;
      this.balance.set(base, currentBase + position.quantity);
      const currentQuote = this.balance.get(quote) || 0;
      this.balance.set(quote, currentQuote - proceeds);
    }

    // Record performance
    this.recordPerformance({
      positionId,
      symbol: position.symbol,
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice: price,
      quantity: position.quantity,
      pnl,
      timestamp: Date.now()
    });

    // Remove position
    this.positions.delete(positionId);
    await this.database.closePosition(positionId, price, pnl);
    
    this.emit('position-closed', { ...position, exitPrice: price, realizedPnl: pnl });
    this.logger.info(`Position closed: ${positionId}, PnL: ${pnl.toFixed(2)}`);
  }

  private calculatePnL(position: Position, currentPrice: number): number {
    const diff = currentPrice - position.entryPrice;
    const pnl = position.side === 'BUY' 
      ? diff * position.quantity
      : -diff * position.quantity;
    return pnl;
  }

  async getOpenPositions(): Promise<Position[]> {
    return Array.from(this.positions.values());
  }

  async getPositionById(positionId: string): Promise<Position | null> {
    return this.positions.get(positionId) || null;
  }

  async getPositionsBySymbol(symbol: string): Promise<Position[]> {
    return Array.from(this.positions.values())
      .filter(p => p.symbol === symbol);
  }

  async updatePrices(prices: Map<string, number>): Promise<void> {
    for (const position of this.positions.values()) {
      const currentPrice = prices.get(position.symbol);
      if (currentPrice) {
        position.currentPrice = currentPrice;
        position.value = currentPrice * position.quantity;
        position.unrealizedPnl = this.calculatePnL(position, currentPrice);
        
        // Check stop loss and take profit
        if (position.stopLoss && currentPrice <= position.stopLoss) {
          this.logger.warn(`Stop loss triggered for position ${position.id}`);
          await this.closePosition(position.id, currentPrice);
        } else if (position.takeProfit && currentPrice >= position.takeProfit) {
          this.logger.info(`Take profit triggered for position ${position.id}`);
          await this.closePosition(position.id, currentPrice);
        }
      }
    }
  }

  getBalance(): Map<string, number> {
    return new Map(this.balance);
  }

  getTotalValue(prices: Map<string, number>): number {
    let total = 0;
    
    for (const [asset, amount] of this.balance) {
      if (asset === 'USDT' || asset === 'USD') {
        total += amount;
      } else {
        const price = prices.get(`${asset}/USDT`) || 0;
        total += amount * price;
      }
    }
    
    return total;
  }

  async getPerformanceMetrics(): Promise<any> {
    const trades = this.performanceHistory;
    
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnL: 0,
        averagePnL: 0,
        bestTrade: 0,
        worstTrade: 0,
        profitFactor: 0,
        expectancy: 0
      };
    }

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    
    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    
    // Calculate Sharpe Ratio
    const returns = trades.map(t => t.pnl);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 0 
      ? returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length 
      : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
    
    // Calculate Max Drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let runningTotal = 0;
    
    for (const trade of trades) {
      runningTotal += trade.pnl;
      if (runningTotal > peak) {
        peak = runningTotal;
      }
      const drawdown = peak > 0 ? (peak - runningTotal) / peak : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    // Calculate equity curve
    const equityCurve = [];
    let equity = 10000; // Starting equity
    for (const trade of trades) {
      equity += trade.pnl;
      equityCurve.push(equity);
    }

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: trades.length > 0 ? winningTrades.length / trades.length : 0,
      totalPnL,
      averagePnL: trades.length > 0 ? totalPnL / trades.length : 0,
      bestTrade: trades.length > 0 ? Math.max(...trades.map(t => t.pnl)) : 0,
      worstTrade: trades.length > 0 ? Math.min(...trades.map(t => t.pnl)) : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : 0,
      expectancy: trades.length > 0 ? totalPnL / trades.length : 0,
      averageWin: winningTrades.length > 0 
        ? grossProfit / winningTrades.length : 0,
      averageLoss: losingTrades.length > 0 
        ? grossLoss / losingTrades.length : 0,
      sharpeRatio,
      maxDrawdown,
      equityCurve
    };
  }

  private recordPerformance(trade: any): void {
    this.performanceHistory.push(trade);
    
    // Keep only last 1000 trades in memory
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory.shift();
    }
    
    // Save to database
    this.database.saveTrade(trade).catch(error => {
      this.logger.error('Failed to save trade to database:', error);
    });
  }

  async getTradeHistory(limit: number = 100): Promise<any[]> {
    return this.performanceHistory.slice(-limit);
  }

  async exportPortfolio(): Promise<any> {
    const positions = await this.getOpenPositions();
    const metrics = await this.getPerformanceMetrics();
    
    return {
      timestamp: Date.now(),
      balance: Object.fromEntries(this.balance),
      positions: positions.map(p => ({
        id: p.id,
        symbol: p.symbol,
        side: p.side,
        quantity: p.quantity,
        entryPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        unrealizedPnl: p.unrealizedPnl
      })),
      performance: metrics,
      recentTrades: this.performanceHistory.slice(-20)
    };
  }

  async importPortfolio(data: any): Promise<void> {
    try {
      // Clear existing data
      this.positions.clear();
      this.balance.clear();
      this.performanceHistory = [];
      
      // Import balance
      if (data.balance) {
        for (const [asset, amount] of Object.entries(data.balance)) {
          this.balance.set(asset, amount as number);
        }
      }
      
      // Import positions
      if (data.positions) {
        for (const pos of data.positions) {
          this.positions.set(pos.id, pos);
        }
      }
      
      // Import history
      if (data.recentTrades) {
        this.performanceHistory = data.recentTrades;
      }
      
      this.logger.info('Portfolio imported successfully');
    } catch (error) {
      this.logger.error('Failed to import portfolio:', error);
      throw error;
    }
  }
}