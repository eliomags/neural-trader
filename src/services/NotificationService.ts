import { Logger } from '../utils/Logger';
import axios from 'axios';

export class NotificationService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('NotificationService');
  }

  async sendNotification(type: string, message: string, data?: any): Promise<void> {
    try {
      // Console notification
      this.logger.info(`[${type}] ${message}`);

      // Telegram notification if configured
      if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        await this.sendTelegramNotification(message, data);
      }

      // Could add more notification channels here (Discord, Slack, Email, etc.)
    } catch (error) {
      this.logger.error('Failed to send notification:', error);
    }
  }

  private async sendTelegramNotification(message: string, data?: any): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    const formattedMessage = this.formatTelegramMessage(message, data);
    
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: formattedMessage,
      parse_mode: 'HTML'
    });
  }

  private formatTelegramMessage(message: string, data?: any): string {
    let formatted = `<b>🤖 Neural Trader Alert</b>\n\n${message}`;
    
    if (data) {
      formatted += '\n\n<b>Details:</b>\n';
      formatted += Object.entries(data)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
    }
    
    return formatted;
  }

  async sendTradeNotification(trade: any): Promise<void> {
    const message = `Trade Executed: ${trade.side} ${trade.quantity} ${trade.symbol} @ ${trade.price}`;
    await this.sendNotification('TRADE', message, trade);
  }

  async sendSignalNotification(signal: any): Promise<void> {
    const message = `Signal Generated: ${signal.action} ${signal.symbol} (Confidence: ${(signal.confidence * 100).toFixed(1)}%)`;
    await this.sendNotification('SIGNAL', message, signal);
  }

  async sendErrorNotification(error: string, details?: any): Promise<void> {
    await this.sendNotification('ERROR', error, details);
  }

  async sendPerformanceUpdate(metrics: any): Promise<void> {
    const message = `Performance Update: Win Rate ${(metrics.winRate * 100).toFixed(1)}%, P&L: $${metrics.totalPnL.toFixed(2)}`;
    await this.sendNotification('PERFORMANCE', message, metrics);
  }
}