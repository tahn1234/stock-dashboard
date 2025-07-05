import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, Calendar, Target, AlertCircle, Brain } from 'lucide-react';

interface PredictionChartProps {
  ticker: string;
  historicalData: any[];
  predictions?: any;
  onRequestPrediction: (days: number) => void;
}

const PredictionChart: React.FC<PredictionChartProps> = ({ 
  ticker, 
  historicalData, 
  predictions, 
  onRequestPrediction 
}) => {
  const [predictionDays, setPredictionDays] = useState(5);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (historicalData.length > 0) {
      prepareChartData();
    }
  }, [historicalData, predictions]);

  const prepareChartData = () => {
    const data = [...historicalData.slice(-30)]; // Last 30 days of historical data
    
    if (predictions && predictions.predictions && predictions.dates) {
      const predictionData = predictions.predictions.map((price: number, index: number) => ({
        time: predictions.dates[index],
        price: null,
        predicted: price,
        isPrediction: true
      }));
      
      data.push(...predictionData);
    }
    
    setChartData(data);
  };

  const handlePredictionRequest = async () => {
    setIsLoading(true);
    try {
      await onRequestPrediction(predictionDays);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTooltip = (value: any, name: string) => {
    if (name === 'price') return [`$${value?.toFixed(2)}`, 'Historical Price'];
    if (name === 'predicted') return [`$${value?.toFixed(2)}`, 'Predicted Price'];
    return [value, name];
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-3 border rounded-lg shadow-lg bg-gray-800 border-gray-600 text-white">
          <p className="font-semibold">{label}</p>
          {payload.map((entry: any, index: number) => {
            const [value, name] = formatTooltip(entry.value, entry.dataKey);
            if (entry.value === null) return null;
            return (
              <p key={index} style={{ color: entry.color }} className="text-sm">
                {name}: {value}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const calculateAccuracy = () => {
    if (!predictions || !predictions.last_price) return null;
    
    const currentPrice = historicalData[historicalData.length - 1]?.close || historicalData[historicalData.length - 1]?.price;
    if (!currentPrice) return null;
    
    const accuracy = 100 - Math.abs((currentPrice - predictions.last_price) / predictions.last_price) * 100;
    return Math.max(0, accuracy);
  };

  const accuracy = calculateAccuracy();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Brain className="w-6 h-6 text-blue-500" />
          AI Price Predictions
        </h3>
        {accuracy && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Model Accuracy: <span className="font-semibold text-green-500">{accuracy.toFixed(1)}%</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Prediction Days:
          </label>
          <select
            value={predictionDays}
            onChange={(e) => setPredictionDays(Number(e.target.value))}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value={1}>1 Day</option>
            <option value={3}>3 Days</option>
            <option value={5}>5 Days</option>
            <option value={7}>7 Days</option>
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
          </select>
        </div>
        <button
          onClick={handlePredictionRequest}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-md flex items-center gap-2 transition-colors"
        >
          <Target className="w-4 h-4" />
          {isLoading ? 'Generating...' : 'Generate Prediction'}
        </button>
      </div>

      {/* Chart */}
      <div className="h-96 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis 
              dataKey="time" 
              stroke="#6B7280"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              stroke="#6B7280"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
              domain={['dataMin - 5', 'dataMax + 5']}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Historical prices */}
            <Line
              type="monotone"
              dataKey="price"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            
            {/* Predicted prices */}
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="#EF4444"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#EF4444', strokeWidth: 2, r: 3 }}
              connectNulls={false}
            />
            
            {/* Reference line for current price */}
            {historicalData.length > 0 && (
              <ReferenceLine 
                y={historicalData[historicalData.length - 1]?.close || historicalData[historicalData.length - 1]?.price} 
                stroke="#10B981" 
                strokeDasharray="2 2"
                label={{ value: "Current", position: "insideTopRight" }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Prediction Summary */}
      {predictions && predictions.predictions && (
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Prediction Summary
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Current Price:</span>
                  <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                    ${predictions.last_price?.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Predicted Price:</span>
                  <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                    ${predictions.predictions[predictions.predictions.length - 1]?.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Expected Change:</span>
                  <span className={`ml-2 font-semibold ${
                    predictions.predictions[predictions.predictions.length - 1] > predictions.last_price 
                      ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {(((predictions.predictions[predictions.predictions.length - 1] - predictions.last_price) / predictions.last_price) * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                {predictions.disclaimer}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No predictions message */}
      {!predictions && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Click "Generate Prediction" to see AI-powered price forecasts</p>
          <p className="text-sm mt-2">Uses LSTM neural networks for time-series analysis</p>
        </div>
      )}
    </div>
  );
};

export default PredictionChart;