import os
import logging
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

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5002))
    logging.info(f"Starting minimal Flask server on port {port}")
    logging.info(f"Initialized with tickers: {TICKERS}")
    app.run(host='0.0.0.0', port=port, debug=False) 