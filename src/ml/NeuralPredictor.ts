import * as tf from '@tensorflow/tfjs-node';
import { Logger } from '../utils/Logger';
import { MarketData, Prediction } from '../types';
import { TechnicalIndicators } from '../analysis/TechnicalIndicators';
import * as fs from 'fs/promises';
import * as path from 'path';

export class NeuralPredictor {
  private logger: Logger;
  private models: Map<string, tf.LayersModel> = new Map();
  private indicators: TechnicalIndicators;
  private modelPath: string = './models';

  constructor() {
    this.logger = new Logger('NeuralPredictor');
    this.indicators = new TechnicalIndicators();
  }

  async loadModels(): Promise<void> {
    this.logger.info('Loading neural network models...');

    try {
      // Load or create models for different timeframes
      const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
      
      for (const timeframe of timeframes) {
        const model = await this.loadOrCreateModel(timeframe);
        this.models.set(timeframe, model);
      }

      // Load ensemble model
      const ensembleModel = await this.createEnsembleModel();
      this.models.set('ensemble', ensembleModel);

      this.logger.info(`Loaded ${this.models.size} models successfully`);
    } catch (error) {
      this.logger.error('Failed to load models:', error);
      throw error;
    }
  }

  private async loadOrCreateModel(timeframe: string): Promise<tf.LayersModel> {
    const modelPath = path.join(this.modelPath, `model_${timeframe}`);
    
    try {
      // Try to load existing model
      const model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
      this.logger.info(`Loaded existing model for ${timeframe}`);
      return model;
    } catch (error) {
      // Create new model if not found
      this.logger.info(`Creating new model for ${timeframe}`);
      return this.createLSTMModel();
    }
  }

  private createLSTMModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          units: 128,
          returnSequences: true,
          inputShape: [60, 15] // 60 time steps, 15 features
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({
          units: 64,
          returnSequences: true
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({
          units: 32,
          returnSequences: false
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 3, activation: 'softmax' }) // Buy, Hold, Sell
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  private createEnsembleModel(): tf.LayersModel {
    const input = tf.input({ shape: [18] }); // 6 models * 3 outputs
    
    const dense1 = tf.layers.dense({
      units: 64,
      activation: 'relu'
    }).apply(input) as tf.SymbolicTensor;
    
    const dropout1 = tf.layers.dropout({
      rate: 0.3
    }).apply(dense1) as tf.SymbolicTensor;
    
    const dense2 = tf.layers.dense({
      units: 32,
      activation: 'relu'
    }).apply(dropout1) as tf.SymbolicTensor;
    
    const dropout2 = tf.layers.dropout({
      rate: 0.3
    }).apply(dense2) as tf.SymbolicTensor;
    
    const dense3 = tf.layers.dense({
      units: 16,
      activation: 'relu'
    }).apply(dropout2) as tf.SymbolicTensor;
    
    const output = tf.layers.dense({
      units: 3,
      activation: 'softmax'
    }).apply(dense3) as tf.SymbolicTensor;
    
    const model = tf.model({
      inputs: input,
      outputs: output
    });
    
    model.compile({
      optimizer: tf.train.adam(0.0005),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    return model;
  }

  async predict(marketData: MarketData): Promise<Prediction> {
    try {
      // Prepare features
      const features = await this.prepareFeatures(marketData);
      
      // Get predictions from individual models
      const predictions: number[][] = [];
      
      for (const [timeframe, model] of this.models) {
        if (timeframe === 'ensemble') continue;
        
        const input = tf.tensor3d([features], [1, 60, 15]);
        const prediction = model.predict(input) as tf.Tensor;
        const predArray = await prediction.array() as number[][];
        predictions.push(predArray[0]);
        
        input.dispose();
        prediction.dispose();
      }
      
      // Ensemble prediction
      const ensembleInput = tf.tensor2d([predictions.flat()], [1, 18]);
      const ensembleModel = this.models.get('ensemble')!;
      const ensemblePred = ensembleModel.predict(ensembleInput) as tf.Tensor;
      const ensembleArray = await ensemblePred.array() as number[][];
      
      ensembleInput.dispose();
      ensemblePred.dispose();
      
      // Interpret results
      const [sellProb, holdProb, buyProb] = ensembleArray[0];
      const maxProb = Math.max(sellProb, holdProb, buyProb);
      
      let direction: 'up' | 'down' | 'neutral';
      if (buyProb === maxProb) {
        direction = 'up';
      } else if (sellProb === maxProb) {
        direction = 'down';
      } else {
        direction = 'neutral';
      }
      
      // Calculate predicted price
      const priceChange = (buyProb - sellProb) * 0.05; // Max 5% change
      const predictedPrice = marketData.price * (1 + priceChange);
      
      return {
        confidence: maxProb,
        direction,
        predictedPrice,
        timeframe: '1h',
        probabilities: {
          buy: buyProb,
          hold: holdProb,
          sell: sellProb
        },
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Prediction failed:', error);
      throw error;
    }
  }

  private async prepareFeatures(marketData: MarketData): Promise<number[][]> {
    const features: number[][] = [];
    
    // Get historical data (last 60 candles)
    const history = marketData.history || [];
    
    for (let i = 0; i < Math.min(60, history.length); i++) {
      const candle = history[i];
      
      const row = [
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.volume,
        this.indicators.calculateRSI(history.slice(0, i + 14).map(c => c.close)),
        ...this.indicators.calculateMACD(history.slice(0, i + 26).map(c => c.close)),
        ...this.indicators.calculateBollingerBands(history.slice(0, i + 20)),
        this.indicators.calculateEMA(history.slice(0, i + 12).map(c => c.close), 12),
        this.indicators.calculateEMA(history.slice(0, i + 26).map(c => c.close), 26),
        this.indicators.calculateATR(history.slice(0, i + 14)),
        this.indicators.calculateStochastic(history.slice(0, i + 14))
      ];
      
      features.push(this.normalizeFeatures(row));
    }
    
    // Pad if necessary
    while (features.length < 60) {
      features.push(new Array(15).fill(0));
    }
    
    return features;
  }

  private normalizeFeatures(features: number[]): number[] {
    // Simple min-max normalization
    return features.map(f => {
      if (isNaN(f) || !isFinite(f)) return 0;
      return Math.max(-1, Math.min(1, f / 100));
    });
  }

  async train(trainingData: any[]): Promise<void> {
    this.logger.info('Starting model training...');
    
    try {
      for (const [timeframe, model] of this.models) {
        if (timeframe === 'ensemble') continue;
        
        const { inputs, outputs } = this.prepareTrainingData(trainingData, timeframe);
        
        const inputTensor = tf.tensor3d(inputs);
        const outputTensor = tf.tensor2d(outputs);
        
        await model.fit(inputTensor, outputTensor, {
          epochs: 50,
          batchSize: 32,
          validationSplit: 0.2,
          callbacks: {
            onEpochEnd: (epoch, logs) => {
              this.logger.debug(`${timeframe} - Epoch ${epoch}: loss = ${logs?.loss}`);
            }
          }
        });
        
        inputTensor.dispose();
        outputTensor.dispose();
        
        // Save model
        await this.saveModel(model, timeframe);
      }
      
      this.logger.info('Model training completed');
    } catch (error) {
      this.logger.error('Training failed:', error);
      throw error;
    }
  }

  private prepareTrainingData(data: any[], timeframe: string): any {
    // Convert raw data to training format
    const inputs: number[][][] = [];
    const outputs: number[][] = [];
    
    // Implementation would process historical data into
    // sequences suitable for LSTM training
    
    return { inputs, outputs };
  }

  private async saveModel(model: tf.LayersModel, timeframe: string): Promise<void> {
    const modelPath = path.join(this.modelPath, `model_${timeframe}`);
    await fs.mkdir(modelPath, { recursive: true });
    await model.save(`file://${modelPath}`);
    this.logger.info(`Model saved for ${timeframe}`);
  }

  async updateModels(newData: any[]): Promise<void> {
    // Incremental learning with new data
    this.logger.info('Updating models with new data...');
    
    for (const [timeframe, model] of this.models) {
      if (timeframe === 'ensemble') continue;
      
      const { inputs, outputs } = this.prepareTrainingData(newData, timeframe);
      
      if (inputs.length === 0) continue;
      
      const inputTensor = tf.tensor3d(inputs);
      const outputTensor = tf.tensor2d(outputs);
      
      await model.fit(inputTensor, outputTensor, {
        epochs: 5,
        batchSize: 16
      });
      
      inputTensor.dispose();
      outputTensor.dispose();
    }
    
    this.logger.info('Models updated successfully');
  }

  getModelMetrics(): any {
    const metrics: any = {};
    
    for (const [timeframe, model] of this.models) {
      metrics[timeframe] = {
        layers: model.layers.length,
        parameters: model.countParams(),
        compiled: true
      };
    }
    
    return metrics;
  }
}