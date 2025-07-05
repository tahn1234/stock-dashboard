import React, { useState, useEffect } from 'react';
import { Lightbulb, TrendingUp, TrendingDown, Star, Target, Brain } from 'lucide-react';

interface Recommendation {
  ticker: string;
  score: number;
  reason: string;
  type: 'buy' | 'sell' | 'hold';
  confidence: number;
  price: number;
  change: number;
  changePercent: number;
}

interface RecommendationsProps {
  currentTicker: string;
  fetchWithAuth: (url: string) => Promise<any>;
  serverUrl: string;
}

const Recommendations: React.FC<RecommendationsProps> = ({ 
  currentTicker, 
  fetchWithAuth, 
  serverUrl 
}) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell' | 'hold'>('all');

  useEffect(() => {
    fetchRecommendations();
  }, [currentTicker]);

  const fetchRecommendations = async () => {
    setIsLoading(true);
    try {
      const data = await fetchWithAuth(`${serverUrl}/api/recommendations?ticker=${currentTicker}`);
      setRecommendations(data);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRecommendationColor = (type: string) => {
    switch (type) {
      case 'buy':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'sell':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'hold':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'buy':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'sell':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'hold':
        return <Target className="w-4 h-4 text-yellow-500" />;
      default:
        return <Star className="w-4 h-4 text-gray-500" />;
    }
  };

  const filteredRecommendations = recommendations.filter(rec => {
    if (filter === 'all') return true;
    return rec.type === filter;
  });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-500';
    if (confidence >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Brain className="w-6 h-6 text-blue-500" />
          AI Recommendations
        </h3>
        <button
          onClick={fetchRecommendations}
          disabled={isLoading}
          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-md text-sm"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-6">
        {['all', 'buy', 'hold', 'sell'].map((filterOption) => (
          <button
            key={filterOption}
            onClick={() => setFilter(filterOption as any)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filter === filterOption
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
          </button>
        ))}
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Generating recommendations...</p>
          </div>
        ) : filteredRecommendations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No recommendations available</p>
            <p className="text-sm mt-2">Try refreshing or check back later</p>
          </div>
        ) : (
          filteredRecommendations.map((rec, index) => (
            <div
              key={index}
              className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="font-bold text-lg text-gray-900 dark:text-white">
                    {rec.ticker}
                  </div>
                  <div className="flex items-center gap-2">
                    {getRecommendationIcon(rec.type)}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRecommendationColor(rec.type)}`}>
                      {rec.type.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    ${rec.price?.toFixed(2)}
                  </div>
                  <div className={`text-sm ${rec.changePercent > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {rec.changePercent > 0 ? '+' : ''}{rec.changePercent?.toFixed(2)}%
                  </div>
                </div>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-3">
                {rec.reason}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Score:</span>
                    <span className="ml-1 font-medium text-gray-900 dark:text-white">
                      {rec.score?.toFixed(1)}/10
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Confidence:</span>
                    <span className={`ml-1 font-medium ${getConfidenceColor(rec.confidence)}`}>
                      {rec.confidence}%
                    </span>
                  </div>
                </div>
                
                {/* Confidence Bar */}
                <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      rec.confidence >= 80 ? 'bg-green-500' :
                      rec.confidence >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${rec.confidence}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Disclaimer */}
      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-start gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-yellow-800 dark:text-yellow-400 mb-1">
              Investment Disclaimer
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              These recommendations are generated by AI algorithms and should not be considered as financial advice. 
              Always conduct your own research and consult with a qualified financial advisor before making investment decisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Recommendations;