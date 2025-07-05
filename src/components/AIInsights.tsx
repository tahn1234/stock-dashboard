import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Brain, AlertTriangle, Target, Zap } from 'lucide-react';

interface AIInsightsProps {
  ticker: string;
  currentPrice: number;
  historicalData: any[];
  predictions?: any;
}

interface Insight {
  type: 'bullish' | 'bearish' | 'neutral' | 'warning';
  title: string;
  description: string;
  confidence: number;
  icon: React.ReactNode;
}

const AIInsights: React.FC<AIInsightsProps> = ({ ticker, currentPrice, historicalData, predictions }) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [sentiment, setSentiment] = useState<'bullish' | 'bearish' | 'neutral'>('neutral');
  const [volatility, setVolatility] = useState<number>(0);
  const [momentum, setMomentum] = useState<number>(0);

  useEffect(() => {
    if (historicalData.length > 0) {
      generateInsights();
    }
  }, [historicalData, currentPrice, predictions]);

  // Calculate exponential moving average
  const calculateEMA = (data: number[], period: number) => {
    if (data.length < period) return data;
    
    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
    const emaValues = [ema];
    
    for (let i = period; i < data.length; i++) {
      ema = (data[i] * multiplier) + (ema * (1 - multiplier));
      emaValues.push(ema);
    }
    
    return emaValues;
  };

  // Proper volatility calculation with exponential smoothing
  const calculateVolatility = (data: any[]) => {
    if (data.length < 2) return 0;
    
    // Calculate log returns
    const returns = data.slice(1).map((item, index) => 
      Math.log(item.close / data[index].close)
    );
    
    // Use exponential moving average for volatility
    const emaReturns = calculateEMA(returns, 20);
    const mean = emaReturns[emaReturns.length - 1];
    
    // Calculate variance using exponential smoothing
    let variance = 0;
    const alpha = 0.1; // Smoothing factor
    
    for (let i = 0; i < returns.length; i++) {
      const diff = returns[i] - mean;
      variance = alpha * (diff * diff) + (1 - alpha) * variance;
    }
    
    return Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized volatility
  };

  // Proper momentum calculation using Rate of Change (ROC)
  const calculateMomentum = (data: any[]) => {
    if (data.length < 20) return 0;
    
    const currentPrice = data[data.length - 1].close;
    const price20PeriodsAgo = data[data.length - 20].close;
    
    // Rate of Change (ROC) = ((Current Price - Price n periods ago) / Price n periods ago) * 100
    return ((currentPrice - price20PeriodsAgo) / price20PeriodsAgo) * 100;
  };

  // Proper RSI calculation with exponential smoothing
  const calculateRSI = (data: any[], period = 14) => {
    if (data.length < period + 1) return 50;
    
    const gains: number[] = [];
    const losses: number[] = [];
    
    // Calculate price changes
    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    // Calculate exponential moving averages of gains and losses
    const avgGain = calculateEMA(gains, period);
    const avgLoss = calculateEMA(losses, period);
    
    const currentAvgGain = avgGain[avgGain.length - 1];
    const currentAvgLoss = avgLoss[avgLoss.length - 1];
    
    if (currentAvgLoss === 0) return 100;
    
    const rs = currentAvgGain / currentAvgLoss;
    return 100 - (100 / (1 + rs));
  };

  // Enhanced pattern detection with volume confirmation
  const detectPatterns = (data: any[]): string[] => {
    const patterns: string[] = [];
    
    if (data.length < 10) return patterns;
    
    const recent = data.slice(-10);
    const prices = recent.map(d => d.close);
    const volumes = recent.map(d => d.volume || 0);
    
    // Calculate moving averages for trend analysis
    const sma5 = prices.slice(-5).reduce((sum, price) => sum + price, 0) / 5;
    const sma10 = prices.reduce((sum, price) => sum + price, 0) / 10;
    
    const currentPrice = prices[prices.length - 1];
    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    
    // Trend analysis
    if (currentPrice > sma5 && sma5 > sma10) {
      patterns.push('Uptrend');
    } else if (currentPrice < sma5 && sma5 < sma10) {
      patterns.push('Downtrend');
    }
    
    // Volume analysis
    if (currentVolume > avgVolume * 1.5) {
      patterns.push('High Volume');
    }
    
    // Support/Resistance detection
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const priceRange = maxPrice - minPrice;
    
    if (currentPrice > maxPrice - (priceRange * 0.05)) {
      patterns.push('Near Resistance');
    }
    
    if (currentPrice < minPrice + (priceRange * 0.05)) {
      patterns.push('Near Support');
    }
    
    // Breakout detection
    if (currentPrice > sma10 * 1.02 && currentVolume > avgVolume * 1.2) {
      patterns.push('Potential Breakout');
    }
    
    return patterns;
  };

  const generateInsights = () => {
    const newInsights: Insight[] = [];
    const vol = calculateVolatility(historicalData);
    const mom = calculateMomentum(historicalData);
    const rsi = calculateRSI(historicalData);
    const patterns = detectPatterns(historicalData);
    
    setVolatility(vol);
    setMomentum(mom);
    
    // Sentiment analysis based on technical indicators
    let bullishSignals = 0;
    let bearishSignals = 0;
    
    // RSI analysis with proper thresholds
    if (rsi > 70) {
      newInsights.push({
        type: 'warning',
        title: 'Overbought Condition',
        description: `RSI at ${rsi.toFixed(1)} indicates potential selling pressure`,
        confidence: 75,
        icon: <AlertTriangle className="w-4 h-4" />
      });
      bearishSignals++;
    } else if (rsi < 30) {
      newInsights.push({
        type: 'bullish',
        title: 'Oversold Opportunity',
        description: `RSI at ${rsi.toFixed(1)} suggests potential buying opportunity`,
        confidence: 80,
        icon: <TrendingUp className="w-4 h-4" />
      });
      bullishSignals++;
    } else if (rsi > 50) {
      newInsights.push({
        type: 'bullish',
        title: 'Positive Momentum',
        description: `RSI at ${rsi.toFixed(1)} shows positive momentum`,
        confidence: 65,
        icon: <TrendingUp className="w-4 h-4" />
      });
      bullishSignals++;
    }
    
    // Enhanced momentum analysis
    if (mom > 5) {
      newInsights.push({
        type: 'bullish',
        title: 'Strong Upward Momentum',
        description: `ROC of ${mom.toFixed(1)}% indicates strong bullish trend`,
        confidence: 85,
        icon: <Zap className="w-4 h-4" />
      });
      bullishSignals++;
    } else if (mom < -5) {
      newInsights.push({
        type: 'bearish',
        title: 'Negative Momentum',
        description: `ROC of ${mom.toFixed(1)}% suggests bearish pressure`,
        confidence: 80,
        icon: <TrendingDown className="w-4 h-4" />
      });
      bearishSignals++;
    }
    
    // Enhanced volatility analysis
    if (vol > 30) {
      newInsights.push({
        type: 'warning',
        title: 'High Volatility Alert',
        description: `Volatility at ${vol.toFixed(1)}% indicates increased risk`,
        confidence: 90,
        icon: <AlertTriangle className="w-4 h-4" />
      });
    } else if (vol < 10) {
      newInsights.push({
        type: 'neutral',
        title: 'Low Volatility',
        description: `Volatility at ${vol.toFixed(1)}% suggests stable price action`,
        confidence: 70,
        icon: <Target className="w-4 h-4" />
      });
    }
    
    // Enhanced pattern analysis
    patterns.forEach(pattern => {
      let type: 'bullish' | 'bearish' | 'neutral' | 'warning' = 'neutral';
      let confidence = 70;
      
      if (pattern.includes('Uptrend') || pattern.includes('Breakout')) {
        type = 'bullish';
        confidence = 75;
        bullishSignals++;
      } else if (pattern.includes('Downtrend')) {
        type = 'bearish';
        confidence = 75;
        bearishSignals++;
      } else if (pattern.includes('High Volume')) {
        type = 'warning';
        confidence = 80;
      }
      
      newInsights.push({
        type,
        title: `Pattern: ${pattern}`,
        description: `Technical pattern detected with ${confidence}% confidence`,
        confidence,
        icon: <Target className="w-4 h-4" />
      });
    });
    
    // Prediction analysis
    if (predictions && predictions.predictions) {
      const futurePrice = predictions.predictions[predictions.predictions.length - 1];
      const priceChange = ((futurePrice - currentPrice) / currentPrice) * 100;
      
      if (priceChange > 2) {
        newInsights.push({
          type: 'bullish',
          title: 'AI Prediction: Upward Trend',
          description: `Model predicts ${priceChange.toFixed(1)}% increase over next period`,
          confidence: 65,
          icon: <Brain className="w-4 h-4" />
        });
        bullishSignals++;
      } else if (priceChange < -2) {
        newInsights.push({
          type: 'bearish',
          title: 'AI Prediction: Downward Trend',
          description: `Model predicts ${Math.abs(priceChange).toFixed(1)}% decrease over next period`,
          confidence: 65,
          icon: <Brain className="w-4 h-4" />
        });
        bearishSignals++;
      }
    }
    
    // Overall sentiment with weighted scoring
    if (bullishSignals > bearishSignals) {
      setSentiment('bullish');
    } else if (bearishSignals > bullishSignals) {
      setSentiment('bearish');
    } else {
      setSentiment('neutral');
    }
    
    setInsights(newInsights);
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return 'text-green-500';
      case 'bearish': return 'text-red-500';
      default: return 'text-yellow-500';
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'bullish': return 'border-green-500 bg-green-50 dark:bg-green-900/20';
      case 'bearish': return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'warning': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      default: return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Brain className="w-6 h-6 text-blue-500" />
          AI Market Insights
        </h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getSentimentColor(sentiment)}`}>
          {sentiment.toUpperCase()}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Volatility</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {volatility.toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Momentum</div>
          <div className={`text-2xl font-bold ${momentum > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {momentum > 0 ? '+' : ''}{momentum.toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">RSI</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {calculateRSI(historicalData).toFixed(1)}
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="space-y-4">
        {insights.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Analyzing market data...</p>
          </div>
        ) : (
          insights.map((insight, index) => (
            <div
              key={index}
              className={`border-l-4 rounded-lg p-4 ${getInsightColor(insight.type)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-1">{insight.icon}</div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {insight.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {insight.description}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {insight.confidence}% confidence
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AIInsights;