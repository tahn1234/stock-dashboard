import websocket
import json
import threading
import time
import logging
from typing import Dict, Callable, List
import os
from dotenv import load_dotenv

load_dotenv()

class WebSocketFeed:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv('FINNHUB_API_KEY', 'demo')
        self.ws = None
        self.is_connected = False
        self.subscribed_symbols = set()
        self.price_callbacks = []
        self.connection_callbacks = []
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 5
        self.reconnect_delay = 5
        self.use_demo_mode = self.api_key == 'demo'
        
    def add_price_callback(self, callback: Callable):
        """Add a callback function to be called when price data is received"""
        self.price_callbacks.append(callback)
        
    def add_connection_callback(self, callback: Callable):
        """Add a callback function to be called when connection status changes"""
        self.connection_callbacks.append(callback)
        
    def connect(self):
        """Connect to Finnhub WebSocket"""
        try:
            if self.use_demo_mode:
                logging.info("Using demo mode - WebSocket will not connect without valid API key")
                self.is_connected = False
                return
                
            websocket_url = f"wss://ws.finnhub.io?token={self.api_key}"
            self.ws = websocket.WebSocketApp(
                websocket_url,
                on_open=self.on_open,
                on_message=self.on_message,
                on_error=self.on_error,
                on_close=self.on_close
            )
            
            # Start WebSocket connection in a separate thread
            wst = threading.Thread(target=self.ws.run_forever)
            wst.daemon = True
            wst.start()
            
            logging.info("WebSocket connection initiated")
            
        except Exception as e:
            logging.error(f"Failed to connect to WebSocket: {e}")
            self.is_connected = False
        
    def on_open(self, ws):
        """Called when WebSocket connection is established"""
        logging.info("WebSocket connection opened")
        self.is_connected = True
        self.reconnect_attempts = 0
        
        # Notify connection callbacks
        for callback in self.connection_callbacks:
            try:
                callback(True)
            except Exception as e:
                logging.error(f"Error in connection callback: {e}")
        
        # Resubscribe to previously subscribed symbols
        for symbol in self.subscribed_symbols:
            self.subscribe(symbol)
            
    def on_message(self, ws, message):
        """Called when a message is received from WebSocket"""
        try:
            data = json.loads(message)
            
            if data.get('type') == 'trade':
                # Handle trade data
                trades = data.get('data', [])
                for trade in trades:
                    symbol = trade.get('s')
                    price = trade.get('p')
                    volume = trade.get('v')
                    timestamp = trade.get('t')
                    
                    if symbol and price:
                        # Notify price callbacks
                        for callback in self.price_callbacks:
                            try:
                                callback(symbol, price, volume, timestamp)
                            except Exception as e:
                                logging.error(f"Error in price callback: {e}")
                                
            elif data.get('type') == 'ping':
                # Respond to ping with pong
                ws.send(json.dumps({'type': 'pong'}))
                
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse WebSocket message: {e}")
        except Exception as e:
            logging.error(f"Error processing WebSocket message: {e}")
            
    def on_error(self, ws, error):
        """Called when WebSocket error occurs"""
        logging.error(f"WebSocket error: {error}")
        self.is_connected = False
        
    def on_close(self, ws, close_status_code, close_msg):
        """Called when WebSocket connection is closed"""
        logging.info(f"WebSocket connection closed: {close_status_code} - {close_msg}")
        self.is_connected = False
        
        # Notify connection callbacks
        for callback in self.connection_callbacks:
            try:
                callback(False)
            except Exception as e:
                logging.error(f"Error in connection callback: {e}")
        
        # Attempt to reconnect
        self.attempt_reconnect()
        
    def attempt_reconnect(self):
        """Attempt to reconnect to WebSocket"""
        if self.reconnect_attempts < self.max_reconnect_attempts:
            self.reconnect_attempts += 1
            logging.info(f"Attempting to reconnect ({self.reconnect_attempts}/{self.max_reconnect_attempts})")
            
            time.sleep(self.reconnect_delay)
            self.connect()
        else:
            logging.error("Max reconnection attempts reached")
            
    def subscribe(self, symbol: str):
        """Subscribe to real-time data for a symbol"""
        if not self.is_connected:
            logging.warning(f"Cannot subscribe to {symbol}: WebSocket not connected")
            return
            
        try:
            # Format symbol for Finnhub (e.g., AAPL -> AAPL)
            formatted_symbol = symbol.upper()
            
            # Subscribe to trade data
            subscribe_message = {
                'type': 'subscribe',
                'symbol': formatted_symbol
            }
            
            self.ws.send(json.dumps(subscribe_message))
            self.subscribed_symbols.add(formatted_symbol)
            logging.info(f"Subscribed to {formatted_symbol}")
            
        except Exception as e:
            logging.error(f"Failed to subscribe to {symbol}: {e}")
            
    def unsubscribe(self, symbol: str):
        """Unsubscribe from real-time data for a symbol"""
        if not self.is_connected:
            return
            
        try:
            formatted_symbol = symbol.upper()
            
            # Unsubscribe from trade data
            unsubscribe_message = {
                'type': 'unsubscribe',
                'symbol': formatted_symbol
            }
            
            self.ws.send(json.dumps(unsubscribe_message))
            self.subscribed_symbols.discard(formatted_symbol)
            logging.info(f"Unsubscribed from {formatted_symbol}")
            
        except Exception as e:
            logging.error(f"Failed to unsubscribe from {symbol}: {e}")
            
    def disconnect(self):
        """Disconnect from WebSocket"""
        if self.ws:
            self.ws.close()
            self.is_connected = False
            logging.info("WebSocket disconnected")
            
    def get_connection_status(self) -> bool:
        """Get current connection status"""
        return self.is_connected
        
    def get_subscribed_symbols(self) -> List[str]:
        """Get list of currently subscribed symbols"""
        return list(self.subscribed_symbols)

# Global WebSocket feed instance
websocket_feed = None

def initialize_websocket_feed(api_key: str = None):
    """Initialize the global WebSocket feed"""
    global websocket_feed
    websocket_feed = WebSocketFeed(api_key)
    websocket_feed.connect()
    return websocket_feed

def get_websocket_feed() -> WebSocketFeed:
    """Get the global WebSocket feed instance"""
    return websocket_feed 