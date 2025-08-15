import { Logger } from '../utils/Logger';
import axios from 'axios';

export interface StockFundamentals {
  symbol: string;
  marketCap: number;
  pe: number;
  eps: number;
  dividend: number;
  dividendYield: number;
  beta: number;
  revenue: number;
  profitMargin: number;
  roe: number; // Return on Equity
  roa: number; // Return on Assets
  debtToEquity: number;
  currentRatio: number;
  quickRatio: number;
  priceToBook: number;
  priceToSales: number;
  peg: number; // Price/Earnings to Growth
  forwardPE: number;
  enterpriseValue: number;
  ebitda: number;
}

export interface StockSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  strategy: string;
  fundamentalScore: number;
  technicalScore: number;
  sentimentScore: number;
  reasons: string[];
  targetPrice: number;
  stopLoss: number;
  timeHorizon: string;
  timestamp?: number;
}

export class StockAnalyzer {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('StockAnalyzer');
  }

  async analyzeStock(symbol: string): Promise<StockSignal> {
    const [fundamentals, technicals, sentiment] = await Promise.all([
      this.analyzeFundamentals(symbol),
      this.analyzeTechnicals(symbol),
      this.analyzeSentiment(symbol)
    ]);

    const signal = this.generateSignal(symbol, fundamentals, technicals, sentiment);
    return signal;
  }

  private async analyzeFundamentals(symbol: string): Promise<any> {
    try {
      // Fetch fundamental data
      const fundamentals = await this.getFundamentalData(symbol);
      
      // Calculate fundamental scores
      const valueScore = this.calculateValueScore(fundamentals);
      const growthScore = this.calculateGrowthScore(fundamentals);
      const qualityScore = this.calculateQualityScore(fundamentals);
      const financialHealth = this.calculateFinancialHealth(fundamentals);

      return {
        data: fundamentals,
        scores: {
          value: valueScore,
          growth: growthScore,
          quality: qualityScore,
          health: financialHealth,
          overall: (valueScore + growthScore + qualityScore + financialHealth) / 4
        }
      };
    } catch (error) {
      this.logger.error(`Failed to analyze fundamentals for ${symbol}:`, error);
      return null;
    }
  }

  private async getFundamentalData(symbol: string): Promise<StockFundamentals> {
    // Mock implementation - would fetch from API
    return {
      symbol,
      marketCap: 1000000000,
      pe: 25,
      eps: 4.5,
      dividend: 1.2,
      dividendYield: 0.02,
      beta: 1.1,
      revenue: 500000000,
      profitMargin: 0.15,
      roe: 0.18,
      roa: 0.12,
      debtToEquity: 0.5,
      currentRatio: 1.8,
      quickRatio: 1.2,
      priceToBook: 3,
      priceToSales: 2,
      peg: 1.5,
      forwardPE: 22,
      enterpriseValue: 1100000000,
      ebitda: 200000000
    };
  }

  private calculateValueScore(fundamentals: StockFundamentals): number {
    let score = 0;
    
    // P/E ratio scoring
    if (fundamentals.pe > 0 && fundamentals.pe < 15) score += 25;
    else if (fundamentals.pe < 20) score += 15;
    else if (fundamentals.pe < 25) score += 10;
    
    // P/B ratio scoring
    if (fundamentals.priceToBook < 1) score += 25;
    else if (fundamentals.priceToBook < 2) score += 15;
    else if (fundamentals.priceToBook < 3) score += 10;
    
    // P/S ratio scoring
    if (fundamentals.priceToSales < 1) score += 25;
    else if (fundamentals.priceToSales < 2) score += 15;
    else if (fundamentals.priceToSales < 3) score += 10;
    
    // PEG ratio scoring
    if (fundamentals.peg > 0 && fundamentals.peg < 1) score += 25;
    else if (fundamentals.peg < 1.5) score += 15;
    else if (fundamentals.peg < 2) score += 10;
    
    return Math.min(100, score);
  }

  private calculateGrowthScore(fundamentals: StockFundamentals): number {
    let score = 0;
    
    // Revenue growth (would need historical data)
    score += 25;
    
    // EPS growth (would need historical data)
    score += 25;
    
    // ROE scoring
    if (fundamentals.roe > 0.20) score += 25;
    else if (fundamentals.roe > 0.15) score += 15;
    else if (fundamentals.roe > 0.10) score += 10;
    
    // Profit margin scoring
    if (fundamentals.profitMargin > 0.20) score += 25;
    else if (fundamentals.profitMargin > 0.15) score += 15;
    else if (fundamentals.profitMargin > 0.10) score += 10;
    
    return Math.min(100, score);
  }

  private calculateQualityScore(fundamentals: StockFundamentals): number {
    let score = 0;
    
    // ROA scoring
    if (fundamentals.roa > 0.15) score += 33;
    else if (fundamentals.roa > 0.10) score += 20;
    else if (fundamentals.roa > 0.05) score += 10;
    
    // Current ratio scoring
    if (fundamentals.currentRatio > 2) score += 33;
    else if (fundamentals.currentRatio > 1.5) score += 20;
    else if (fundamentals.currentRatio > 1) score += 10;
    
    // Debt to equity scoring
    if (fundamentals.debtToEquity < 0.3) score += 34;
    else if (fundamentals.debtToEquity < 0.5) score += 20;
    else if (fundamentals.debtToEquity < 1) score += 10;
    
    return Math.min(100, score);
  }

  private calculateFinancialHealth(fundamentals: StockFundamentals): number {
    let score = 0;
    
    // Quick ratio scoring
    if (fundamentals.quickRatio > 1.5) score += 50;
    else if (fundamentals.quickRatio > 1) score += 30;
    else if (fundamentals.quickRatio > 0.5) score += 15;
    
    // Debt levels
    if (fundamentals.debtToEquity < 0.5) score += 50;
    else if (fundamentals.debtToEquity < 1) score += 30;
    else if (fundamentals.debtToEquity < 2) score += 15;
    
    return Math.min(100, score);
  }

  private async analyzeTechnicals(symbol: string): Promise<any> {
    // Technical analysis implementation
    return {
      trend: 'bullish',
      momentum: 65,
      support: 150,
      resistance: 160,
      rsi: 55,
      macd: { signal: 'buy', strength: 0.7 },
      movingAverages: {
        sma20: 152,
        sma50: 148,
        sma200: 145
      },
      score: 70
    };
  }

  private async analyzeSentiment(symbol: string): Promise<any> {
    try {
      // Fetch recent news
      const news = await this.getNews(symbol);
      
      // Analyze sentiment
      const sentimentScores = news.map(article => this.scoreSentiment(article));
      const avgSentiment = sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length;
      
      // Social media sentiment (would need Twitter/Reddit API)
      const socialSentiment = await this.getSocialSentiment(symbol);
      
      // Insider trading activity
      const insiderActivity = await this.getInsiderActivity(symbol);
      
      // Analyst ratings
      const analystRatings = await this.getAnalystRatings(symbol);
      
      return {
        news: avgSentiment,
        social: socialSentiment,
        insiders: insiderActivity,
        analysts: analystRatings,
        score: (avgSentiment + socialSentiment + insiderActivity + analystRatings) / 4
      };
    } catch (error) {
      this.logger.error(`Failed to analyze sentiment for ${symbol}:`, error);
      return { score: 50 }; // Neutral
    }
  }

  private async getNews(symbol: string): Promise<any[]> {
    // Fetch news from API
    return [];
  }

  private scoreSentiment(article: any): number {
    // Simple sentiment scoring based on keywords
    const positiveWords = ['growth', 'profit', 'beat', 'upgrade', 'bullish', 'surge', 'rally'];
    const negativeWords = ['loss', 'decline', 'miss', 'downgrade', 'bearish', 'fall', 'crash'];
    
    const text = (article.title + ' ' + article.summary).toLowerCase();
    
    let score = 50; // Neutral
    positiveWords.forEach(word => {
      if (text.includes(word)) score += 10;
    });
    negativeWords.forEach(word => {
      if (text.includes(word)) score -= 10;
    });
    
    return Math.max(0, Math.min(100, score));
  }

  private async getSocialSentiment(symbol: string): Promise<number> {
    // Would integrate with social media APIs
    return 60; // Mock neutral-positive
  }

  private async getInsiderActivity(symbol: string): Promise<number> {
    // Would fetch insider trading data
    return 50; // Mock neutral
  }

  private async getAnalystRatings(symbol: string): Promise<number> {
    // Would fetch analyst consensus
    return 70; // Mock positive
  }

  private generateSignal(
    symbol: string,
    fundamentals: any,
    technicals: any,
    sentiment: any
  ): StockSignal {
    const fundamentalScore = fundamentals?.scores?.overall || 50;
    const technicalScore = technicals?.score || 50;
    const sentimentScore = sentiment?.score || 50;
    
    // Weighted average
    const overallScore = (
      fundamentalScore * 0.4 +
      technicalScore * 0.4 +
      sentimentScore * 0.2
    );
    
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    const reasons: string[] = [];
    
    if (overallScore > 70) {
      action = 'BUY';
      if (fundamentalScore > 70) reasons.push('Strong fundamentals');
      if (technicalScore > 70) reasons.push('Positive technical indicators');
      if (sentimentScore > 70) reasons.push('Bullish sentiment');
    } else if (overallScore < 30) {
      action = 'SELL';
      if (fundamentalScore < 30) reasons.push('Weak fundamentals');
      if (technicalScore < 30) reasons.push('Negative technical indicators');
      if (sentimentScore < 30) reasons.push('Bearish sentiment');
    } else {
      reasons.push('Mixed signals - monitoring');
    }
    
    // Calculate target and stop loss
    const currentPrice = 155; // Would get from market data
    const volatility = 0.02; // Would calculate from historical data
    
    const targetPrice = action === 'BUY' 
      ? currentPrice * (1 + volatility * 2)
      : action === 'SELL'
      ? currentPrice * (1 - volatility * 2)
      : currentPrice;
    
    const stopLoss = action === 'BUY'
      ? currentPrice * (1 - volatility)
      : action === 'SELL'
      ? currentPrice * (1 + volatility)
      : currentPrice;
    
    return {
      symbol,
      action,
      confidence: overallScore / 100,
      strategy: 'Hybrid',
      fundamentalScore,
      technicalScore,
      sentimentScore,
      reasons,
      targetPrice,
      stopLoss,
      timeHorizon: fundamentalScore > technicalScore ? 'Long-term' : 'Short-term',
      timestamp: Date.now()
    };
  }

  async screenStocks(criteria: any): Promise<string[]> {
    // Screen stocks based on criteria
    const universe = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'JPM', 'V', 'JNJ'];
    
    const screened: string[] = [];
    
    for (const symbol of universe) {
      const signal = await this.analyzeStock(symbol);
      
      if (this.matchesCriteria(signal, criteria)) {
        screened.push(symbol);
      }
    }
    
    return screened;
  }

  private matchesCriteria(signal: StockSignal, criteria: any): boolean {
    if (criteria.minConfidence && signal.confidence < criteria.minConfidence) return false;
    if (criteria.action && signal.action !== criteria.action) return false;
    if (criteria.minFundamental && signal.fundamentalScore < criteria.minFundamental) return false;
    if (criteria.minTechnical && signal.technicalScore < criteria.minTechnical) return false;
    
    return true;
  }

  async getEarningsCalendar(days: number = 7): Promise<any[]> {
    // Fetch upcoming earnings
    try {
      const response = await axios.get('https://finnhub.io/api/v1/calendar/earnings', {
        params: {
          from: new Date().toISOString().split('T')[0],
          to: new Date(Date.now() + days * 86400000).toISOString().split('T')[0],
          token: process.env.FINNHUB_API_KEY
        }
      });
      
      return response.data.earningsCalendar || [];
    } catch (error) {
      this.logger.error('Failed to get earnings calendar:', error);
      return [];
    }
  }

  async getIPOCalendar(): Promise<any[]> {
    // Fetch upcoming IPOs
    try {
      const response = await axios.get('https://finnhub.io/api/v1/calendar/ipo', {
        params: {
          from: new Date().toISOString().split('T')[0],
          to: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          token: process.env.FINNHUB_API_KEY
        }
      });
      
      return response.data.ipoCalendar || [];
    } catch (error) {
      this.logger.error('Failed to get IPO calendar:', error);
      return [];
    }
  }
}