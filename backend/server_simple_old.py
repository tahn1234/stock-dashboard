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

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

app = Flask(__name__)

# Enhanced CORS configuration
CORS(app, 
     resources={r"/*": {"origins": ["*"]}},
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Initialize SocketIO with proper configuration
socketio = SocketIO(app, 
                   cors_allowed_origins=["*"], 
                   async_mode='threading',
                   logger=False,
                   engineio_logger=False)

# JWT Configuration
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-super-secret-key-change-this-in-production')
jwt = JWTManager(app)

# Mock user database
users = {
    "admin": "password123"
}

# Load tickers from environment variable or use default
TICKERS = os.environ.get('TICKERS', 'AAPL,TSLA,AMZN,GOOGL,MSFT,NVDA').split(',')
logging.info(f"Starting server with tickers: {TICKERS}")

# Initialize price data with mock values
price_data = {}
stats_data = {}
for ticker in TICKERS:
    base_price = 100.0 + random.uniform(50, 200)
    price_data[ticker] = base_price
    stats_data[ticker] = {
        "high": base_price * 1.02,
        "low": base_price * 0.98,
        "open": base_price * 0.99,
        "previousClose": base_price,
        "volume": random.randint(1000000, 5000000)
    }

lock = Lock()

@app.route("/health")
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "message": "Server is running",
        "timestamp": datetime.now().isoformat(),
        "tickers": TICKERS
    })

@app.route("/api/login", methods=["POST", "OPTIONS"])
def login():
    """Login endpoint"""
    if request.method == "OPTIONS":
        return "", 200
    
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if username in users and users[username] == password:
            access_token = create_access_token(identity=username)
            return jsonify({
                "access_token": access_token,
                "message": "Login successful"
            })
        else:
            return jsonify({"error": "Invalid credentials"}), 401
    except Exception as e:
        logging.error(f"Login error: {e}")
        return jsonify({"error": "Login failed"}), 500

@app.route("/")
def home():
    """Home endpoint"""
    return jsonify({
        "message": "Stock Dashboard API",
        "status": "running",
        "tickers": TICKERS
    })

@app.route("/api/prices")
@jwt_required()
def get_prices():
    """Get current prices"""
    return jsonify(price_data)

@app.route("/api/stats")
@jwt_required()
def get_stats():
    """Get current stats"""
    return jsonify(stats_data)

@app.route("/api/history/<ticker>")
@jwt_required()
def get_history(ticker):
    """Get historical data"""
    try:
        period = request.args.get('period', '1d')
        interval = request.args.get('interval', '1m')
        
        # Use yfinance to get real data
        df = yf.download(ticker, period=period, interval=interval)
        
        if df.empty:
            return jsonify({"error": "No data available"}), 404
        
        data = []
        for index, row in df.iterrows():
            data.append({
                "time": index.strftime("%Y-%m-%d %H:%M"),
                "price": float(row["Close"]),
                "volume": int(row["Volume"]) if not pd.isna(row["Volume"]) else 0,
                "open": float(row["Open"]) if not pd.isna(row["Open"]) else 0,
                "high": float(row["High"]) if not pd.isna(row["High"]) else 0,
                "low": float(row["Low"]) if not pd.isna(row["Low"]) else 0,
                "close": float(row["Close"])
            })
        
        return jsonify(data)
    except Exception as e:
        logging.error(f"History error for {ticker}: {e}")
        return jsonify({"error": f"Failed to fetch data: {str(e)}"}), 500

# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    logging.info(f"Client connected: {request.sid}")
    emit('price_update', price_data)
    emit('stats_update', stats_data)

@socketio.on('disconnect')
def handle_disconnect():
    logging.info(f"Client disconnected: {request.sid}")

@socketio.on('subscribe')
def handle_subscribe(data):
    ticker = data.get('ticker')
    if ticker in TICKERS:
        logging.info(f"Client {request.sid} subscribed to {ticker}")
        join_room(ticker)
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
    logging.info(f"Initialized with tickers: {TICKERS}")
    logging.info(f"Current prices: {price_data}")
    socketio.run(app, host='0.0.0.0', port=port, debug=False, allow_unsafe_werkzeug=True) 