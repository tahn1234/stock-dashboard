import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface NewsArticle {
  id: number;
  title: string;
  description: string;
  url: string;
  source: string;
  published_at: string;
  sentiment_score: number;
  sentiment_label: string;
  ticker: string;
}

interface NewsPanelProps {
  ticker: string;
  fetchWithAuth: (url: string) => Promise<any>;
  serverUrl: string;
}

const NewsPanel: React.FC<NewsPanelProps> = ({ ticker, fetchWithAuth, serverUrl }) => {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');

  useEffect(() => {
    if (ticker) {
      fetchNews();
    }
  }, [ticker]);

  const fetchNews = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const url = forceRefresh 
        ? `${serverUrl}/api/news/${ticker}?refresh=true`
        : `${serverUrl}/api/news/${ticker}`;
      const data = await fetchWithAuth(url);
      setNews(data);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'negative':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'negative':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const filteredNews = news.filter(article => {
    if (filter === 'all') return true;
    return article.sentiment_label === filter;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Newspaper className="w-6 h-6 text-blue-500" />
          News & Sentiment
        </h3>
        <button
          onClick={() => fetchNews(true)}
          disabled={isLoading}
          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-md text-sm"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Sentiment Filter */}
      <div className="flex gap-2 mb-4">
        {['all', 'positive', 'neutral', 'negative'].map((filterOption) => (
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

      {/* News Articles */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Loading news...</p>
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Newspaper className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No news articles found for {ticker}</p>
          </div>
        ) : (
          filteredNews.map((article) => (
            <div
              key={article.id}
              className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getSentimentIcon(article.sentiment_label)}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSentimentColor(article.sentiment_label)}`}>
                    {article.sentiment_label}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(article.published_at)}
                </span>
              </div>
              
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                {article.title}
              </h4>
              
              {article.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">
                  {article.description}
                </p>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {article.source}
                </span>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-500 hover:text-blue-600 text-sm"
                >
                  Read more
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NewsPanel;