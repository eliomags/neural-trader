export class TechnicalIndicators {
  calculateRSI(prices: any[], period: number = 14): number {
    if (!prices || prices.length < period) return 50;

    const closes = prices.map(p => p.close || p);
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period && i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateMACD(prices: any[]): number[] {
    if (!prices || prices.length < 26) return [0, 0, 0];

    const closes = prices.map(p => p.close || p);
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const macd = ema12 - ema26;
    const signal = this.calculateEMA([macd], 9);
    const histogram = macd - signal;

    return [macd, signal, histogram];
  }

  calculateEMA(prices: number[], period: number): number {
    if (!prices || prices.length === 0) return 0;
    
    const k = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length && i < period; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    
    return ema;
  }

  calculateSMA(prices: number[], period: number): number {
    if (!prices || prices.length < period) return 0;
    
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  calculateBollingerBands(prices: any[], period: number = 20): number[] {
    if (!prices || prices.length < period) return [0, 0, 0];

    const closes = prices.map(p => p.close || p).slice(-period);
    const sma = this.calculateSMA(closes, period);
    
    const variance = closes.reduce((sum, price) => {
      return sum + Math.pow(price - sma, 2);
    }, 0) / period;
    
    const stdDev = Math.sqrt(variance);
    
    return [
      sma + (stdDev * 2), // upper
      sma,                // middle
      sma - (stdDev * 2)  // lower
    ];
  }

  calculateATR(prices: any[], period: number = 14): number {
    if (!prices || prices.length < period + 1) return 0;

    const trueRanges: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const high = prices[i].high || prices[i];
      const low = prices[i].low || prices[i];
      const prevClose = prices[i - 1].close || prices[i - 1];
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      
      trueRanges.push(tr);
    }
    
    return this.calculateSMA(trueRanges, period);
  }

  calculateStochastic(prices: any[], period: number = 14): number {
    if (!prices || prices.length < period) return 50;

    const slice = prices.slice(-period);
    const highs = slice.map(p => p.high || p);
    const lows = slice.map(p => p.low || p);
    const close = slice[slice.length - 1].close || slice[slice.length - 1];
    
    const highest = Math.max(...highs);
    const lowest = Math.min(...lows);
    
    if (highest === lowest) return 50;
    
    return ((close - lowest) / (highest - lowest)) * 100;
  }

  calculateOBV(prices: any[]): number {
    if (!prices || prices.length < 2) return 0;

    let obv = 0;
    
    for (let i = 1; i < prices.length; i++) {
      const currentClose = prices[i].close || prices[i];
      const prevClose = prices[i - 1].close || prices[i - 1];
      const volume = prices[i].volume || 0;
      
      if (currentClose > prevClose) {
        obv += volume;
      } else if (currentClose < prevClose) {
        obv -= volume;
      }
    }
    
    return obv;
  }

  calculateVWAP(prices: any[]): number {
    if (!prices || prices.length === 0) return 0;

    let totalVolume = 0;
    let totalVolumePrice = 0;
    
    for (const price of prices) {
      const typical = ((price.high || price) + (price.low || price) + (price.close || price)) / 3;
      const volume = price.volume || 0;
      
      totalVolumePrice += typical * volume;
      totalVolume += volume;
    }
    
    return totalVolume > 0 ? totalVolumePrice / totalVolume : 0;
  }

  calculateFibonacciLevels(high: number, low: number): any {
    const diff = high - low;
    
    return {
      0: high,
      0.236: high - diff * 0.236,
      0.382: high - diff * 0.382,
      0.5: high - diff * 0.5,
      0.618: high - diff * 0.618,
      0.786: high - diff * 0.786,
      1: low
    };
  }

  detectPatterns(prices: any[]): string[] {
    const patterns: string[] = [];
    
    if (this.isDojiPattern(prices)) patterns.push('doji');
    if (this.isHammerPattern(prices)) patterns.push('hammer');
    if (this.isEngulfingPattern(prices)) patterns.push('engulfing');
    if (this.isTrianglePattern(prices)) patterns.push('triangle');
    if (this.isHeadAndShoulders(prices)) patterns.push('head_and_shoulders');
    
    return patterns;
  }

  private isDojiPattern(prices: any[]): boolean {
    if (!prices || prices.length === 0) return false;
    
    const last = prices[prices.length - 1];
    const body = Math.abs((last.close || last) - (last.open || last));
    const range = (last.high || last) - (last.low || last);
    
    return body < range * 0.1;
  }

  private isHammerPattern(prices: any[]): boolean {
    if (!prices || prices.length === 0) return false;
    
    const last = prices[prices.length - 1];
    const body = Math.abs((last.close || last) - (last.open || last));
    const lowerWick = Math.min(last.open || last, last.close || last) - (last.low || last);
    
    return lowerWick > body * 2;
  }

  private isEngulfingPattern(prices: any[]): boolean {
    if (!prices || prices.length < 2) return false;
    
    const prev = prices[prices.length - 2];
    const last = prices[prices.length - 1];
    
    const prevBody = Math.abs((prev.close || prev) - (prev.open || prev));
    const lastBody = Math.abs((last.close || last) - (last.open || last));
    
    return lastBody > prevBody * 1.5;
  }

  private isTrianglePattern(prices: any[]): boolean {
    if (!prices || prices.length < 10) return false;
    
    const highs = prices.slice(-10).map(p => p.high || p);
    const lows = prices.slice(-10).map(p => p.low || p);
    
    // Check for converging highs and lows
    const highTrend = this.calculateTrend(highs);
    const lowTrend = this.calculateTrend(lows);
    
    return Math.abs(highTrend) < 0.01 && Math.abs(lowTrend) < 0.01;
  }

  private isHeadAndShoulders(prices: any[]): boolean {
    if (!prices || prices.length < 15) return false;
    
    // Simplified head and shoulders detection
    const slice = prices.slice(-15).map(p => p.high || p);
    const maxIndex = slice.indexOf(Math.max(...slice));
    
    return maxIndex > 4 && maxIndex < 10;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }
}