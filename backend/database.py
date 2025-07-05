import sqlite3
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging
import yfinance as yf

class DatabaseManager:
    def __init__(self, db_path: str = "stock_dashboard.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize database with required tables"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Users table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    email TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Watchlists table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS watchlists (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    ticker TEXT NOT NULL,
                    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    UNIQUE(user_id, ticker)
                )
            ''')
            
            # Alerts table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    ticker TEXT NOT NULL,
                    alert_type TEXT NOT NULL, -- 'price_above', 'price_below', 'volume_spike'
                    threshold_value REAL NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    triggered_at TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''')
            
            # News articles table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS news_articles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticker TEXT,
                    title TEXT NOT NULL,
                    content TEXT,
                    url TEXT UNIQUE,
                    source TEXT,
                    published_at TIMESTAMP,
                    sentiment_score REAL, -- -1 to 1
                    sentiment_label TEXT, -- 'positive', 'negative', 'neutral'
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Historical prices table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS historical_prices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticker TEXT NOT NULL,
                    timestamp TIMESTAMP NOT NULL,
                    open_price REAL,
                    high_price REAL,
                    low_price REAL,
                    close_price REAL,
                    volume INTEGER,
                    UNIQUE(ticker, timestamp)
                )
            ''')
            
            conn.commit()
            logging.info("Database initialized successfully")
    
    def add_user(self, username: str, password_hash: str, email: str = None) -> int:
        """Add a new user"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)",
                (username, password_hash, email)
            )
            return cursor.lastrowid
    
    def get_user(self, username: str) -> Optional[Dict]:
        """Get user by username"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def add_to_watchlist(self, user_id: int, ticker: str) -> bool:
        """Add ticker to user's watchlist"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO watchlists (user_id, ticker) VALUES (?, ?)",
                    (user_id, ticker)
                )
                return True
        except sqlite3.IntegrityError:
            return False  # Already exists
    
    def get_watchlist(self, user_id: int) -> List[str]:
        """Get user's watchlist"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT ticker FROM watchlists WHERE user_id = ?", (user_id,))
            return [row[0] for row in cursor.fetchall()]
    
    def remove_from_watchlist(self, user_id: int, ticker: str) -> bool:
        """Remove ticker from watchlist"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM watchlists WHERE user_id = ? AND ticker = ?",
                (user_id, ticker)
            )
            return cursor.rowcount > 0
    
    def create_alert(self, user_id: int, ticker: str, alert_type: str, threshold: float) -> int:
        """Create a new price alert"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO alerts (user_id, ticker, alert_type, threshold_value) VALUES (?, ?, ?, ?)",
                (user_id, ticker, alert_type, threshold)
            )
            return cursor.lastrowid
    
    def get_active_alerts(self, user_id: int = None) -> List[Dict]:
        """Get active alerts"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            if user_id:
                cursor.execute("SELECT * FROM alerts WHERE user_id = ? AND is_active = TRUE", (user_id,))
            else:
                cursor.execute("SELECT * FROM alerts WHERE is_active = TRUE")
            return [dict(row) for row in cursor.fetchall()]
    
    def trigger_alert(self, alert_id: int):
        """Mark alert as triggered"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE alerts SET is_active = FALSE, triggered_at = CURRENT_TIMESTAMP WHERE id = ?",
                (alert_id,)
            )
    
    def save_news_article(self, ticker: str, title: str, content: str, url: str, 
                         source: str, published_at: datetime, sentiment_score: float = None,
                         sentiment_label: str = None) -> int:
        """Save news article"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """INSERT INTO news_articles 
                       (ticker, title, content, url, source, published_at, sentiment_score, sentiment_label) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (ticker, title, content, url, source, published_at, sentiment_score, sentiment_label)
                )
                return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None  # URL already exists
    
    def get_news(self, ticker: str = None, limit: int = 50) -> List[Dict]:
        """Get news articles"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            if ticker:
                cursor.execute(
                    "SELECT * FROM news_articles WHERE ticker = ? ORDER BY published_at DESC LIMIT ?",
                    (ticker, limit)
                )
            else:
                cursor.execute(
                    "SELECT * FROM news_articles ORDER BY published_at DESC LIMIT ?",
                    (limit,)
                )
            return [dict(row) for row in cursor.fetchall()]
    
    def clear_old_news(self, ticker: str = None, days_old: int = 1) -> None:
        """Clear old news articles"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cutoff_date = datetime.now() - timedelta(days=days_old)
            
            if ticker:
                cursor.execute(
                    "DELETE FROM news_articles WHERE ticker = ? AND published_at < ?",
                    (ticker, cutoff_date)
                )
            else:
                cursor.execute(
                    "DELETE FROM news_articles WHERE published_at < ?",
                    (cutoff_date,)
                )
            conn.commit()
    
    def save_historical_price(self, ticker: str, timestamp: datetime, 
                            open_price: float, high: float, low: float, 
                            close: float, volume: int):
        """Save historical price data"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """INSERT INTO historical_prices 
                       (ticker, timestamp, open_price, high_price, low_price, close_price, volume) 
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (ticker, timestamp, open_price, high, low, close, volume)
                )
        except sqlite3.IntegrityError:
            pass  # Already exists

print(yf.Ticker("AAPL").history(period="1d"))