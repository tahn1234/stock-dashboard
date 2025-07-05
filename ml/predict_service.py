from flask import Flask, request, jsonify
import yfinance as yf
import numpy as np
import pandas as pd
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
from sklearn.preprocessing import MinMaxScaler

app = Flask(__name__)

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

if __name__ == '__main__':
    app.run(port=5003)
