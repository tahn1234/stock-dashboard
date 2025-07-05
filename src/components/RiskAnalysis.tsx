import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, TrendingDown, TrendingUp, Target, DollarSign } from 'lucide-react';

interface RiskAnalysisProps {
  ticker: string;
  currentPrice: number;
  historicalData: any[];
  portfolioValue?: number;
}

interface RiskMetrics {
  volatility: number;
  var95: number;
  var99: number;
  sharpeRatio: number;
  maxDrawdown: number;
  beta: number;
  riskLevel: 'low' | 'medium' | 'high';
}

const RiskAnalysis: React.FC<RiskAnalysisProps> = ({ 
  ticker, 
  currentPrice, 
  historicalData, 
  portfolioValue = 10000 
}) => {
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [positionSize, setPositionSize] = useState<number>(1000);
  const [riskTolerance, setRiskTolerance] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');

  useEffect(() => {
    if (historicalData.length > 0) {
      calculateRiskMetrics();
    }
  }, [historicalData, currentPrice]);

  const calculateReturns = (data: any[]) => {
    const returns = [];
    for (let i = 1; i < data.length; i++) {
      const dailyReturn = (data[i].close - data[i - 1].close) / data[i - 1].close;
      returns.push(dailyReturn);
    }
    return returns;
  };

  const calculateVolatility = (returns: number[]) => {
    if (returns.length < 2) return 0;
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (returns.length - 1);
    return Math.sqrt(variance * 252) * 100; // Annualized volatility
  };

  const calculateVaR = (returns: number[], confidence: number) => {
    if (returns.length === 0) return 0;
    const sortedReturns = [...returns].sort((a, b) => a - b);
    let index = Math.floor((1 - confidence) * sortedReturns.length);
    if (index < 0) index = 0;
    if (index >= sortedReturns.length) index = sortedReturns.length - 1;
    return Math.abs(sortedReturns[index]) * 100;
  };

  const calculateSharpeRatio = (returns: number[], riskFreeRate = 0.02) => {
    if (returns.length === 0) return 0;
    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const annualizedReturn = meanReturn * 252;
    const volatility = calculateVolatility(returns) / 100;
    if (volatility === 0) return 0;
    return (annualizedReturn - riskFreeRate) / volatility;
  };

  const calculateMaxDrawdown = (data: any[]) => {
    if (data.length < 2) return 0;
    
    let maxDrawdown = 0;
    let peak = data[0].close;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i].close > peak) {
        peak = data[i].close;
      }
      const drawdown = (peak - data[i].close) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown * 100;
  };

  const calculateBeta = (returns: number[]) => {
    if (returns.length === 0) return 1.0;
    
    // For demonstration, we'll use a simplified beta calculation
    // In a real implementation, you'd need actual market data (e.g., S&P 500 returns)
    const stockMean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const stockVariance = returns.reduce((sum, ret) => sum + Math.pow(ret - stockMean, 2), 0) / (returns.length - 1);
    
    // Simplified beta based on volatility (not ideal but better than the previous calculation)
    const volatility = calculateVolatility(returns);
    
    // Beta estimation based on volatility ranges
    if (volatility < 15) return 0.8;      // Low volatility = lower beta
    else if (volatility < 25) return 1.0; // Medium volatility = market beta
    else return 1.3;                       // High volatility = higher beta
  };

  const calculateRiskMetrics = () => {
    const returns = calculateReturns(historicalData);
    
    if (returns.length === 0) return;
    
    const volatility = calculateVolatility(returns);
    const var95 = calculateVaR(returns, 0.95);
    const var99 = calculateVaR(returns, 0.99);
    const sharpeRatio = calculateSharpeRatio(returns);
    const maxDrawdown = calculateMaxDrawdown(historicalData);
    const beta = calculateBeta(returns);
    
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    if (volatility < 15) riskLevel = 'low';
    else if (volatility > 25) riskLevel = 'high';
    
    setRiskMetrics({
      volatility,
      var95,
      var99,
      sharpeRatio,
      maxDrawdown,
      beta,
      riskLevel
    });
  };

  const calculatePositionSizing = () => {
    if (!riskMetrics) return null;
    
    const riskPercentages = {
      conservative: 0.01, // 1% risk
      moderate: 0.02,     // 2% risk
      aggressive: 0.05    // 5% risk
    };
    
    const riskPercentage = riskPercentages[riskTolerance];
    const portfolioRisk = portfolioValue * riskPercentage;
    const stopLossPercentage = riskMetrics.var95 / 100;
    const maxShares = Math.floor(portfolioRisk / (currentPrice * stopLossPercentage));
    const recommendedPosition = Math.min(maxShares * currentPrice, positionSize);
    
    return {
      maxShares,
      recommendedPosition,
      riskAmount: recommendedPosition * stopLossPercentage,
      stopLossPrice: currentPrice * (1 - stopLossPercentage)
    };
  };

  const positionSizing = calculatePositionSizing();

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getRiskBgColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'medium': return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'high': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      default: return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
    }
  };

  if (!riskMetrics) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 dark:text-gray-400">Calculating risk metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-500" />
          Risk Analysis
        </h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(riskMetrics.riskLevel)}`}>
          {riskMetrics.riskLevel.toUpperCase()} RISK
        </div>
      </div>

      {/* Risk Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Volatility</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {riskMetrics.volatility.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Annualized</div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">VaR (95%)</span>
          </div>
          <div className="text-2xl font-bold text-red-500">
            -{riskMetrics.var95.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Daily risk</div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Max Drawdown</span>
          </div>
          <div className="text-2xl font-bold text-red-500">
            -{riskMetrics.maxDrawdown.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Historical</div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Sharpe Ratio</span>
            <span className={`text-lg font-bold ${
              riskMetrics.sharpeRatio > 1 ? 'text-green-500' : 
              riskMetrics.sharpeRatio > 0 ? 'text-yellow-500' : 'text-red-500'
            }`}>
              {riskMetrics.sharpeRatio.toFixed(2)}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Risk-adjusted return
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Beta</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {riskMetrics.beta.toFixed(2)}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Market correlation
          </div>
        </div>
      </div>

      {/* Position Sizing */}
      <div className={`border rounded-lg p-4 ${getRiskBgColor(riskMetrics.riskLevel)}`}>
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Target className="w-4 h-4" />
          Position Sizing Recommendation
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Risk Tolerance
            </label>
            <select
              value={riskTolerance}
              onChange={(e) => setRiskTolerance(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="conservative">Conservative (1%)</option>
              <option value="moderate">Moderate (2%)</option>
              <option value="aggressive">Aggressive (5%)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Portfolio Value
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="number"
                value={portfolioValue}
                onChange={(e) => setPositionSize(Number(e.target.value))}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {positionSizing && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Recommended Position</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                ${positionSizing.recommendedPosition.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {positionSizing.maxShares} shares max
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Stop Loss Price</div>
              <div className="text-xl font-bold text-red-500">
                ${positionSizing.stopLossPrice.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Risk: ${positionSizing.riskAmount.toFixed(0)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskAnalysis;