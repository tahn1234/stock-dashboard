import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, TrendingUp, BarChart3, Zap } from 'lucide-react';

interface TechnicalIndicatorsProps {
  data: any[];
  ticker: string;
}

interface IndicatorData {
  time: string;
  price: number;
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  rsi: number;
  macd: number;
  signal: number;
  bollinger_upper: number;
  bollinger_lower: number;
  bollinger_middle: number;
}

const TechnicalIndicators: React.FC<TechnicalIndicatorsProps> = ({ data, ticker }) => {
  const [indicatorData, setIndicatorData] = useState<IndicatorData[]>([]);
  const [selectedIndicator, setSelectedIndicator] = useState<'moving_averages' | 'rsi' | 'macd' | 'bollinger'>('moving_averages');

  useEffect(() => {
    if (data.length > 0) {
      calculateIndicators();
    }
  }, [data]);

  const calculateSMA = (prices: number[], period: number): number[] => {
    const sma = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        sma.push(NaN);
      } else {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
      }
    }
    return sma;
  };

  const calculateEMA = (prices: number[], period: number): number[] => {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // Initialize EMA with SMA for the first period values
    let sum = 0;
    for (let i = 0; i < Math.min(period, prices.length); i++) {
      sum += prices[i];
    }
    const initialEMA = sum / Math.min(period, prices.length);
    
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        ema.push(NaN);
      } else if (i === period - 1) {
        ema.push(initialEMA);
      } else {
        const newEMA = (prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
        ema.push(newEMA);
      }
    }
    return ema;
  };

  const calculateRSI = (prices: number[], period: number = 14): number[] => {
    const rsi: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];
    
    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    // Calculate exponential moving averages of gains and losses
    const avgGains = calculateEMA(gains, period);
    const avgLosses = calculateEMA(losses, period);
    
    for (let i = 0; i < prices.length; i++) {
      if (i < period) {
        rsi.push(NaN);
      } else {
        const avgGain = avgGains[i - period]; // Correct index adjustment
        const avgLoss = avgLosses[i - period];
        
        if (avgLoss === 0) {
          rsi.push(100);
        } else {
          const rs = avgGain / avgLoss;
          rsi.push(100 - (100 / (1 + rs)));
        }
      }
    }
    
    return rsi;
  };

  const calculateMACD = (prices: number[]): { macd: number[], signal: number[] } => {
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macd = ema12.map((val, i) => {
      if (isNaN(val) || isNaN(ema26[i])) return NaN;
      return val - ema26[i];
    });
    
    // Calculate signal line (9-period EMA of MACD)
    const validMacd = macd.filter(val => !isNaN(val));
    const signal = calculateEMA(validMacd, 9);
    
    // Pad signal array to match macd length
    const paddedSignal = [...Array(macd.length - signal.length).fill(NaN), ...signal];
    
    return { macd, signal: paddedSignal };
  };

  const calculateBollingerBands = (prices: number[], period: number = 20, stdDev: number = 2) => {
    const sma = calculateSMA(prices, period);
    const upper: number[] = [];
    const lower: number[] = [];
    
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        upper.push(NaN);
        lower.push(NaN);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        const mean = sma[i];
        const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
        const standardDeviation = Math.sqrt(variance);
        
        upper.push(mean + (standardDeviation * stdDev));
        lower.push(mean - (standardDeviation * stdDev));
      }
    }
    
    return { upper, lower, middle: sma };
  };

  const calculateIndicators = () => {
    const prices = data.map(d => d.close || d.price);
    
    if (prices.length === 0) return;
    
    const sma20 = calculateSMA(prices, 20);
    const sma50 = calculateSMA(prices, 50);
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const rsi = calculateRSI(prices);
    const { macd, signal } = calculateMACD(prices);
    const { upper: bollinger_upper, lower: bollinger_lower, middle: bollinger_middle } = calculateBollingerBands(prices);
    
    const indicators: IndicatorData[] = data.map((item, index) => ({
      time: item.time,
      price: item.close || item.price,
      sma20: sma20[index],
      sma50: sma50[index],
      ema12: ema12[index],
      ema26: ema26[index],
      rsi: rsi[index],
      macd: macd[index],
      signal: signal[index],
      bollinger_upper: bollinger_upper[index],
      bollinger_lower: bollinger_lower[index],
      bollinger_middle: bollinger_middle[index]
    }));
    
    setIndicatorData(indicators);
  };

  const renderChart = () => {
    switch (selectedIndicator) {
      case 'moving_averages':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={indicatorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="time" stroke="#6B7280" tick={{ fontSize: 12 }} />
              <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="price" stroke="#3B82F6" strokeWidth={2} dot={false} name="Price" />
              <Line type="monotone" dataKey="sma20" stroke="#10B981" strokeWidth={1.5} dot={false} name="SMA 20" />
              <Line type="monotone" dataKey="sma50" stroke="#F59E0B" strokeWidth={1.5} dot={false} name="SMA 50" />
              <Line type="monotone" dataKey="ema12" stroke="#EF4444" strokeWidth={1} dot={false} name="EMA 12" strokeDasharray="5 5" />
              <Line type="monotone" dataKey="ema26" stroke="#8B5CF6" strokeWidth={1} dot={false} name="EMA 26" strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        );
      
      case 'rsi':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={indicatorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="time" stroke="#6B7280" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} stroke="#6B7280" tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
              />
              <Legend />
              <ReferenceLine y={70} stroke="#EF4444" strokeDasharray="2 2" label="Overbought" />
              <ReferenceLine y={30} stroke="#10B981" strokeDasharray="2 2" label="Oversold" />
              <Line type="monotone" dataKey="rsi" stroke="#8B5CF6" strokeWidth={2} dot={false} name="RSI" />
            </LineChart>
          </ResponsiveContainer>
        );
      
      case 'macd':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={indicatorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="time" stroke="#6B7280" tick={{ fontSize: 12 }} />
              <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="1 1" />
              <Line type="monotone" dataKey="macd" stroke="#3B82F6" strokeWidth={2} dot={false} name="MACD" />
              <Line type="monotone" dataKey="signal" stroke="#EF4444" strokeWidth={1.5} dot={false} name="Signal" />
            </LineChart>
          </ResponsiveContainer>
        );
      
      case 'bollinger':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={indicatorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="time" stroke="#6B7280" tick={{ fontSize: 12 }} />
              <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="price" stroke="#3B82F6" strokeWidth={2} dot={false} name="Price" />
              <Line type="monotone" dataKey="bollinger_upper" stroke="#EF4444" strokeWidth={1} dot={false} name="Upper Band" />
              <Line type="monotone" dataKey="bollinger_middle" stroke="#10B981" strokeWidth={1} dot={false} name="Middle Band" />
              <Line type="monotone" dataKey="bollinger_lower" stroke="#EF4444" strokeWidth={1} dot={false} name="Lower Band" />
            </LineChart>
          </ResponsiveContainer>
        );
      
      default:
        return null;
    }
  };

  const getIndicatorIcon = (indicator: string) => {
    switch (indicator) {
      case 'moving_averages': return <TrendingUp className="w-4 h-4" />;
      case 'rsi': return <Activity className="w-4 h-4" />;
      case 'macd': return <Zap className="w-4 h-4" />;
      case 'bollinger': return <BarChart3 className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getCurrentValues = () => {
    if (indicatorData.length === 0) return null;
    const latest = indicatorData[indicatorData.length - 1];
    return {
      rsi: latest?.rsi,
      macd: latest?.macd,
      sma20: latest?.sma20,
      sma50: latest?.sma50
    };
  };

  const currentValues = getCurrentValues();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-blue-500" />
          Technical Indicators
        </h3>
      </div>

      {/* Indicator Selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'moving_averages', label: 'Moving Averages' },
          { key: 'rsi', label: 'RSI' },
          { key: 'macd', label: 'MACD' },
          { key: 'bollinger', label: 'Bollinger Bands' }
        ].map((indicator) => (
          <button
            key={indicator.key}
            onClick={() => setSelectedIndicator(indicator.key as any)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              selectedIndicator === indicator.key
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {getIndicatorIcon(indicator.key)}
            {indicator.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-96 mb-6">
        {indicatorData.length > 0 ? renderChart() : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 dark:text-gray-400">No data available for technical indicators</p>
            </div>
          </div>
        )}
      </div>

      {/* Current Values */}
      {currentValues && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-600 dark:text-gray-400">RSI</div>
            <div className={`text-lg font-bold ${
              currentValues.rsi > 70 ? 'text-red-500' :
              currentValues.rsi < 30 ? 'text-green-500' :
              'text-gray-900 dark:text-white'
            }`}>
              {currentValues.rsi?.toFixed(1) || 'N/A'}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-600 dark:text-gray-400">MACD</div>
            <div className={`text-lg font-bold ${
              currentValues.macd > 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {currentValues.macd?.toFixed(3) || 'N/A'}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-600 dark:text-gray-400">SMA 20</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              ${currentValues.sma20?.toFixed(2) || 'N/A'}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-600 dark:text-gray-400">SMA 50</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              ${currentValues.sma50?.toFixed(2) || 'N/A'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalIndicators;