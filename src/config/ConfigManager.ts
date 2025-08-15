import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../utils/Logger';

export class ConfigManager {
  private logger: Logger;
  private config: any = {};
  private configPath: string = './config/trading.json';

  constructor() {
    this.logger = new Logger('ConfigManager');
  }

  async load(): Promise<void> {
    try {
      // Try to load existing config
      const configData = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);
      this.logger.info('Configuration loaded from file');
    } catch (error) {
      // Use default config if file doesn't exist
      this.config = this.getDefaultConfig();
      await this.save();
      this.logger.info('Using default configuration');
    }

    // Override with environment variables
    this.loadEnvironmentOverrides();
  }

  private getDefaultConfig(): any {
    return {
      trading: {
        enabled: true,
        mode: 'paper', // 'paper' or 'live'
        exchanges: ['binance'],
        symbols: [
          'BTC/USDT',
          'ETH/USDT',
          'BNB/USDT',
          'SOL/USDT',
          'ADA/USDT'
        ],
        timeframes: ['1m', '5m', '15m', '1h'],
        updateInterval: 60000 // 1 minute
      },
      risk: {
        maxPositionSize: 10000,
        maxDrawdown: 0.2,
        riskPerTrade: 0.02,
        maxOpenPositions: 10,
        stopLossPercentage: 0.05,
        takeProfitPercentage: 0.1
      },
      ml: {
        modelUpdateInterval: 86400000, // 24 hours
        predictionThreshold: 0.65,
        retrainThreshold: 1000, // Number of new samples
        ensembleWeights: {
          lstm: 0.3,
          gru: 0.3,
          transformer: 0.4
        }
      },
      notifications: {
        enabled: true,
        channels: ['console', 'file'],
        thresholds: {
          pnl: 100,
          drawdown: 0.1,
          signal: 0.8
        }
      },
      backtesting: {
        startDate: '2023-01-01',
        endDate: '2024-01-01',
        initialBalance: 10000,
        commission: 0.001
      },
      api: {
        port: 3000,
        cors: true,
        rateLimit: {
          windowMs: 60000,
          max: 100
        }
      }
    };
  }

  private loadEnvironmentOverrides(): void {
    if (process.env.TRADING_MODE) {
      this.config.trading.mode = process.env.TRADING_MODE;
    }

    if (process.env.MAX_POSITION_SIZE) {
      this.config.risk.maxPositionSize = parseFloat(process.env.MAX_POSITION_SIZE);
    }

    if (process.env.RISK_PERCENTAGE) {
      this.config.risk.riskPerTrade = parseFloat(process.env.RISK_PERCENTAGE) / 100;
    }

    if (process.env.PREDICTION_THRESHOLD) {
      this.config.ml.predictionThreshold = parseFloat(process.env.PREDICTION_THRESHOLD);
    }
  }

  async save(): Promise<void> {
    try {
      const dir = path.dirname(this.configPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
      this.logger.info('Configuration saved');
    } catch (error) {
      this.logger.error('Failed to save configuration:', error);
    }
  }

  getConfig(): any {
    return this.config;
  }

  get(key: string): any {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      value = value[k];
      if (value === undefined) break;
    }
    
    return value;
  }

  set(key: string, value: any): void {
    const keys = key.split('.');
    let obj = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) {
        obj[keys[i]] = {};
      }
      obj = obj[keys[i]];
    }
    
    obj[keys[keys.length - 1]] = value;
  }

  async update(updates: any): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.save();
  }
}