import { Sequelize, DataTypes, Model } from 'sequelize';
import { Logger } from '../utils/Logger';
import { Position } from '../types';

class PositionModel extends Model {}
class TradeModel extends Model {}
class SignalModel extends Model {}

export class Database {
  private logger: Logger;
  private sequelize: Sequelize;

  constructor() {
    this.logger = new Logger('Database');
    
    // Use SQLite for simplicity, can be changed to PostgreSQL
    this.sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: './data/neural-trader.db',
      logging: false
    });

    this.initModels();
  }

  private initModels(): void {
    PositionModel.init({
      id: {
        type: DataTypes.STRING,
        primaryKey: true
      },
      symbol: DataTypes.STRING,
      side: DataTypes.STRING,
      entryPrice: DataTypes.FLOAT,
      exitPrice: DataTypes.FLOAT,
      quantity: DataTypes.FLOAT,
      stopLoss: DataTypes.FLOAT,
      takeProfit: DataTypes.FLOAT,
      status: DataTypes.STRING,
      realizedPnl: DataTypes.FLOAT,
      timestamp: DataTypes.BIGINT
    }, {
      sequelize: this.sequelize,
      modelName: 'Position'
    });

    TradeModel.init({
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      positionId: DataTypes.STRING,
      symbol: DataTypes.STRING,
      side: DataTypes.STRING,
      entryPrice: DataTypes.FLOAT,
      exitPrice: DataTypes.FLOAT,
      quantity: DataTypes.FLOAT,
      pnl: DataTypes.FLOAT,
      timestamp: DataTypes.BIGINT
    }, {
      sequelize: this.sequelize,
      modelName: 'Trade'
    });

    SignalModel.init({
      id: {
        type: DataTypes.STRING,
        primaryKey: true
      },
      symbol: DataTypes.STRING,
      action: DataTypes.STRING,
      price: DataTypes.FLOAT,
      targetPrice: DataTypes.FLOAT,
      stopLoss: DataTypes.FLOAT,
      takeProfit: DataTypes.FLOAT,
      confidence: DataTypes.FLOAT,
      executed: DataTypes.BOOLEAN,
      timestamp: DataTypes.BIGINT
    }, {
      sequelize: this.sequelize,
      modelName: 'Signal'
    });
  }

  async connect(): Promise<void> {
    try {
      await this.sequelize.authenticate();
      await this.sequelize.sync();
      this.logger.info('Database connected successfully');
    } catch (error) {
      this.logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.sequelize.close();
    this.logger.info('Database disconnected');
  }

  async savePosition(position: Position): Promise<void> {
    await PositionModel.create({
      ...position,
      status: 'open'
    });
  }

  async updatePosition(id: string, updates: Partial<Position>): Promise<void> {
    await PositionModel.update(updates, {
      where: { id }
    });
  }

  async closePosition(id: string, exitPrice: number, pnl: number): Promise<void> {
    await PositionModel.update({
      exitPrice,
      realizedPnl: pnl,
      status: 'closed'
    }, {
      where: { id }
    });
  }

  async saveTrade(trade: any): Promise<void> {
    await TradeModel.create(trade);
  }

  async saveSignal(signal: any): Promise<void> {
    await SignalModel.create({
      ...signal,
      executed: false
    });
  }

  async getOpenPositions(): Promise<any[]> {
    return await PositionModel.findAll({
      where: { status: 'open' }
    });
  }

  async getTradeHistory(limit: number = 100): Promise<any[]> {
    return await TradeModel.findAll({
      limit,
      order: [['timestamp', 'DESC']]
    });
  }

  async getSignalHistory(limit: number = 100): Promise<any[]> {
    return await SignalModel.findAll({
      limit,
      order: [['timestamp', 'DESC']]
    });
  }
}