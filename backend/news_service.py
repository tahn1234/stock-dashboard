import os
import requests
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any

class NewsService:
    def __init__(self):
        self.api_key = os.getenv('NEWSAPI_KEY')
        self.finnhub_key = os.getenv('FINNHUB_API_KEY')
        self.base_url = "https://newsapi.org/v2"
        
    def get_stock_news(self, ticker: str, days_back: int = 7) -> List[Dict[str, Any]]:
        """Get news for a specific stock ticker"""
        try:
            # Try NewsAPI first
            if self.api_key:
                url = f"{self.base_url}/everything"
                params = {
                    'q': f'"{ticker}" OR "{ticker} stock"',
                    'from': (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d'),
                    'sortBy': 'publishedAt',
                    'language': 'en',
                    'apiKey': self.api_key
                }
                
                response = requests.get(url, params=params, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    articles = data.get('articles', [])
                    
                    # Format articles
                    formatted_articles = []
                    for article in articles[:10]:  # Limit to 10 articles
                        formatted_articles.append({
                            'title': article.get('title', ''),
                            'description': article.get('description', ''),
                            'url': article.get('url', ''),
                            'publishedAt': article.get('publishedAt', ''),
                            'source': article.get('source', {}).get('name', ''),
                            'sentiment': self._analyze_sentiment(article.get('title', '') + ' ' + article.get('description', '')),
                            'sentiment_score': self._calculate_sentiment_score(article.get('title', '') + ' ' + article.get('description', '')),
                            'sentiment_label': self._analyze_sentiment(article.get('title', '') + ' ' + article.get('description', ''))
                        })
                    return formatted_articles
            
            # Try Finnhub news as fallback
            if self.finnhub_key:
                url = f"https://finnhub.io/api/v1/company-news"
                params = {
                    'symbol': ticker,
                    'from': (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d'),
                    'to': datetime.now().strftime('%Y-%m-%d'),
                    'token': self.finnhub_key
                }
                
                response = requests.get(url, params=params, timeout=10)
                if response.status_code == 200:
                    articles = response.json()
                    formatted_articles = []
                    for article in articles[:10]:
                        formatted_articles.append({
                            'title': article.get('headline', ''),
                            'description': article.get('summary', ''),
                            'url': article.get('url', ''),
                            'publishedAt': article.get('datetime', ''),
                            'source': article.get('source', ''),
                            'sentiment': self._analyze_sentiment(article.get('headline', '') + ' ' + article.get('summary', '')),
                            'sentiment_score': self._calculate_sentiment_score(article.get('headline', '') + ' ' + article.get('summary', '')),
                            'sentiment_label': self._analyze_sentiment(article.get('headline', '') + ' ' + article.get('summary', ''))
                        })
                    return formatted_articles
            
            # Fallback to mock data if no APIs work
            logging.warning(f"No API keys configured for news. Using mock data for {ticker}")
            return self._get_mock_news(ticker)
            
        except Exception as e:
            logging.error(f"Error fetching news for {ticker}: {e}")
            return self._get_mock_news(ticker)
    
    def _analyze_sentiment(self, text: str) -> str:
        """Simple sentiment analysis"""
        text_lower = text.lower()
        positive_words = ['up', 'rise', 'gain', 'positive', 'bullish', 'growth', 'profit', 'strong', 'beat', 'exceed']
        negative_words = ['down', 'fall', 'drop', 'negative', 'bearish', 'loss', 'decline', 'weak', 'miss', 'below']
        
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        if positive_count > negative_count:
            return 'positive'
        elif negative_count > positive_count:
            return 'negative'
        else:
            return 'neutral'
    
    def _calculate_sentiment_score(self, text: str) -> float:
        """Calculate sentiment score between -1 and 1"""
        text_lower = text.lower()
        positive_words = ['up', 'rise', 'gain', 'positive', 'bullish', 'growth', 'profit', 'strong', 'beat', 'exceed']
        negative_words = ['down', 'fall', 'drop', 'negative', 'bearish', 'loss', 'decline', 'weak', 'miss', 'below']
        
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        total_words = len(text.split())
        if total_words == 0:
            return 0.0
        
        score = (positive_count - negative_count) / total_words
        return max(-1.0, min(1.0, score * 10))  # Scale and clamp to -1 to 1
    
    def _get_mock_news(self, ticker: str) -> List[Dict[str, Any]]:
        """Return mock news data"""
        return [
            {
                'title': f'{ticker} Stock Shows Strong Performance',
                'description': f'{ticker} has demonstrated robust growth in recent trading sessions.',
                'url': f'https://example.com/news/{ticker.lower()}',
                'publishedAt': datetime.now().isoformat(),
                'source': 'Financial News',
                'sentiment': 'positive'
            },
            {
                'title': f'Analysts Bullish on {ticker} Future Prospects',
                'description': f'Market analysts remain optimistic about {ticker} long-term growth potential.',
                'url': f'https://example.com/analysis/{ticker.lower()}',
                'publishedAt': (datetime.now() - timedelta(hours=2)).isoformat(),
                'source': 'Market Analysis',
                'sentiment': 'positive'
            }
        ]

class AlertService:
    def __init__(self, db_manager):
        self.db = db_manager
        
    def check_alerts(self, price_data: Dict[str, float]):
        """Check if any price alerts should be triggered"""
        try:
            # This would check the database for user alerts
            # For now, just log that we're checking alerts
            logging.info("Checking price alerts...")
        except Exception as e:
            logging.error(f"Error checking alerts: {e}")
    
    def create_alert(self, user_id: str, ticker: str, target_price: float, alert_type: str = 'price'):
        """Create a new price alert"""
        try:
            # This would save to database
            logging.info(f"Creating alert for {ticker} at ${target_price}")
            return True
        except Exception as e:
            logging.error(f"Error creating alert: {e}")
            return False
    
    def get_user_alerts(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all alerts for a user"""
        try:
            # This would query database
            # For now, return mock data
            return []
        except Exception as e:
            logging.error(f"Error getting user alerts: {e}")
            return []
    
    def delete_alert(self, alert_id: int) -> bool:
        """Delete an alert"""
        try:
            # This would delete from database
            logging.info(f"Deleting alert {alert_id}")
            return True
        except Exception as e:
            logging.error(f"Error deleting alert: {e}")
            return False 