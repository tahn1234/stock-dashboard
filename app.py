import os
import logging
import random
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

app = Flask(__name__)

# CORS configuration
CORS(app, resources={r"/*": {"origins": ["*"]}})

# Mock data
TICKERS = ['AAPL', 'TSLA', 'AMZN', 'GOOGL', 'MSFT', 'NVDA']
price_data = {ticker: 100.0 + i * 10 for i, ticker in enumerate(TICKERS)}

@app.route("/health")
def health_check():
    """Health check endpoint"""
    logging.info("Health check requested")
    return jsonify({
        "status": "ok",
        "message": "Server is running",
        "timestamp": datetime.now().isoformat(),
        "tickers": TICKERS
    })

@app.route("/")
def home():
    """Home endpoint"""
    return jsonify({
        "message": "Stock Dashboard API",
        "status": "running",
        "tickers": TICKERS
    })

@app.route("/api/prices")
def get_prices():
    """Get current prices"""
    return jsonify(price_data)

@app.route("/api/login", methods=["POST", "OPTIONS"])
def login():
    """Login endpoint"""
    if request.method == "OPTIONS":
        return "", 200
    
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if username == "admin" and password == "password123":
            return jsonify({
                "access_token": "dummy-token",
                "message": "Login successful"
            })
        else:
            return jsonify({"error": "Invalid credentials"}), 401
    except Exception as e:
        logging.error(f"Login error: {e}")
        return jsonify({"error": "Login failed"}), 500

@app.route("/api/history/<ticker>")
def get_history(ticker):
    """Get historical data for a ticker"""
    if ticker not in TICKERS:
        return jsonify({"error": "Ticker not found"}), 404
    
    # Generate mock historical data
    from datetime import timedelta
    
    data = []
    base_price = price_data.get(ticker, 100.0)
    
    for i in range(100):
        date = datetime.now() - timedelta(days=i)
        price = base_price + random.uniform(-10, 10)
        volume = random.randint(1000000, 10000000)
        
        data.append({
            "timestamp": date.isoformat(),
            "open": price,
            "high": price + random.uniform(0, 5),
            "low": price - random.uniform(0, 5),
            "close": price,
            "volume": volume
        })
    
    return jsonify(data)

@app.route("/api/stats/<ticker>")
def get_stats(ticker):
    """Get statistics for a ticker"""
    if ticker not in TICKERS:
        return jsonify({"error": "Ticker not found"}), 404
    
    base_price = price_data.get(ticker, 100.0)
    
    return jsonify({
        "ticker": ticker,
        "price": base_price,
        "change": random.uniform(-5, 5),
        "changePercent": random.uniform(-3, 3),
        "volume": random.randint(1000000, 10000000),
        "marketCap": random.randint(1000000000, 100000000000),
        "pe": random.uniform(10, 50),
        "dividend": random.uniform(0, 5)
    })

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5002))
    logging.info(f"Starting Flask server on port {port}")
    logging.info(f"Initialized with tickers: {TICKERS}")
    app.run(host='0.0.0.0', port=port, debug=False) 