import yfinance as yf
import time
from datetime import datetime, timedelta
import os

def interval_to_timedelta(interval):
    mapping = {
        "1m": timedelta(minutes=1),
        "5m": timedelta(minutes=5),
        "30m": timedelta(minutes=30),
        "1h": timedelta(hours=1),
    }
    return mapping.get(interval, timedelta(minutes=1))

def fill_missing_timestamps(data, interval):
    if not data:
        return []

    filled_data = []
    delta = interval_to_timedelta(interval)
    current = datetime.strptime(data[0]['time'], "%Y-%m-%d %H:%M")
    end = datetime.strptime(data[-1]['time'], "%Y-%m-%d %H:%M")

    index = 0
    while current <= end:
        current_str = current.strftime("%Y-%m-%d %H:%M")
        if index < len(data) and data[index]['time'] == current_str:
            filled_data.append(data[index])
            index += 1
        else:
            filled_data.append({
                "time": current_str,
                "price": None,
                "volume": 0,
                "open": None,
                "high": None,
                "low": None,
                "close": None,
                "rsi": None,
            })
        current += delta

    return filled_data

def fetch_real_price(ticker, shared_data, lock, stats_data, interval=60):
    while True:
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="1d", interval="1m")

            if not hist.empty:
                price = hist['Close'].iloc[-1]
                with lock:
                    shared_data[ticker] = round(price, 2)
                    stats_data[ticker]["high"] = max(stats_data[ticker]["high"], price)
                    stats_data[ticker]["low"] = min(stats_data[ticker]["low"], price)

                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                os.makedirs("logs", exist_ok=True)
                with open(f"logs/{ticker}.csv", "a") as f:
                    f.write(f"{timestamp},{price:.2f}\n")

        except Exception as e:
            print(f"[ERROR] {ticker}: {e}")

        time.sleep(interval)
