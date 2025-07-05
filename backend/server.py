import os
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
from threading import Thread, Lock
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from dotenv import load_dotenv
import time
import random
from functools import wraps
from collections import defaultdict
import requests
from websocket_feed import initialize_websocket_feed, get_websocket_feed
from database import DatabaseManager
from news_service import NewsService, AlertService
from tensorflow.keras.models import Sequential
from sklearn.preprocessing import MinMaxScaler

# Try to import TensorFlow, but make it optional
try:
    from tensorflow.keras.layers import LSTM, Dense, Dropout
    TENSORFLOW_AVAILABLE = True
except ImportError:
    logging.warning("TensorFlow not available. Price predictions will be disabled.")
    TENSORFLOW_AVAILABLE = False

# Try to import OpenAI, but make it optional
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    logging.warning("OpenAI not available. Chatbot will be disabled.")
    OPENAI_AVAILABLE = False

# Load environment variables
load_dotenv()

# Configure logging
if not os.path.exists("logs"):
    os.makedirs("logs")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/server.log'),
        logging.StreamHandler()
    ]
)

app = Flask(__name__)

# Enhanced CORS configuration - allow all origins for production
allowed_origins = [
    "http://localhost:5173", 
    "http://127.0.0.1:5173", 
    "https://localhost:5173", 
    "http://localhost:3000", 
    "http://127.0.0.1:3000",
    "https://*.vercel.app",  # Allow Vercel deployments
    "https://*.railway.app",  # Allow Railway deployments
    "https://*.netlify.app",  # Allow Netlify deployments
    "*"  # Allow all origins in production (you can restrict this later)
]

CORS(app, 
     resources={r"/*": {"origins": allowed_origins}},
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Initialize SocketIO with proper configuration
socketio = SocketIO(app, 
                   cors_allowed_origins=allowed_origins, 
                   async_mode='threading',
                   logger=False,
                   engineio_logger=False)

# Initialize database and services
db = DatabaseManager()
news_service = NewsService()
alert_service = AlertService(db)

# Configure OpenAI if available
if OPENAI_AVAILABLE:
    openai.api_key = os.getenv('OPENAI_API_KEY')

# Rate limiting configuration
RATE_LIMIT_WINDOW = 600  # 10 minutes
MAX_REQUESTS_PER_WINDOW = 3  # 3 requests per 10 minutes
RATE_LIMIT_BY_IP = defaultdict(list)
RATE_LIMIT_BY_USER = defaultdict(list)

def rate_limit(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get client IP and user identity
        client_ip = request.remote_addr
        user_id = get_jwt_identity() if hasattr(request, 'jwt_identity') else None
        
        # Check IP-based rate limit
        now = time.time()
        RATE_LIMIT_BY_IP[client_ip] = [t for t in RATE_LIMIT_BY_IP[client_ip] if now - t < RATE_LIMIT_WINDOW]
        if len(RATE_LIMIT_BY_IP[client_ip]) >= MAX_REQUESTS_PER_WINDOW:
            return jsonify({"error": "Rate limit exceeded. Please try again later."}), 429
        RATE_LIMIT_BY_IP[client_ip].append(now)
        
        # Check user-based rate limit if user is authenticated
        if user_id:
            RATE_LIMIT_BY_USER[user_id] = [t for t in RATE_LIMIT_BY_USER[user_id] if now - t < RATE_LIMIT_WINDOW]
            if len(RATE_LIMIT_BY_USER[user_id]) >= MAX_REQUESTS_PER_WINDOW:
                return jsonify({"error": "Rate limit exceeded. Please try again later."}), 429
            RATE_LIMIT_BY_USER[user_id].append(now)
        
        return f(*args, **kwargs)
    return decorated_function

# JWT Configuration
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-super-secret-key-change-this-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(seconds=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 3600)))
jwt = JWTManager(app)

# Valid periods and intervals
VALID_PERIODS = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]
VALID_INTERVALS = ["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "1d", "5d", "1wk", "1mo", "3mo"]

# Enhanced mock data with realistic price movements
MOCK_PRICES = {
    "AAPL": {"base": 180.0, "current": 180.0},
    "TSLA": {"base": 250.0, "current": 250.0},
    "AMZN": {"base": 3500.0, "current": 3500.0},
    "GOOGL": {"base": 2800.0, "current": 2800.0},
    "MSFT": {"base": 380.0, "current": 380.0},
    "NVDA": {"base": 450.0, "current": 450.0}
}

# Cache for historical data
history_cache = {}
CACHE_DURATION = 1800  # 30 minutes

# Add per-ticker cache for real-time prices
price_fetch_cache = {}
PRICE_CACHE_DURATION = 300  # 5 minutes

# Add rate limiting tracking
rate_limit_trackers = {}

# Mock user database (replace with real database in production)
users = {
    "admin": "password123"  # In production, use hashed passwords
}

# Load tickers from environment variable or use default
TICKERS = os.environ.get('TICKERS', 'AAPL,TSLA,AMZN,GOOGL,MSFT,NVDA').split(',')
logging.info(f"Starting server with tickers: {TICKERS}")

# Initialize price data with mock values
price_data = {}
stats_data = {}
for ticker in TICKERS:
    if ticker not in MOCK_PRICES:
        MOCK_PRICES[ticker] = {"base": 100.0, "current": 100.0}
    price_data[ticker] = MOCK_PRICES[ticker]["current"]
    # Create realistic initial stats
    current_price = MOCK_PRICES[ticker]["current"]
    price_variation = current_price * 0.02  # 2% variation
    stats_data[ticker] = {
        "high": current_price + price_variation,
        "low": current_price - price_variation,
        "open": current_price - (price_variation * 0.5),  # Open slightly below current
        "previousClose": current_price,
        "volume": random.randint(1000000, 5000000)
    }

lock = Lock()

# Initialize WebSocket feed
try:
    websocket_feed = initialize_websocket_feed()
    logging.info("WebSocket feed initialized")
except Exception as e:
    logging.warning(f"Failed to initialize WebSocket feed: {e}")
    websocket_feed = None

def handle_websocket_price_update(symbol, price, volume, timestamp):
    """Handle real-time price updates from WebSocket"""
    try:
        with lock:
            if symbol in TICKERS:
                # Update current price but keep previous close as yesterday's close
                price_data[symbol] = float(price)
                stats_data[symbol]["high"] = max(stats_data[symbol]["high"], float(price))
                stats_data[symbol]["low"] = min(stats_data[symbol]["low"], float(price))
                if volume:
                    stats_data[symbol]["volume"] = int(volume)
                
                # Check alerts
                alert_service.check_alerts(price_data)
                
                # Emit to connected clients
                socketio.emit('price_update', {symbol: float(price)}, room=symbol)
                socketio.emit('price_update', price_data)
                socketio.emit('stats_update', stats_data)
                
                logging.info(f"WebSocket price update for {symbol}: ${price}")
    except Exception as e:
        logging.error(f"Error handling WebSocket price update: {e}")

def handle_websocket_connection_status(connected):
    """Handle WebSocket connection status changes"""
    if connected:
        logging.info("WebSocket connected - subscribing to tickers")
        for ticker in TICKERS:
            if websocket_feed:
                websocket_feed.subscribe(ticker)
    else:
        logging.warning("WebSocket disconnected")

# Add WebSocket callbacks if available
if websocket_feed:
    websocket_feed.add_price_callback(handle_websocket_price_update)
    websocket_feed.add_connection_callback(handle_websocket_connection_status)

def generate_mock_price(ticker, base_price=None):
    """Generate a realistic mock price with small variations"""
    if base_price is None:
        base_price = MOCK_PRICES[ticker]["current"]
    
    # Add small random variation (-0.5% to +0.5%)
    variation = random.uniform(-0.005, 0.005)
    new_price = base_price * (1 + variation)
    
    # Update the current price in mock data
    MOCK_PRICES[ticker]["current"] = new_price
    
    return new_price

def is_market_hours():
    """Check if it's currently market hours (9:30 AM - 4:00 PM ET, Mon-Fri)"""
    now = datetime.now()
    weekday = now.weekday()  # 0 = Monday, 6 = Sunday
    hour = now.hour
    
    # Market is open Monday-Friday, 9:30 AM - 4:00 PM ET
    if weekday >= 5:  # Weekend
        return False
    if hour < 9 or hour >= 16:  # Outside market hours
        return False
    if hour == 9 and now.minute < 30:  # Before 9:30 AM
        return False
    
    return True

def fetch_real_price_with_fallback(ticker, max_retries=2):
    """Fetch real price with multiple fallback strategies"""
    now = time.time()
    
    # Check cache first
    if ticker in price_fetch_cache:
        cache_time, cached_price = price_fetch_cache[ticker]
        if now - cache_time < PRICE_CACHE_DURATION:
            logging.debug(f"Using cached price for {ticker}: {cached_price}")
            return cached_price, "cached"
    
    # Try yfinance with different approaches
    for attempt in range(max_retries):
        try:
            stock = yf.Ticker(ticker)
            
            # Method 1: Try fast_info first
            try:
                price = float(stock.fast_info["last_price"])
                if price > 0:
                    price_fetch_cache[ticker] = (now, price)
                    logging.info(f"Fetched real price for {ticker}: ${price} (fast_info)")
                    return price, "real"
            except Exception as e:
                logging.debug(f"fast_info failed for {ticker}: {e}")
            
            # Method 2: Try info
            try:
                info = stock.info
                price = info.get('regularMarketPrice') or info.get('currentPrice') or info.get('previousClose')
                if price and price > 0:
                    price_fetch_cache[ticker] = (now, float(price))
                    logging.info(f"Fetched real price for {ticker}: ${price} (info)")
                    return float(price), "real"
            except Exception as e:
                logging.debug(f"info failed for {ticker}: {e}")
            
            # Method 3: Try recent history
            try:
                hist = stock.history(period="1d", interval="1m")
                if not hist.empty and 'Close' in hist.columns:
                    price = float(hist['Close'].iloc[-1])
                    if price > 0:
                        price_fetch_cache[ticker] = (now, price)
                        logging.info(f"Fetched real price for {ticker}: ${price} (history)")
                        return price, "real"
            except Exception as e:
                logging.debug(f"history failed for {ticker}: {e}")
                
        except Exception as e:
            logging.warning(f"Attempt {attempt + 1} failed for {ticker}: {e}")
            if attempt < max_retries - 1:
                time.sleep(1)  # Brief delay before retry
    
    # If all real data methods fail, use mock data
    mock_price = generate_mock_price(ticker)
    price_fetch_cache[ticker] = (now, mock_price)
    logging.info(f"Using mock price for {ticker}: ${mock_price}")
    return mock_price, "mock"

def fetch_previous_close(ticker):
    """Fetch the previous day's closing price"""
    try:
        stock = yf.Ticker(ticker)
        
        # Get 2 days of data to ensure we have previous day
        hist = stock.history(period="2d", interval="1d")
        
        if not hist.empty and len(hist) >= 2:
            # Get the previous day's closing price (second to last entry)
            previous_close = float(hist['Close'].iloc[-2])
            logging.info(f"Fetched previous close for {ticker}: ${previous_close}")
            return previous_close
        elif not hist.empty:
            # If only one day available, use that as previous close
            previous_close = float(hist['Close'].iloc[-1])
            logging.info(f"Using current day as previous close for {ticker}: ${previous_close}")
            return previous_close
        else:
            logging.warning(f"No historical data available for {ticker}")
            return None
            
    except Exception as e:
        logging.error(f"Error fetching previous close for {ticker}: {e}")
        return None

def fetch_initial_data():
    """Fetch initial data for all tickers"""
    logging.info("Fetching initial data for all tickers...")
    
    for ticker in TICKERS:
        try:
            price, source = fetch_real_price_with_fallback(ticker)
            previous_close = fetch_previous_close(ticker)
            
            with lock:
                price_data[ticker] = price
                
                # Use actual previous close if available, otherwise use current price
                if previous_close is not None:
                    stats_data[ticker]["previousClose"] = previous_close
                else:
                    stats_data[ticker]["previousClose"] = price
                
                # Create realistic high/low/open values around the current price
                price_variation = price * 0.02  # 2% variation
                stats_data[ticker]["high"] = price + price_variation
                stats_data[ticker]["low"] = price - price_variation
                stats_data[ticker]["open"] = price - (price_variation * 0.5)  # Open slightly below current
                stats_data[ticker]["volume"] = random.randint(1000000, 5000000)
            
            logging.info(f"Initialized {ticker}: ${price} (source: {source}), previous close: ${stats_data[ticker]['previousClose']}")
            time.sleep(0.5)  # Small delay to avoid overwhelming the API
            
        except Exception as e:
            logging.error(f"Error initializing {ticker}: {e}")
            # Use mock data as final fallback
            mock_price = generate_mock_price(ticker)
            with lock:
                price_data[ticker] = mock_price
                
                # Create realistic high/low/open values around the current price
                price_variation = mock_price * 0.02  # 2% variation
                stats_data[ticker]["high"] = mock_price + price_variation
                stats_data[ticker]["low"] = mock_price - price_variation
                stats_data[ticker]["open"] = mock_price - (price_variation * 0.5)  # Open slightly below current
                stats_data[ticker]["previousClose"] = mock_price
                stats_data[ticker]["volume"] = random.randint(1000000, 5000000)

def update_prices():
    """Update prices - now primarily handled by WebSocket, with yfinance fallback."""
    while True:
        try:
            # If WebSocket is not available, fall back to yfinance
            if not websocket_feed or not websocket_feed.get_connection_status():
                logging.debug("WebSocket not available, using yfinance fallback")
                
                with lock:
                    for ticker in TICKERS:
                        try:
                            price, source = fetch_real_price_with_fallback(ticker)
                            
                            if price is not None:
                                old_price = price_data.get(ticker, price)
                                # Update current price but keep previous close as yesterday's close
                                price_data[ticker] = price
                                stats_data[ticker]["high"] = max(stats_data[ticker]["high"], price)
                                stats_data[ticker]["low"] = min(stats_data[ticker]["low"], price)
                                
                                # Check alerts
                                alert_service.check_alerts(price_data)
                                
                                # Emit price update
                                socketio.emit('price_update', {ticker: price}, room=ticker)
                                
                                if abs(price - old_price) > 0.01:  # Only log significant changes
                                    logging.debug(f"Price update for {ticker}: ${price} (source: {source})")
                                    
                        except Exception as e:
                            logging.error(f"Error updating price for {ticker}: {e}")
                    
                    # Emit all prices and stats
                    socketio.emit('price_update', price_data)
                    socketio.emit('stats_update', stats_data)
            else:
                # WebSocket is handling updates, just log status
                logging.debug("WebSocket is active, no need for manual updates")
                
        except Exception as e:
            logging.error(f"Error in update_prices: {e}")
        
        # Update every 30 seconds when using fallback, every 2 minutes when WebSocket is active
        sleep_time = 30 if not websocket_feed or not websocket_feed.get_connection_status() else 120
        time.sleep(sleep_time)

def simulate_price_changes():
    """Simulate small price changes to make the UI more dynamic"""
    while True:
        try:
            with lock:
                for ticker in TICKERS:
                    current_price = price_data.get(ticker, 0)
                    if current_price > 0:
                        # Small random price change (-0.5% to +0.5%)
                        change_percent = random.uniform(-0.005, 0.005)
                        new_price = current_price * (1 + change_percent)
                        
                        # Update current price but keep previous close as yesterday's close
                        price_data[ticker] = new_price
                        
                        # Update high/low if needed
                        stats_data[ticker]["high"] = max(stats_data[ticker]["high"], new_price)
                        stats_data[ticker]["low"] = min(stats_data[ticker]["low"], new_price)
                        
                        # Emit updates
                        socketio.emit('price_update', {ticker: new_price}, room=ticker)
                        socketio.emit('price_update', price_data)
                        socketio.emit('stats_update', stats_data)
                        logging.info(f"Simulated price change for {ticker}: ${current_price} -> ${new_price}")
                        
            time.sleep(10)  # Update every 10 seconds
            
        except Exception as e:
            logging.error(f"Error in simulate_price_changes: {e}")
            time.sleep(10)

# Fetch initial data before starting the server
fetch_initial_data()

# Start price update thread
socketio.start_background_task(update_prices)
# socketio.start_background_task(simulate_price_changes)  # Disabled to keep prices stable

# Add health check endpoint
@app.route("/health")
def health_check():
    return jsonify({
        "status": "healthy", 
        "timestamp": datetime.now().isoformat(),
        "tickers": list(price_data.keys()),
        "websocket_connected": websocket_feed.get_connection_status() if websocket_feed else False,
        "market_hours": is_market_hours()
    }), 200

# Authentication routes
@app.route("/api/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        # Handle preflight request
        response = jsonify({})
        response.headers.add("Access-Control-Allow-Origin", request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization")
        response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
        return response
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
            
        username = data.get("username", None)
        password = data.get("password", None)
        
        if not username or not password:
            return jsonify({"error": "Missing username or password"}), 400
        
        if username not in users or users[username] != password:
            return jsonify({"error": "Invalid username or password"}), 401
        
        access_token = create_access_token(identity=username)
        response = jsonify({"access_token": access_token})
        response.headers.add("Access-Control-Allow-Origin", request.headers.get('Origin', '*'))
        return response, 200
        
    except Exception as e:
        logging.error(f"Login error: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/")
def home():
    return jsonify({
        "message": "Flask server is running!", 
        "status": "healthy",
        "tickers": list(price_data.keys()),
        "current_prices": price_data
    })

FINNHUB_API_KEY = os.getenv('FINNHUB_API_KEY')
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

def fetch_finnhub_price(ticker):
    try:
        url = f"{FINNHUB_BASE_URL}/quote"
        params = {"symbol": ticker, "token": FINNHUB_API_KEY}
        resp = requests.get(url, params=params, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            price = data.get('c')
            if price is not None:
                return float(price)
    except Exception as e:
        logging.warning(f"Finnhub price fetch failed for {ticker}: {e}")
    return None

def fetch_finnhub_history(ticker, period, interval):
    # Map your period/interval to Finnhub's supported resolution and time range
    import time as _time
    now = int(_time.time())
    period_map = {
        "1d": 1*24*60*60,
        "5d": 5*24*60*60,
        "1mo": 30*24*60*60,
        "3mo": 90*24*60*60,
        "6mo": 180*24*60*60,
        "1y": 365*24*60*60,
        "2y": 2*365*24*60*60,
        "5y": 5*365*24*60*60,
        "10y": 10*365*24*60*60,
        "ytd": 365*24*60*60,
        "max": 10*365*24*60*60
    }
    interval_map = {
        "1m": "1", "2m": "1", "5m": "5", "15m": "15", "30m": "30", "60m": "60", "90m": "60", "1h": "60",
        "1d": "D", "5d": "D", "1wk": "W", "1mo": "M", "3mo": "M"
    }
    resolution = interval_map.get(interval, "5")
    from_ = now - period_map.get(period, 30*24*60*60)
    to_ = now
    try:
        url = f"{FINNHUB_BASE_URL}/stock/candle"
        params = {"symbol": ticker, "resolution": resolution, "from": from_, "to": to_, "token": FINNHUB_API_KEY}
        resp = requests.get(url, params=params, timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('s') == 'ok':
                candles = []
                for i in range(len(data['c'])):
                    candles.append({
                        "time": datetime.utcfromtimestamp(data['t'][i]).strftime("%Y-%m-%d %H:%M"),
                        "price": data['c'][i],
                        "volume": data['v'][i],
                        "open": data['o'][i],
                        "high": data['h'][i],
                        "low": data['l'][i],
                        "close": data['c'][i],
                    })
                return candles
    except Exception as e:
        logging.warning(f"Finnhub history fetch failed for {ticker}: {e}")
    return None

@app.route("/api/prices")
@jwt_required()
def get_prices():
    result = {}
    for ticker in TICKERS:
        price = fetch_finnhub_price(ticker)
        if price is not None:
            result[ticker] = price
        else:
            # fallback to mock
            result[ticker] = price_data.get(ticker, MOCK_PRICES.get(ticker, {}).get("current", 100.0))
    return jsonify(result)

@app.route("/api/stats")
@jwt_required()
def get_stats():
    with lock:
        return jsonify(stats_data)

# News endpoints
@app.route("/api/news/<ticker>")
@jwt_required()
def get_news(ticker):
    try:
        # Check if we should force refresh (clear cache)
        force_refresh = request.args.get('refresh', 'false').lower() == 'true'
        
        if force_refresh:
            # Clear old news for this ticker
            db.clear_old_news(ticker, days_old=1)
            logging.info(f"Cleared old news for {ticker}")
        
        # Get news from database first
        news_articles = db.get_news(ticker, limit=20)
        
        # If no recent news or force refresh, fetch from external sources
        if not news_articles or force_refresh:
            logging.info(f"Fetching fresh news for {ticker}")
            external_news = news_service.get_stock_news(ticker, days_back=7)
            
            # Save to database
            for article in external_news:
                db.save_news_article(
                    ticker=article['ticker'],
                    title=article['title'],
                    content=article['description'],
                    url=article['url'],
                    source=article['source'],
                    published_at=article['published_at'],
                    sentiment_score=article.get('sentiment_score'),
                    sentiment_label=article.get('sentiment_label')
                )
            
            news_articles = external_news
        
        return jsonify(news_articles)
        
    except Exception as e:
        logging.error(f"Error fetching news for {ticker}: {e}")
        return jsonify({"error": str(e)}), 500

# Watchlist endpoints
@app.route("/api/watchlist", methods=["GET", "POST"])
@jwt_required()
def handle_watchlist():
    user_id = get_jwt_identity()
    
    if request.method == "GET":
        try:
            tickers = db.get_watchlist(user_id)
            watchlist_data = []
            
            for ticker in tickers:
                current_price = price_data.get(ticker, 0)
                # Calculate change (mock for now)
                change = random.uniform(-5, 5)
                change_percent = change
                
                watchlist_data.append({
                    "ticker": ticker,
                    "price": current_price,
                    "change": change,
                    "changePercent": change_percent
                })
            
            return jsonify(watchlist_data)
            
        except Exception as e:
            logging.error(f"Error fetching watchlist: {e}")
            return jsonify({"error": str(e)}), 500
    
    elif request.method == "POST":
        try:
            data = request.get_json()
            ticker = data.get("ticker", "").upper()
            
            if not ticker:
                return jsonify({"error": "Ticker is required"}), 400
            
            success = db.add_to_watchlist(user_id, ticker)
            if success:
                return jsonify({"message": f"Added {ticker} to watchlist"}), 201
            else:
                return jsonify({"error": f"{ticker} already in watchlist"}), 400
                
        except Exception as e:
            logging.error(f"Error adding to watchlist: {e}")
            return jsonify({"error": str(e)}), 500

@app.route("/api/watchlist/<ticker>", methods=["DELETE"])
@jwt_required()
def remove_from_watchlist(ticker):
    user_id = get_jwt_identity()
    
    try:
        success = db.remove_from_watchlist(user_id, ticker.upper())
        if success:
            return jsonify({"message": f"Removed {ticker} from watchlist"}), 200
        else:
            return jsonify({"error": f"{ticker} not found in watchlist"}), 404
            
    except Exception as e:
        logging.error(f"Error removing from watchlist: {e}")
        return jsonify({"error": str(e)}), 500

# Alerts endpoints
@app.route("/api/alerts", methods=["GET", "POST"])
@jwt_required()
def handle_alerts():
    user_id = get_jwt_identity()
    
    if request.method == "GET":
        try:
            alerts = db.get_active_alerts(user_id)
            return jsonify(alerts)
            
        except Exception as e:
            logging.error(f"Error fetching alerts: {e}")
            return jsonify({"error": str(e)}), 500
    
    elif request.method == "POST":
        try:
            data = request.get_json()
            ticker = data.get("ticker", "").upper()
            alert_type = data.get("alert_type")
            threshold = float(data.get("threshold"))
            
            if not all([ticker, alert_type, threshold]):
                return jsonify({"error": "Missing required fields"}), 400
            
            alert_id = db.create_alert(user_id, ticker, alert_type, threshold)
            return jsonify({"message": "Alert created", "alert_id": alert_id}), 201
            
        except Exception as e:
            logging.error(f"Error creating alert: {e}")
            return jsonify({"error": str(e)}), 500

@app.route("/api/alerts/<int:alert_id>", methods=["DELETE"])
@jwt_required()
def delete_alert(alert_id):
    try:
        # In a real implementation, you'd check if the alert belongs to the user
        db.trigger_alert(alert_id)  # This marks it as inactive
        return jsonify({"message": "Alert deleted"}), 200
        
    except Exception as e:
        logging.error(f"Error deleting alert: {e}")
        return jsonify({"error": str(e)}), 500

# Chatbot endpoint
@app.route("/api/chat", methods=["POST"])
@jwt_required()
def chat():
    if not OPENAI_AVAILABLE:
        return jsonify({"error": "OpenAI integration not available"}), 503
    
    try:
        data = request.get_json()
        user_message = data.get("message", "")
        ticker = data.get("ticker", "")
        context = data.get("context", {})
        
        if not user_message:
            return jsonify({"error": "Message is required"}), 400
        
        # Get current market data for context
        current_price = price_data.get(ticker, 0)
        current_stats = stats_data.get(ticker, {})
        
        # Build context for the AI
        system_prompt = f"""You are a helpful AI stock market assistant. You have access to real-time data for {ticker}:
        - Current Price: ${current_price}
        - High: ${current_stats.get('high', 'N/A')}
        - Low: ${current_stats.get('low', 'N/A')}
        - Volume: {current_stats.get('volume', 'N/A')}
        
        Provide helpful, accurate information about stocks and market analysis. Always include disclaimers about investment risks.
        Keep responses concise and actionable. If asked about specific predictions, remind users that past performance doesn't guarantee future results.
        """
        
        # Call OpenAI API
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            max_tokens=500,
            temperature=0.7
        )
        
        ai_response = response.choices[0].message.content
        
        return jsonify({"response": ai_response})
        
    except Exception as e:
        logging.error(f"Error in chat endpoint: {e}")
        return jsonify({"error": "Failed to process chat request"}), 500

# Recommendations endpoint
@app.route("/api/recommendations")
@jwt_required()
def get_recommendations():
    ticker = request.args.get("ticker", "AAPL")
    
    try:
        # Generate AI-powered recommendations using collaborative filtering
        recommendations = generate_recommendations(ticker)
        return jsonify(recommendations)
        
    except Exception as e:
        logging.error(f"Error generating recommendations: {e}")
        return jsonify({"error": str(e)}), 500

def generate_recommendations(current_ticker):
    """Generate stock recommendations using collaborative filtering and technical analysis"""
    recommendations = []
    
    # Get similar stocks based on sector/market cap (simplified)
    similar_tickers = get_similar_stocks(current_ticker)
    
    for ticker in similar_tickers[:10]:  # Limit to top 10
        try:
            # Get current price
            current_price = price_data.get(ticker, 0)
            if current_price == 0:
                continue
            
            # Calculate recommendation score based on multiple factors
            score = calculate_recommendation_score(ticker, current_price)
            
            # Determine recommendation type
            if score >= 7:
                rec_type = "buy"
                confidence = min(95, score * 10)
            elif score <= 4:
                rec_type = "sell"
                confidence = min(95, (10 - score) * 10)
            else:
                rec_type = "hold"
                confidence = 70
            
            # Generate reason
            reason = generate_recommendation_reason(ticker, score, rec_type)
            
            # Calculate real price change
            try:
                stock = yf.Ticker(ticker)
                hist = stock.history(period="5d", interval="1d")
                if not hist.empty and len(hist) >= 2:
                    current_price = hist['Close'].iloc[-1]
                    previous_price = hist['Close'].iloc[-2]
                    change = current_price - previous_price
                    change_percent = (change / previous_price) * 100
                else:
                    change = 0
                    change_percent = 0
            except Exception as e:
                logging.error(f"Error calculating price change for {ticker}: {e}")
                change = 0
                change_percent = 0
            
            recommendations.append({
                "ticker": ticker,
                "score": score,
                "reason": reason,
                "type": rec_type,
                "confidence": confidence,
                "price": current_price,
                "change": change,
                "changePercent": change_percent
            })
            
        except Exception as e:
            logging.error(f"Error generating recommendation for {ticker}: {e}")
            continue
    
    # Sort by score descending
    recommendations.sort(key=lambda x: x["score"], reverse=True)
    
    return recommendations

def get_similar_stocks(ticker):
    """Get similar stocks based on sector and market cap using real data"""
    try:
        # Get stock info to determine sector
        stock = yf.Ticker(ticker)
        info = stock.info
        
        # Define sector-based similar stocks
        sector_stocks = {
            "Technology": ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA"],
            "Consumer Cyclical": ["AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX"],
            "Healthcare": ["JNJ", "PFE", "UNH", "ABBV", "TMO", "DHR"],
            "Financial Services": ["JPM", "BAC", "WFC", "GS", "MS", "BLK"],
            "Communication Services": ["GOOGL", "META", "NFLX", "DIS", "CMCSA"],
            "Industrials": ["CAT", "BA", "GE", "MMM", "HON", "UPS"],
            "Energy": ["XOM", "CVX", "COP", "EOG", "SLB", "KMI"],
            "Consumer Defensive": ["PG", "KO", "WMT", "COST", "PEP", "CL"],
            "Real Estate": ["PLD", "AMT", "CCI", "EQIX", "DLR", "PSA"],
            "Basic Materials": ["LIN", "APD", "FCX", "NEM", "BLL", "ECL"],
            "Utilities": ["NEE", "DUK", "SO", "D", "AEP", "XEL"]
        }
        
        # Get sector from stock info
        sector = info.get('sector', 'Technology')
        
        # Get similar stocks from the same sector
        sector_tickers = sector_stocks.get(sector, sector_stocks["Technology"])
        
        # Remove the current ticker if it's in the list
        if ticker in sector_tickers:
            sector_tickers.remove(ticker)
        
        # Return up to 5 similar stocks
        return sector_tickers[:5]
        
    except Exception as e:
        logging.error(f"Error getting similar stocks for {ticker}: {e}")
        # Fallback to technology stocks
        return ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]

def calculate_recommendation_score(ticker, current_price):
    """Calculate a recommendation score from 1-10 based on real technical analysis"""
    score = 5.0  # Start with neutral
    
    try:
        # Get historical data for analysis
        stock = yf.Ticker(ticker)
        hist = stock.history(period="30d", interval="1d")
        
        if hist.empty or len(hist) < 14:
            logging.warning(f"Insufficient data for {ticker}")
            return 5.0
        
        # Factor 1: Price momentum (real)
        if len(hist) >= 2:
            recent_change = (hist['Close'].iloc[-1] - hist['Close'].iloc[-5]) / hist['Close'].iloc[-5]
            if recent_change > 0.05:
                score += 1.5
            elif recent_change > 0.02:
                score += 0.5
            elif recent_change < -0.05:
                score -= 1.5
            elif recent_change < -0.02:
                score -= 0.5
        
        # Factor 2: Volume analysis (real)
        if 'Volume' in hist.columns:
            avg_volume = hist['Volume'].mean()
            recent_volume = hist['Volume'].iloc[-5:].mean()
            volume_ratio = recent_volume / avg_volume if avg_volume > 0 else 1
            
            if volume_ratio > 1.2:
                score += 0.5
            elif volume_ratio < 0.8:
                score -= 0.5
        
        # Factor 3: RSI calculation (real)
        rsi = calculate_rsi(hist['Close'].values)
        if rsi < 30:  # Oversold
            score += 1.0
        elif rsi > 70:  # Overbought
            score -= 1.0
        
        # Factor 4: Moving averages (real)
        sma_20 = hist['Close'].rolling(window=20).mean().iloc[-1]
        sma_50 = hist['Close'].rolling(window=50).mean().iloc[-1] if len(hist) >= 50 else sma_20
        
        if current_price > sma_20 and sma_20 > sma_50:
            score += 1.0  # Golden cross
        elif current_price < sma_20 and sma_20 < sma_50:
            score -= 1.0  # Death cross
        
        # Factor 5: Support/Resistance levels
        high_30d = hist['High'].max()
        low_30d = hist['Low'].min()
        price_position = (current_price - low_30d) / (high_30d - low_30d) if (high_30d - low_30d) > 0 else 0.5
        
        if price_position > 0.8:
            score -= 0.5  # Near resistance
        elif price_position < 0.2:
            score += 0.5  # Near support
        
        # Factor 6: Volatility analysis
        returns = hist['Close'].pct_change().dropna()
        volatility = returns.std() * (252 ** 0.5)  # Annualized volatility
        
        if volatility > 0.4:  # High volatility
            score -= 0.5
        elif volatility < 0.15:  # Low volatility
            score += 0.5
        
    except Exception as e:
        logging.error(f"Error calculating score for {ticker}: {e}")
    
    # Ensure score is between 1 and 10
    return max(1, min(10, score))

def calculate_rsi(prices, period=14):
    """Calculate RSI using real price data"""
    if len(prices) < period + 1:
        return 50  # Neutral if insufficient data
    
    deltas = np.diff(prices)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    
    avg_gains = np.mean(gains[:period])
    avg_losses = np.mean(losses[:period])
    
    if avg_losses == 0:
        return 100
    
    rs = avg_gains / avg_losses
    rsi = 100 - (100 / (1 + rs))
    return rsi

def generate_recommendation_reason(ticker, score, rec_type):
    """Generate a data-driven reason for the recommendation"""
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period="30d", interval="1d")
        
        if hist.empty or len(hist) < 14:
            return "Insufficient data for detailed analysis"
        
        current_price = hist['Close'].iloc[-1]
        price_5d_ago = hist['Close'].iloc[-5] if len(hist) >= 5 else current_price
        price_change_5d = ((current_price - price_5d_ago) / price_5d_ago) * 100
        
        # Calculate technical indicators
        rsi = calculate_rsi(hist['Close'].values)
        sma_20 = hist['Close'].rolling(window=20).mean().iloc[-1]
        sma_50 = hist['Close'].rolling(window=50).mean().iloc[-1] if len(hist) >= 50 else sma_20
        
        # Volume analysis
        avg_volume = hist['Volume'].mean()
        recent_volume = hist['Volume'].iloc[-5:].mean()
        volume_ratio = recent_volume / avg_volume if avg_volume > 0 else 1
        
        reasons = []
        
        if rec_type == 'buy':
            if price_change_5d > 5:
                reasons.append(f"Strong 5-day gain of {price_change_5d:.1f}%")
            if rsi < 40:
                reasons.append(f"RSI at {rsi:.0f} indicates oversold conditions")
            if current_price > sma_20:
                reasons.append("Price above 20-day moving average")
            if volume_ratio > 1.2:
                reasons.append("Above-average volume supporting price action")
            if current_price > sma_50:
                reasons.append("Price above 50-day moving average")
                
        elif rec_type == 'sell':
            if price_change_5d < -5:
                reasons.append(f"Declining 5-day performance of {price_change_5d:.1f}%")
            if rsi > 70:
                reasons.append(f"RSI at {rsi:.0f} indicates overbought conditions")
            if current_price < sma_20:
                reasons.append("Price below 20-day moving average")
            if volume_ratio < 0.8:
                reasons.append("Declining volume suggests weakening momentum")
            if current_price < sma_50:
                reasons.append("Price below 50-day moving average")
                
        else:  # hold
            if abs(price_change_5d) < 3:
                reasons.append(f"Stable 5-day performance ({price_change_5d:.1f}%)")
            if 40 <= rsi <= 60:
                reasons.append(f"Neutral RSI at {rsi:.0f}")
            if abs(current_price - sma_20) / sma_20 < 0.02:
                reasons.append("Price near 20-day moving average")
            if 0.8 <= volume_ratio <= 1.2:
                reasons.append("Normal volume patterns")
        
        if not reasons:
            reasons.append("Mixed technical signals")
            
        return "; ".join(reasons[:3])  # Limit to top 3 reasons
        
    except Exception as e:
        logging.error(f"Error generating reason for {ticker}: {e}")
        return "Technical analysis indicates mixed signals"

@app.route("/api/history/<ticker>")
@jwt_required()
def get_history(ticker):
    period = request.args.get("period", "1d")
    interval = request.args.get("interval", "1m")
    if period not in VALID_PERIODS:
        return jsonify({"error": f"Invalid period. Must be one of: {VALID_PERIODS}"}), 400
    if interval not in VALID_INTERVALS:
        return jsonify({"error": f"Invalid interval. Must be one of: {VALID_INTERVALS}"}), 400
    # Try Finnhub first
    candles = fetch_finnhub_history(ticker, period, interval)
    if candles:
        return jsonify(candles)
    # fallback to old logic
    current_price = price_data.get(ticker, MOCK_PRICES.get(ticker, {}).get("current", 100.0))
    return generate_fallback_historical_data(ticker, period, interval, current_price)

def generate_fallback_historical_data(ticker, period, interval, current_price):
    """Generate historical data using current real-time price as base"""
    now = datetime.now()
    data = []
    
    # Calculate the number of data points and time delta based on period and interval
    period_to_days = {
        "1d": 1, "5d": 5, "1mo": 30, "3mo": 90, "6mo": 180, 
        "1y": 365, "2y": 730, "5y": 1825, "10y": 3650, "ytd": 365, "max": 3650
    }
    interval_to_minutes = {
        "1m": 1, "2m": 2, "5m": 5, "15m": 15, "30m": 30, 
        "60m": 60, "90m": 90, "1h": 60, "1d": 1440, "5d": 7200, 
        "1wk": 10080, "1mo": 43200, "3mo": 129600
    }
    
    days = period_to_days.get(period, 30)
    interval_minutes = interval_to_minutes.get(interval, 60)
    
    # Calculate total data points and adjust interval if needed
    total_minutes = days * 24 * 60
    num_points = total_minutes // interval_minutes
    
    # If we would have too many points, adjust the interval to get reasonable number
    if num_points > 500:
        target_points = 500
        adjusted_interval_minutes = total_minutes // target_points
        interval_minutes = adjusted_interval_minutes
        num_points = target_points
    
    # Ensure we have at least some data points
    if num_points < 1:
        num_points = 1
    
    logging.info(f"Generating {num_points} fallback data points for {ticker} over {days} days")
    
    # Generate data points starting from current price and working backwards
    for i in range(num_points):
        # Calculate time point based on period and interval
        if interval_minutes < 1440:  # Less than a day
            time_point = now - timedelta(minutes=i * interval_minutes)
        else:  # Daily or longer intervals
            time_point = now - timedelta(days=i * (interval_minutes // 1440))
        
        # Generate realistic price movement around current price
        if i == 0:
            price = current_price
        else:
            # Add small realistic variation based on time distance
            variation_factor = min(0.02, (i * interval_minutes) / (24 * 60) * 0.01)  # Max 2% variation
            daily_variation = random.uniform(-variation_factor, variation_factor)
            price = current_price * (1 + daily_variation)
        
        # Generate OHLC data
        open_price = price * (1 + random.uniform(-0.005, 0.005))
        high_price = max(open_price, price) * (1 + random.uniform(0, 0.01))
        low_price = min(open_price, price) * (1 - random.uniform(0, 0.01))
        close_price = price
        
        data.append({
            "time": time_point.strftime("%Y-%m-%d %H:%M"),
            "price": close_price,
            "volume": int(random.uniform(1000000, 5000000)),
            "open": open_price,
            "high": high_price,
            "low": low_price,
            "close": close_price,
        })
    
    # Reverse data to show oldest first
    data.reverse()
    logging.info(f"Generated fallback data spanning from {data[0]['time']} to {data[-1]['time']}")
    return jsonify(data)

# Add prediction-related functions only if TensorFlow is available
if TENSORFLOW_AVAILABLE:
    def get_data(ticker, lookback=100):
        df = yf.download(ticker, period=f'{lookback+30}d', interval='1d')
        return df['Close'].values[-lookback:]

    def build_lstm_model(input_shape):
        model = Sequential([
            LSTM(50, return_sequences=True, input_shape=input_shape),
            LSTM(50),
            Dense(1)
        ])
        model.compile(optimizer='adam', loss='mse')
        return model

    @app.route('/predict', methods=['GET'])
    def predict():
        ticker = request.args.get('ticker', 'AAPL')
        days = int(request.args.get('days', 7))
        lookback = 100

        # 1. Get and scale data
        data = get_data(ticker, lookback)
        scaler = MinMaxScaler()
        scaled_data = scaler.fit_transform(data.reshape(-1, 1))

        # 2. Prepare training data
        X, y = [], []
        for i in range(lookback - 10):
            X.append(scaled_data[i:i+10])
            y.append(scaled_data[i+10])
        X, y = np.array(X), np.array(y)

        # 3. Train LSTM (for demo, quick train; in production, load a pre-trained model)
        model = build_lstm_model((X.shape[1], 1))
        model.fit(X, y, epochs=10, batch_size=8, verbose=0)

        # 4. Predict next N days
        last_seq = scaled_data[-10:]
        preds = []
        for _ in range(days):
            pred = model.predict(last_seq.reshape(1, 10, 1), verbose=0)
            preds.append(pred[0, 0])
            last_seq = np.append(last_seq[1:], pred, axis=0)
        preds = scaler.inverse_transform(np.array(preds).reshape(-1, 1)).flatten().round(2).tolist()

        return jsonify({'ticker': ticker, 'predictions': preds, 'last_price': float(data[-1])})
else:
    @app.route('/predict', methods=['GET'])
    def predict():
        return jsonify({
            "error": "Price predictions are currently unavailable. TensorFlow is not installed.",
            "disclaimer": "Please install TensorFlow to enable price predictions."
        }), 503

# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    logging.info(f"Client connected: {request.sid}")
    # Send current prices immediately upon connection
    emit('price_update', price_data)
    emit('stats_update', stats_data)
    logging.info(f"Sent initial stats: {stats_data}")
    logging.info(f"Current price_data: {price_data}")

@socketio.on('disconnect')
def handle_disconnect():
    logging.info(f"Client disconnected: {request.sid}")

@socketio.on('subscribe')
def handle_subscribe(data):
    ticker = data.get('ticker')
    if ticker in TICKERS:
        logging.info(f"Client {request.sid} subscribed to {ticker}")
        join_room(ticker)
        # Send current price for this ticker immediately
        emit('price_update', {ticker: price_data.get(ticker, 0)})

@socketio.on('unsubscribe')
def handle_unsubscribe(data):
    ticker = data.get('ticker')
    if ticker in TICKERS:
        logging.info(f"Client {request.sid} unsubscribed from {ticker}")
        leave_room(ticker)

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5002))
    logging.info(f"Starting Flask server on port {port}")
    logging.info("Server will be accessible at:")
    logging.info(f"  - http://127.0.0.1:{port}")
    logging.info(f"  - http://localhost:{port}")
    logging.info(f"Initialized with tickers: {TICKERS}")
    logging.info(f"Current prices: {price_data}")
    socketio.run(app, host='0.0.0.0', port=port, debug=False, allow_unsafe_werkzeug=True)