import requests
import logging
from datetime import datetime, timedelta
from typing import List, Dict
import os
from textblob import TextBlob
import time

class NewsService:
    def __init__(self):
        self.newsapi_key = os.getenv('NEWSAPI_KEY')
        self.finnhub_key = os.getenv('FINNHUB_API_KEY', 'demo')
        
    def get_stock_news(self, ticker: str, days_back: int = 7) -> List[Dict]:
        """Get news for a specific stock"""
        news_articles = []
        
        # Try NewsAPI first
        if self.newsapi_key:
            news_articles.extend(self._get_newsapi_articles(ticker, days_back))
        
        # Try Finnhub as backup
        news_articles.extend(self._get_finnhub_news(ticker, days_back))
        
        # Add sentiment analysis
        for article in news_articles:
            sentiment = self._analyze_sentiment(article.get('title', '') + ' ' + article.get('description', ''))
            article['sentiment_score'] = sentiment['score']
            article['sentiment_label'] = sentiment['label']
        
        return news_articles
    
    def _get_newsapi_articles(self, ticker: str, days_back: int) -> List[Dict]:
        """Get news from NewsAPI"""
        if not self.newsapi_key:
            return []
            
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            url = "https://newsapi.org/v2/everything"
            params = {
                'q': f'{ticker} OR "{ticker}"',
                'from': start_date.strftime('%Y-%m-%d'),
                'to': end_date.strftime('%Y-%m-%d'),
                'sortBy': 'publishedAt',
                'language': 'en',
                'apiKey': self.newsapi_key,
                'pageSize': 20
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            articles = []
            
            for article in data.get('articles', []):
                articles.append({
                    'title': article.get('title', ''),
                    'description': article.get('description', ''),
                    'url': article.get('url', ''),
                    'source': article.get('source', {}).get('name', 'NewsAPI'),
                    'published_at': datetime.fromisoformat(article.get('publishedAt', '').replace('Z', '+00:00')),
                    'ticker': ticker
                })
            
            return articles
            
        except Exception as e:
            logging.error(f"Error fetching NewsAPI articles: {e}")
            return []
    
    def _get_finnhub_news(self, ticker: str, days_back: int) -> List[Dict]:
        """Get news from Finnhub"""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            url = "https://finnhub.io/api/v1/company-news"
            params = {
                'symbol': ticker,
                'from': start_date.strftime('%Y-%m-%d'),
                'to': end_date.strftime('%Y-%m-%d'),
                'token': self.finnhub_key
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            articles = []
            
            for article in data:
                articles.append({
                    'title': article.get('headline', ''),
                    'description': article.get('summary', ''),
                    'url': article.get('url', ''),
                    'source': article.get('source', 'Finnhub'),
                    'published_at': datetime.fromtimestamp(article.get('datetime', 0)),
                    'ticker': ticker
                })
            
            return articles
            
        except Exception as e:
            logging.error(f"Error fetching Finnhub news: {e}")
            return []
    
    def _analyze_sentiment(self, text: str) -> Dict:
        """Analyze sentiment using TextBlob"""
        try:
            blob = TextBlob(text)
            polarity = blob.sentiment.polarity  # -1 to 1
            
            if polarity > 0.1:
                label = 'positive'
            elif polarity < -0.1:
                label = 'negative'
            else:
                label = 'neutral'
            
            return {
                'score': polarity,
                'label': label
            }
        except Exception as e:
            logging.error(f"Error analyzing sentiment: {e}")
            return {'score': 0.0, 'label': 'neutral'}

class AlertService:
    def __init__(self, database_manager):
        self.db = database_manager
        
    def check_alerts(self, current_prices: Dict[str, float]):
        """Check if any alerts should be triggered"""
        active_alerts = self.db.get_active_alerts()
        
        for alert in active_alerts:
            ticker = alert['ticker']
            current_price = current_prices.get(ticker)
            
            if not current_price:
                continue
                
            should_trigger = False
            
            if alert['alert_type'] == 'price_above' and current_price >= alert['threshold_value']:
                should_trigger = True
            elif alert['alert_type'] == 'price_below' and current_price <= alert['threshold_value']:
                should_trigger = True
            
            if should_trigger:
                self._trigger_alert(alert, current_price)
    
    def _trigger_alert(self, alert: Dict, current_price: float):
        """Trigger an alert"""
        self.db.trigger_alert(alert['id'])
        
        # Here you would send email/SMS/push notification
        logging.info(f"Alert triggered: {alert['ticker']} {alert['alert_type']} {alert['threshold_value']} (current: {current_price})")
        
        # For now, just log it. In production, integrate with:
        # - Email service (SendGrid, AWS SES)
        # - SMS service (Twilio)
        # - Push notifications (Firebase)