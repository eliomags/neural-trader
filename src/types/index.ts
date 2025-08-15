export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  volatility: number;
  timestamp: number;
  history?: Candle[];
  indicators?: {
    rsi?: number;
    macd?: {
      macd: number;
      signal: number;
      histogram: number;
    };
    bollinger?: {
      upper: number;
      middle: number;
      lower: number;
    };
    ema?: {
      ema12: number;
      ema26: number;
    };
  };
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  price: number;
  targetPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  timeframe: string;
  timestamp: number;
  metadata?: {
    priceChange?: number;
    volume?: number;
    volatility?: number;
    rsi?: number;
    macd?: any;
  };
}

export interface Order {
  id: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  price: number;
  amount: number;
  filled?: number;
  remaining?: number;
  status: OrderStatus;
  timestamp: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: string;
  entryPrice: number;
  quantity: number;
  currentPrice?: number;
  value?: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: number;
}

export interface Prediction {
  confidence: number;
  direction: 'up' | 'down' | 'neutral';
  predictedPrice: number;
  timeframe: string;
  probabilities?: {
    buy: number;
    hold: number;
    sell: number;
  };
  timestamp: number;
}

export interface RiskMetrics {
  currentDrawdown: number;
  maxDrawdown: number;
  openPositions: number;
  maxOpenPositions: number;
  totalExposure: number;
  exposureRatio: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  valueAtRisk: number;
  beta: number;
}

export interface ExchangeConfig {
  name: string;
  apiKey: string;
  secret: string;
  testnet?: boolean;
  enableRateLimit?: boolean;
}

export type OrderType = 'market' | 'limit' | 'stop_loss' | 'take_profit';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'open' | 'closed' | 'canceled' | 'expired';

export interface BacktestResult {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;
  averageReturn: number;
  profitFactor: number;
  startDate: Date;
  endDate: Date;
  initialBalance: number;
  finalBalance: number;
}