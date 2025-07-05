import React, { useEffect, useState, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, AreaChart, Area, ComposedChart, Bar } from "recharts";
import Plot from "react-plotly.js";
import io from 'socket.io-client';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Download, 
  Sun, 
  Moon, 
  LogOut, 
  Brain,
  BarChart3,
  Shield,
  Target,
  Newspaper,
  MessageCircle,
  Star,
  Lightbulb,
  Menu,
  X,
  List,
  Zap
} from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';


// Import new components
import AIInsights from './components/AIInsights';
import PredictionChart from './components/PredictionChart';
import TechnicalIndicators from './components/TechnicalIndicators';
import RiskAnalysis from './components/RiskAnalysis';
import NewsPanel from './components/NewsPanel';
import Chatbot from './components/Chatbot';
import Recommendations from './components/Recommendations';


const downloadCSV = (data: any[], filename = "history.csv") => {
  const headers = ["Time", "Price", "Volume", "Open", "High", "Low", "Close"];
  const rows = data.map((row) => [
    row.time ?? "--",
    row.price != null ? row.price.toFixed(2) : "--", 
    row.volume != null ? row.volume : "--",
    row.open != null ? row.open.toFixed(2) : "--",
    row.high != null ? row.high.toFixed(2) : "--",
    row.low != null ? row.low.toFixed(2) : "--",
    row.close != null ? row.close.toFixed(2) : "--",
  ]);

  const csvContent = [headers, ...rows]
    .map((e) => e.join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function calculateRSI(data: any[], period = 14) {
  const rsi = [];
  let gains = 0, losses = 0;

  for (let i = 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;

    if (i < period) {
      if (diff > 0) gains += diff;
      else losses -= diff;
      rsi.push(null); 
    } else if (i === period) {
      if (diff > 0) gains += diff;
      else losses -= diff;
      const avgGain = gains / period;
      const avgLoss = losses / period || 1;
      const rs = avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    } else {
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      gains = (gains * (period - 1) + gain) / period;
      losses = (losses * (period - 1) + loss) / period;
      const rs = gains / (losses || 1);
      rsi.push(100 - 100 / (1 + rs));
    }
  }

  return rsi;
}

function App() {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<Record<string, any>>({});
  const [isDarkMode, setIsDarkMode] = useState(true); // Always dark mode
  const [selectedTicker, setSelectedTicker] = useState("AAPL");
  const [chartType, setChartType] = useState("line");
  const [period, setPeriod] = useState("1d");
  const [interval, setInterval] = useState("1m");
  const [customHistory, setCustomHistory] = useState<any[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [socket, setSocket] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'charts' | 'ai' | 'predictions' | 'indicators' | 'risk' | 'news' | 'chat' | 'recommendations'>('charts');
  const [predictions, setPredictions] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [showChatbot, setShowChatbot] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Backend server URL - use environment variable or fallback to localhost
  const SERVER_URLS = [
    import.meta.env.VITE_API_URL || 'http://localhost:5002',
    'http://localhost:5002',
    'http://127.0.0.1:5002'
  ];
  const [currentServerUrl, setCurrentServerUrl] = useState(SERVER_URLS[0]);

  const autoInterval: Record<string, string> = {
    "1d": "1m",
    "5d": "5m",
    "1mo": "30m",
    "3mo": "1h"      
  };

  const effectiveInterval = interval === "auto" ? autoInterval[period] || "1m" : interval;
  
  // Always use dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');
  }, []);

  // Test server connectivity
  const testServerConnection = useCallback(async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        timeout: 5000
      } as any);
      return response.ok;
    } catch (error) {
      console.log(`Server at ${url} is not accessible:`, error);
      return false;
    }
  }, []);

  // Find working server URL
  const findWorkingServer = useCallback(async () => {
    for (const url of SERVER_URLS) {
      const isWorking = await testServerConnection(url);
      if (isWorking) {
        setCurrentServerUrl(url);
        console.log(`Using server at: ${url}`);
        return url;
      }
    }
    console.error('No working server found');
    return null;
  }, [testServerConnection]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (isAuthenticated) {
      setConnectionStatus('connecting');
      const newSocket = io(currentServerUrl);
      
      newSocket.on('connect', () => {
        console.log('Connected to WebSocket server');
        setConnectionStatus('connected');
        newSocket.emit('subscribe', { ticker: selectedTicker });
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
        setConnectionStatus('disconnected');
      });

      newSocket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setConnectionStatus('disconnected');
        setError('Failed to connect to server. Please ensure the backend is running on port 5002.');
      });

      newSocket.on('price_update', (data: any) => {
        console.log("📡 Received price update:", data);
        setPrices(prevPrices => ({
          ...prevPrices,
          ...data
        }));
      });

      newSocket.on('stats_update', (data: any) => {
        setStats(data);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [isAuthenticated, selectedTicker, currentServerUrl]);

  // Handle ticker change
  useEffect(() => {
    if (socket && connectionStatus === 'connected') {
      socket.emit('unsubscribe', { ticker: selectedTicker });
      socket.emit('subscribe', { ticker: selectedTicker });
    }
  }, [selectedTicker, socket, connectionStatus]);

  const fetchWithAuth = useCallback(async (url: string, options: any = {}) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token');
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      if (response.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem('token');
        throw new Error('Authentication failed');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      return response.json();
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Cannot connect to server. Please ensure the backend is running on port 5002.');
      }
      throw err;
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      // First, try to find a working server
      const workingServer = await findWorkingServer();
      if (!workingServer) {
        throw new Error('Cannot connect to server. Please ensure the backend is running on port 5002.');
      }

      const response = await fetch(`${workingServer}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(errorData.error || 'Login failed');
      }
      
      const data = await response.json();
      localStorage.setItem('token', data.access_token);
      setIsAuthenticated(true);
      setError('');
      console.log('Login successful');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('Failed to fetch'))) {
        setError('Cannot connect to server. Please ensure the backend is running on port 5002. Try running: python backend/server.py');
      } else {
        setError(err.message || 'Failed to connect to server');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = useCallback(async () => {
    try {
      setError('');
      setIsLoading(true);
      
      const data = await fetchWithAuth(
        `${currentServerUrl}/api/history/${selectedTicker}?period=${period}&interval=${effectiveInterval}`
      );
      const rsi = calculateRSI(data);
      const rsiHistory = data.map((d: any, i: number) => ({ ...d, rsi: rsi[i] ?? null }));
      setCustomHistory(rsiHistory);
      
      if (rsiHistory.length > 0) {
        console.log(`Fetched ${rsiHistory.length} data points for ${selectedTicker}`);
      }
    } catch (err: any) {
      console.error('Error fetching history:', err);
      setError(err.message || 'Failed to fetch historical data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedTicker, period, effectiveInterval, fetchWithAuth, currentServerUrl]);

  const fetchPredictions = useCallback(async (days: number) => {
    try {
      setError('');
      setIsLoading(true);
      // Predictions endpoint doesn't require auth
      const response = await fetch(`${currentServerUrl}/predict?ticker=${selectedTicker}&days=${days}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setPredictions(data);
    } catch (err: any) {
      console.error('Error fetching predictions:', err);
      setError(err.message || 'Failed to fetch predictions');
    } finally {
      setIsLoading(false);
    }
  }, [selectedTicker, currentServerUrl]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory();
    }
  }, [isAuthenticated, fetchHistory]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
    setError('');
    setConnectionStatus('disconnected');
    if (socket) {
      socket.disconnect();
    }
  }, [socket]);

  const PriceDisplay = ({ ticker, price, stats }: any) => {
    const previousClose = stats?.previousClose;
    const absChange = previousClose ? price - previousClose : 0;
    const percentChange = previousClose ? (absChange / previousClose) * 100 : 0;
    const getSign = (value: number) => (value > 0 ? '+' : value < 0 ? '−' : '');
    const formattedChange = `${getSign(absChange)}${Math.abs(absChange).toFixed(2)} (${Math.abs(percentChange).toFixed(2)}%)`;

    const formatPrice = (value: number) => {
      return value ? `$${value.toFixed(2)}` : 'N/A';
    };

    const formatVolume = (value: number) => {
      if (!value) return 'N/A';
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(2)}M`;
      }
      if (value >= 1000) {
        return `${(value / 1000).toFixed(2)}K`;
      }
      return value.toString();
    };

    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg py-6 px-6 border-l-4 mx-auto ${
        absChange < 0 ? 'border-red-500' : 'border-stock-green'
      }`}>
        {/* Ticker and Live */}
        <div className="flex items-center justify-between w-full mb-2">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{ticker}</h2>
          <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 ${
            absChange > 0 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
            absChange < 0 ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}>
            <span role="img" aria-label="status">{absChange > 0 ? '🟢' : absChange < 0 ? '🔴' : '⚪️'}</span>
            Live
          </div>
        </div>
        {/* Main Price and Change */}
        <div className="flex flex-col items-start mb-3">
          <div className={`text-3xl font-bold mb-1 ${
            absChange > 0 ? 'text-green-500' : absChange < 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'
          }`}>{formatPrice(price)}</div>
          <div className="text-lg font-medium flex items-center gap-2">
            {formattedChange}
            {absChange > 0 ? <TrendingUp className="w-5 h-5 text-green-500" /> : absChange < 0 ? <TrendingDown className="w-5 h-5 text-red-500" /> : null}
          </div>
        </div>
        {/* Stats Row below price */}
        <div className="flex flex-row items-center justify-between gap-4 mt-10">
          <div className="flex flex-col items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">High</span>
            <span className="font-semibold text-gray-900 dark:text-white">{formatPrice(stats?.high)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Low</span>
            <span className="font-semibold text-gray-900 dark:text-white">{formatPrice(stats?.low)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Prev Close</span>
            <span className="font-semibold text-gray-900 dark:text-white">{formatPrice(stats?.previousClose)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Volume</span>
            <span className="font-semibold text-gray-900 dark:text-white">{formatVolume(stats?.volume)}</span>
          </div>
        </div>
      </div>
    );
  };

  if (!isAuthenticated) {
    // Render landing page with router
    return (
      <Router>
        <Routes>

          <Route path="*" element={
            <div className="relative flex size-full min-h-screen flex-col bg-gray-900 overflow-x-hidden font-manrope">
              <div className="layout-container flex h-full grow flex-col">
                {/* Header Component */}
                <header className="flex items-center bg-gray-900 justify-between whitespace-nowrap border-b border-solid border-b-stock-secondary px-4 md:px-10 py-3">
                  <div className="flex items-center gap-4 text-white">
                    <div className="size-8 md:size-10">
                      <TrendingUp className="w-full h-full text-stock-green" />
                    </div>
                    <h2 className="text-white text-lg md:text-xl font-bold leading-tight tracking-[-0.015em]">
                      Real Time Stock Tracker
                    </h2>
                  </div>
                  {/* Desktop Navigation */}
                  <div className="hidden md:flex flex-1 justify-end gap-8">
                    <div className="flex items-center gap-9">
                      <Link className="text-white text-sm font-medium leading-normal hover:text-stock-green transition-colors" to="/">
                        Home
                      </Link>
                      <a
                        href="#about"
                        onClick={e => {
                          e.preventDefault();
                          document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="text-white text-sm font-medium leading-normal hover:text-stock-green transition-colors"
                      >
                        About
                      </a>
                      <a
                        href="#features"
                        onClick={e => {
                          e.preventDefault();
                          document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="text-white text-sm font-medium leading-normal hover:text-stock-green transition-colors"
                      >
                        Features
                      </a>
                      <a className="text-white text-sm font-medium leading-normal hover:text-stock-green transition-colors" href="mailto:contact@stocktracker.com?subject=Stock Tracker Inquiry&body=Hello,%0D%0A%0D%0AI'm interested in learning more about your Stock Tracker dashboard.%0D%0A%0D%0ABest regards,">
                        Contact
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <Link 
                        to="/login"
                        className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-stock-green text-stock-dark text-sm font-bold leading-normal tracking-[0.015em] hover:bg-[#45b827] transition-colors"
                      >
                        <span className="truncate">Log In</span>
                      </Link>
                      <Link 
                        to="/signup"
                        className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-stock-secondary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-[#3d5837] transition-colors"
                      >
                        <span className="truncate">Sign Up</span>
                      </Link>
                    </div>
                  </div>
                  {/* Mobile Menu Button */}
                  <button
                    className="md:hidden text-white"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  >
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                  </button>
                  {/* Mobile Menu */}
                  {isMobileMenuOpen && (
                    <div className="absolute top-full left-0 right-0 bg-stock-dark border-b border-stock-secondary md:hidden">
                      <div className="flex flex-col p-4 space-y-4">
                        <Link className="text-white text-sm font-medium leading-normal hover:text-stock-green transition-colors" to="/">
                          Home
                        </Link>

                        <a className="text-white text-sm font-medium leading-normal hover:text-stock-green transition-colors" href="#">
                          News
                        </a>
                        <a className="text-white text-sm font-medium leading-normal hover:text-stock-green transition-colors" href="mailto:contact@stocktracker.com?subject=Stock Tracker Inquiry&body=Hello,%0D%0A%0D%0AI'm interested in learning more about your Stock Tracker dashboard.%0D%0A%0D%0ABest regards,">
                          Contact
                        </a>
                        <div className="flex gap-2 pt-4">
                          <Link 
                            to="/login"
                            className="flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-stock-green text-stock-dark text-sm font-bold leading-normal tracking-[0.015em] hover:bg-[#45b827] transition-colors"
                          >
                            Log In
                          </Link>
                          <Link 
                            to="/signup"
                            className="flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-stock-secondary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-[#3d5837] transition-colors"
                          >
                            Sign Up
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </header>

                {/* Hero Component */}
                <div className="px-4 md:px-40 flex flex-1 justify-center py-10">
                  <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
                    <div className="@container">
                      <div className="@[480px]:p-4">
                        <div
                          className="flex min-h-[400px] md:min-h-[480px] flex-col gap-6 bg-cover bg-center bg-no-repeat @[480px]:gap-8 @[480px]:rounded-xl items-center justify-center p-4 md:p-8"
                          style={{
                            backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.7) 100%), url("/pictures/dashboard.png")',
                          }}
                        >
                          <div className="flex flex-col gap-4 text-center">
                            <h1 className="text-white text-3xl md:text-4xl lg:text-5xl font-black leading-tight tracking-[-0.033em]">
                              Stay Ahead of the Market
                            </h1>
                            <h2 className="text-white text-sm md:text-base font-normal leading-normal max-w-2xl">
                              Track stocks in real-time with AI-powered insights and live market data. Analyze trends, view technical indicators, and explore actionable insights to understand the market better.                            </h2>
                          </div>
                          <div className="flex-wrap gap-3 flex justify-center">
                            <Link 
                              to="/login"
                              className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 md:h-12 md:px-5 bg-stock-green text-stock-dark text-sm md:text-base font-bold leading-normal tracking-[0.015em] hover:bg-[#45b827] transition-colors"
                            >
                              <span className="truncate">Log In</span>
                            </Link>
                            <Link 
                              to="/signup"
                              className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 md:h-12 md:px-5 bg-stock-secondary text-white text-sm md:text-base font-bold leading-normal tracking-[0.015em] hover:bg-[#3d5837] transition-colors"
                            >
                              <span className="truncate">Sign Up</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Features Component */}
                <div id="about" className="flex flex-col gap-10 px-4 md:px-40 py-10 @container">
                  <div className="flex flex-col gap-8 max-w-[900px] mx-auto">
                    <h1 className="text-[32px] md:text-4xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-white mb-4 border-l-4 border-stock-green pl-4">About</h1>
                    <p className="text-white text-lg font-normal leading-relaxed max-w-[800px] mx-auto">
                      This real-time stock dashboard was built to help investors, students, and curious learners track live market data, view AI-powered insights, and analyze technical indicators easily in one place. It offers a clean, intuitive interface focused on delivering fast, actionable insights without distractions, so you can quickly understand what's happening in the markets as it happens.
                    </p>
                    <p className="text-white text-lg font-normal leading-relaxed max-w-[800px] mx-auto mb-2">
                      Whether you're watching trends throughout the day or deepening your knowledge of how the markets move, this dashboard provides the tools you need to stay informed and make data-driven decisions in real time.
                    </p>
                    <hr className="border-t border-stock-green/40" />
                    {/* Tech Stack Section */}
                    <div className="max-w-[800px] mb-4">
                      <h2 className="text-white text-2xl font-bold mb-3">Tech Stack</h2>
                      <div className="flex flex-col gap-4">
                        {/* Frontend */}
                        <div>
                          <h3 className="text-white text-lg font-semibold mb-1">Frontend</h3>
                          <ul className="flex flex-wrap gap-3 text-white text-base">
                            <li className="bg-stock-green/20 rounded-lg px-3 py-1 font-semibold">React</li>
                            <li className="bg-blue-500/20 rounded-lg px-3 py-1 font-semibold">TypeScript</li>
                            <li className="bg-cyan-500/20 rounded-lg px-3 py-1 font-semibold">Tailwind CSS</li>
                            <li className="bg-purple-500/20 rounded-lg px-3 py-1 font-semibold">Recharts</li>
                            <li className="bg-orange-500/20 rounded-lg px-3 py-1 font-semibold">Plotly.js</li>
                            <li className="bg-indigo-500/20 rounded-lg px-3 py-1 font-semibold">Vite</li>
                          </ul>
                        </div>
                        {/* Backend */}
                        <div>
                          <h3 className="text-white text-lg font-semibold mb-1">Backend</h3>
                          <ul className="flex flex-wrap gap-3 text-white text-base">
                            <li className="bg-purple-400/20  rounded-lg px-3 py-1 font-semibold">Python</li>
                            <li className="bg-gray-400/20 rounded-lg px-3 py-1 font-semibold">Flask</li>
                            <li className="bg-green-500/20 rounded-lg px-3 py-1 font-semibold">SQL</li>
                          </ul>
                        </div>
                        {/* AI & Data */}
                        <div>
                          <h3 className="text-white text-lg font-semibold mb-1">AI & Data</h3>
                          <ul className="flex flex-wrap gap-3 text-white text-base">
                            <li className="bg-yellow-500/20 rounded-lg px-3 py-1 font-semibold">TensorFlow (LSTM Models)</li>
                            <li className="bg-blue-400/20 rounded-lg px-3 py-1 font-semibold">NumPy</li>
                            <li className="bg-green-400/20 rounded-lg px-3 py-1 font-semibold">Pandas</li>
                            <li className="bg-purple-400/20 rounded-lg px-3 py-1 font-semibold">Scikit-learn</li>
                          </ul>
                        </div>
                        {/* APIs & Real-time */}
                        <div>
                          <h3 className="text-white text-lg font-semibold mb-1">APIs & Real-time</h3>
                          <ul className="flex flex-wrap gap-3 text-white text-base">
                            <li className="bg-blue-400/20 rounded-lg px-3 py-1 font-semibold">Finnhub API</li>
                            <li className="bg-green-400/20 rounded-lg px-3 py-1 font-semibold">NewsAPI</li>
                            <li className="bg-purple-400/20 rounded-lg px-3 py-1 font-semibold">WebSocket</li>
                            <li className="bg-orange-400/20 rounded-lg px-3 py-1 font-semibold">Socket.IO</li>
                            <li className="bg-gray-500/20 rounded-lg px-3 py-1 font-semibold">Yahoo Finance API</li>

                          </ul>
                        </div>
                      </div>
                    </div>
                    <hr className="border-t border-stock-green/40 my-2" />
                    {/* Why I Built This Section */}
                    <div className="max-w-[800px] mx-auto mb-2">
                      <h2 className="text-white text-2xl font-bold mb-3">Why I Built This</h2>
                      <p className="text-white text-base font-normal leading-normal mb-4">
                        I've always been curious about how the markets work, and while exploring financial data, I noticed that many dashboards felt cluttered or too complex for quick, meaningful insights. I wanted to create something that I would actually use—a clean, focused tool to track live prices and understand trends without getting overwhelmed.
                      </p>
                      <ul className="list-disc pl-6 flex flex-col gap-2 text-white text-base">
                        <li><span className="font-bold">Satisfy my curiosity</span> about how live stock data and APIs work in the real world.</li>
                        <li>Learn how to implement AI-powered insights and technical indicators in a clear, user-friendly interface.</li>
                        <li>Strengthen my frontend development skills using <span className="font-bold">React, TypeScript, and Tailwind CSS.</span></li>
                        <li>Practice handling <span className="font-bold">real-time data streams</span> in a scalable, responsive dashboard.</li>
                        <li>Explore how technology can make complex information <span className="font-bold">more accessible and actionable</span> for everyday users.</li>
                      </ul>
                    </div>
                  </div>
                  <div/>
                  <h1 id="features" className="text-[32px] md:text-4xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-white mb-4 border-l-4 border-stock-green pl-4">
                    Key Features
                  </h1>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[960px] mx-auto">
                    {[
                      {
                        icon: TrendingUp,
                        title: "Real-Time Stock Tracking",
                        description: "Displays live prices, volume, and key stats with instant updates for seamless monitoring."
                      },
                      {
                        icon: List,
                        title: "AI Insights",
                        description: "Unlock AI-powered insights to better understand market trends and stock behavior."
                      },
                      {
                        icon: Newspaper,
                        title: "Predictions",
                        description: "Access advanced stock price predictions to inform your trading strategies."
                      },
                      {
                        icon: BarChart3,
                        title: "Technical Indicators",
                        description: "Visualize moving averages, RSI, and other indicators for deeper analysis.."
                      },
                      {
                        icon: Shield,
                        title: "Financial News",
                        description: "Stay updated with relevant financial news and sentiment insights."
                      },
                      {
                        icon: Zap,
                        title: "Real-Time Charts",
                        description: "View real-time interactive charts to monitor your investments live."
                      }
                    ].map((feature, index) => {
                      const IconComponent = feature.icon;
                      return (
                        <div
                          key={index}
                          className="flex flex-1 gap-4 rounded-lg border border-stock-border bg-stock-card p-6 flex-col hover:border-stock-green hover:bg-[#243520] transition-all duration-300 group"
                        >
                          <div className="text-stock-green group-hover:text-[#45b827] transition-colors">
                            <IconComponent size={24} />
                          </div>
                          <div className="flex flex-col gap-2">
                            <h2 className="text-white text-base font-bold leading-tight">
                              {feature.title}
                            </h2>
                            <p className="text-stock-muted text-sm font-normal leading-normal">
                              {feature.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dashboard Preview Section */}
                <div className="w-full px-4 md:px-40 py-16">
                  <div className="mb-8">
                    <h2 className="text-[32px] md:text-4xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-white mb-4 border-l-4 border-stock-green pl-4">
                      Dashboard Preview
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="flex gap-6" style={{ minWidth: '600px' }}>
                      {['/pictures/linechart.png', '/pictures/candlestick.png', '/pictures/predictions.png', '/pictures/news.png', '/pictures/technical.png','/pictures/historicaldata.png','/pictures/recommendations.png'].map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt="Dashboard preview"
                          className="h-64 w-auto rounded-xl shadow-lg object-cover border border-stock-border bg-stock-card flex-shrink-0"
                          style={{ maxWidth: '90vw' }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Component */}
                <footer className="w-full bg-gray-900 border-t border-stock-green/30 mt-16">
                  <div className="max-w-4xl mx-auto flex flex-col items-center gap-4 py-8 px-4">
                    <div className="flex flex-wrap justify-center gap-6 text-gray-300 text-sm font-medium">
                      {/* <a href="#" className="hover:text-stock-green transition-colors">Terms of Service</a>
                      <a href="#" className="hover:text-stock-green transition-colors">Privacy Policy</a>
                      <a href="#" className="hover:text-stock-green transition-colors">Contact</a>
                      <a href="#" className="hover:text-stock-green transition-colors"></a> */}
                    </div>
                    <div className="text-gray-500 text-xs text-center">
                      © 2025 Real-Time Stock Tracker. All rights reserved.
                    </div>
                  </div>
                </footer>
              </div>
            </div>
          } />
          <Route path="/login" element={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stock-dark via-gray-900 to-stock-green/20 relative overflow-hidden">
              {/* Subtle blurred background shapes */}
              <div className="absolute -top-32 -left-32 w-96 h-96 bg-gradient-to-br from-green-400/20 to-blue-500/10 rounded-full blur-3xl z-0" />
              <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-tr from-blue-500/20 to-green-400/10 rounded-full blur-2xl z-0" />
              <div className="relative z-10 w-full max-w-md">
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-2 border-transparent bg-clip-padding rounded-2xl shadow-2xl p-8 flex flex-col gap-6 mx-auto animate-fade-in">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-4">
                      <TrendingUp className="w-8 h-8 text-stock-green mr-2" />
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock Tracker</h1>
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Welcome Back</h2>
                    <p className="text-gray-600 dark:text-gray-300 text-base mb-4">Sign in to your account</p>
                  </div>
                  
                  {error && <div className="text-red-500 bg-red-100 dark:bg-red-900/40 rounded-lg px-4 py-2 text-center text-sm font-medium mb-2">{error}</div>}
                  
                  <form className="flex flex-col gap-4" onSubmit={handleLogin}>
                    <div>
                      <label htmlFor="username" className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-1">Username</label>
                      <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-stock-green focus:border-stock-green transition"
                        placeholder="Enter your username"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="password" className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-1">Password</label>
                      <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-stock-green focus:border-stock-green transition"
                        placeholder="Enter your password"
                      />
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full py-3 mt-2 rounded-lg bg-gradient-to-r from-stock-green to-blue-500 text-white font-bold text-lg shadow-md hover:from-green-500 hover:to-blue-600 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stock-green"
                    >
                      {isLoading ? 'Logging in...' : 'Log In'}
                    </button>
                  </form>
                  
                  <div className="text-gray-500 text-xs text-center mt-2">
                    Default credentials: <b>admin / password123</b><br />
                    Make sure your backend server is running on port 5002
                  </div>
                  
                  <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      Don't have an account?{' '}
                      <Link to="/signup" className="text-stock-green hover:underline font-semibold">
                        Sign up here
                      </Link>
                    </p>
                  </div>
                  
                  <Link
                    to="/"
                    className="w-full mt-2 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-300 dark:hover:bg-gray-700 transition text-center"
                  >
                    Back to Home
                  </Link>
                </div>
              </div>
            </div>
          } />
          <Route path="/signup" element={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stock-dark via-gray-900 to-stock-green/20 relative overflow-hidden">
              {/* Subtle blurred background shapes */}
              <div className="absolute -top-32 -left-32 w-96 h-96 bg-gradient-to-br from-green-400/20 to-blue-500/10 rounded-full blur-3xl z-0" />
              <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-tr from-blue-500/20 to-green-400/10 rounded-full blur-2xl z-0" />
              <div className="relative z-10 w-full max-w-md">
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-2 border-transparent bg-clip-padding rounded-2xl shadow-2xl p-8 flex flex-col gap-6 mx-auto animate-fade-in">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-4">
                      <TrendingUp className="w-8 h-8 text-stock-green mr-2" />
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock Tracker</h1>
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Create Account</h2>
                    <p className="text-gray-600 dark:text-gray-300 text-base mb-4">Join us to start tracking your investments</p>
                  </div>
                  
                  <form className="flex flex-col gap-4">
                    <div>
                      <label htmlFor="fullName" className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-1">Full Name</label>
                      <input
                        type="text"
                        id="fullName"
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-stock-green focus:border-stock-green transition"
                        placeholder="Enter your full name"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="email" className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-1">Email Address</label>
                      <input
                        type="email"
                        id="email"
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-stock-green focus:border-stock-green transition"
                        placeholder="Enter your email"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="username" className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-1">Username</label>
                      <input
                        type="text"
                        id="username"
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-stock-green focus:border-stock-green transition"
                        placeholder="Choose a username"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="password" className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-1">Password</label>
                      <input
                        type="password"
                        id="password"
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-stock-green focus:border-stock-green transition"
                        placeholder="Create a password"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="confirmPassword" className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-1">Confirm Password</label>
                      <input
                        type="password"
                        id="confirmPassword"
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-stock-green focus:border-stock-green transition"
                        placeholder="Confirm your password"
                      />
                    </div>
                    
                    <div className="flex items-center mb-4">
                      <input
                        type="checkbox"
                        id="terms"
                        required
                        className="w-4 h-4 text-stock-green bg-gray-100 border-gray-300 rounded focus:ring-stock-green focus:ring-2"
                      />
                      <label htmlFor="terms" className="ml-2 text-sm text-gray-700 dark:text-gray-200">
                        I agree to the <a href="#" className="text-stock-green hover:underline">Terms of Service</a> and <a href="#" className="text-stock-green hover:underline">Privacy Policy</a>
                      </label>
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full py-3 mt-2 rounded-lg bg-gradient-to-r from-stock-green to-blue-500 text-white font-bold text-lg shadow-md hover:from-green-500 hover:to-blue-600 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stock-green"
                    >
                      Create Account
                    </button>
                  </form>
                  
                  <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      Already have an account?{' '}
                      <Link to="/" className="text-stock-green hover:underline font-semibold">
                        Sign in here
                      </Link>
                    </p>
                  </div>
                  
                  <Link
                    to="/"
                    className="w-full mt-2 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-300 dark:hover:bg-gray-700 transition text-center"
                  >
                    Back to Home
                  </Link>
                </div>
              </div>
            </div>
          } />
        </Routes>
      </Router>
    );
  }

  const tickers = Object.keys(prices);

  const formatTooltip = (value: any, name: string) => {
    if (name === 'high') return [`$${value.toFixed(2)}`, 'High'];
    if (name === 'low') return [`$${value.toFixed(2)}`, 'Low'];
    if (name === 'price') return [`$${value.toFixed(2)}`, 'Price'];
    if (name === 'volume') return [`${(value / 1000000).toFixed(2)}M`, 'Volume'];
    if (name === 'open') return [`$${value.toFixed(2)}`, 'Open'];
    if (name === 'close') return [`$${value.toFixed(2)}`, 'Close'];
    return [value, name];
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 dark:text-white">{label}</p>
          {payload.map((entry: any, index: number) => {
            const [value, name] = formatTooltip(entry.value, entry.name);
            return (
              <p key={index} style={{ color: entry.color }} className="text-sm">
                {name}: {value}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const formatXAxisTick = (tickItem: string) => {
    if (!tickItem) return '';
    
    const date = new Date(tickItem.replace(" ", "T"));
    
    if (period === "1d") {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (period === "5d") {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else if (period === "1mo" || period === "3mo") {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
  };

  const getTickInterval = () => {
    if (!customHistory.length) return 0;
    const dataLength = customHistory.length;
    if (period === "1d") return Math.max(1, Math.floor(dataLength / 10));
    else if (period === "5d") return Math.max(1, Math.floor(dataLength / 8));
    else return Math.max(1, Math.floor(dataLength / 6));
  };

  const renderChart = () => {
    // Calculate Y-axis domain for better visualization
    const calculateYDomain = () => {
      if (!customHistory || customHistory.length === 0) return ['auto', 'auto'];
      
      const prices = customHistory.map(d => d.close).filter(p => p != null);
      if (prices.length === 0) return ['auto', 'auto'];
      
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const range = maxPrice - minPrice;
      
      // Add 5% padding to the range
      const padding = range * 0.05;
      return [minPrice - padding, maxPrice + padding];
    };

    switch (chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={customHistory}>
              <XAxis 
                dataKey="time" 
                tickFormatter={formatXAxisTick}
                interval={getTickInterval()}
                stroke="#6B7280"
              />
              <YAxis 
                yAxisId="left" 
                orientation="left" 
                stroke="#6B7280"
                domain={calculateYDomain()}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#6B7280"
                domain={calculateYDomain()}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
              />
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="close"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
                name="Close"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="high"
                stroke="#10B981"
                strokeWidth={1}
                dot={false}
                name="High"
                opacity={0.8}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="low"
                stroke="#EF4444"
                strokeWidth={1}
                dot={false}
                name="Low"
                opacity={0.8}
              />
            </LineChart>
          </ResponsiveContainer>
        );
      
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={customHistory}>
              <defs>
                <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                tickFormatter={formatXAxisTick}
                interval={getTickInterval()}
                stroke="#6B7280"
              />
              <YAxis 
                stroke="#6B7280"
                domain={calculateYDomain()}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
              />
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="close"
                stroke="#3B82F6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorClose)"
                name="Close"
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      
      case 'candlestick':
        return (
          <div className="h-96">
            <Plot
              data={[
                {
                  x: customHistory.map(d => d.time),
                  open: customHistory.map(d => d.open),
                  high: customHistory.map(d => d.high),
                  low: customHistory.map(d => d.low),
                  close: customHistory.map(d => d.close),
                  type: 'candlestick',
                  name: 'OHLC',
                  increasing: { line: { color: '#10B981' }, fillcolor: '#10B981' },
                  decreasing: { line: { color: '#EF4444' }, fillcolor: '#EF4444' }
                }
              ]}
              layout={{
                title: `${selectedTicker} Stock Price`,
                xaxis: {
                  title: 'Time',
                  gridcolor: '#374151',
                  color: '#D1D5DB'
                },
                yaxis: {
                  title: 'Price ($)', 
                  gridcolor: '#374151',
                  color: '#D1D5DB'
                },
                height: 400,
                plot_bgcolor: 'rgba(0,0,0,0)',
                paper_bgcolor: 'rgba(0,0,0,0)',
                font: { color: '#D1D5DB' }
              }}
              config={{ responsive: true }}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            AI Stock Dashboard
          </h1>
          <div className="flex items-center gap-4">
            <select 
              value={selectedTicker} 
              onChange={(e) => setSelectedTicker(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {tickers.length > 0 ? tickers.map((ticker) => (
                <option key={ticker} value={ticker}>
                  {ticker}
                </option>
              )) : (
                <option value="AAPL">AAPL</option>
              )}
            </select>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Price Display */}
        <div className="flex justify-center mb-10 mt-6">
          <div className="w-full">
            <PriceDisplay ticker={selectedTicker} price={prices[selectedTicker] || 0} stats={stats[selectedTicker] || {}} />
          </div>
        </div>
        {/* Navigation Tabs - with icons, below PriceDisplay */}
        <div className="flex mb-8">
          <div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'charts', label: 'Charts', icon: <BarChart3 className="w-4 h-4" /> },
                { key: 'ai', label: 'AI Insights', icon: <Brain className="w-4 h-4" /> },
                { key: 'predictions', label: 'Predictions', icon: <Target className="w-4 h-4" /> },
                { key: 'indicators', label: 'Technical', icon: <Activity className="w-4 h-4" /> },
                { key: 'risk', label: 'Risk Analysis', icon: <Shield className="w-4 h-4" /> },
                { key: 'news', label: 'News', icon: <Newspaper className="w-4 h-4" /> },
                { key: 'recommendations', label: 'Recommendations', icon: <Lightbulb className="w-4 h-4" /> }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    activeTab === tab.key
                      ? 'bg-blue-500 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart Controls and Content */}
        {activeTab === 'charts' && (
          <>
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <select 
                value={chartType} 
                onChange={(e) => setChartType(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="line">Line Chart</option>
                <option value="area">Area Chart</option>
                <option value="candlestick">Candlestick Chart</option>
              </select>
              <select 
                value={period} 
                onChange={(e) => setPeriod(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="1d">1 Day</option>
                <option value="5d">5 Days</option>
                <option value="1mo">1 Month</option>
                <option value="3mo">3 Months</option>
                <option value="6mo">6 Months</option>
                <option value="1y">1 Year</option>
              </select>
              <select 
                value={interval} 
                onChange={(e) => setInterval(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="1m">1 Minute</option>
                <option value="5m">5 Minutes</option>
                <option value="15m">15 Minutes</option>
                <option value="1h">1 Hour</option>
                <option value="1d">1 Day</option>
              </select>
              <button 
                onClick={() => downloadCSV(customHistory, `${selectedTicker}_${period}_${interval}.csv`)}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              {isLoading && (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-500 dark:text-gray-400">Loading historical data...</p>
                  </div>
                </div>
              )}
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}
              {!isLoading && !error && customHistory.length > 0 && (
                <div className="h-96">
                  {renderChart()}
                </div>
              )}
            </div>
            {/* Historical Data Table */}
            {customHistory.length > 0 && (
              <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Historical Data</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                      <tr>
                        <th className="px-6 py-3">Time</th>
                        <th className="px-6 py-3">Open</th>
                        <th className="px-6 py-3">High</th>
                        <th className="px-6 py-3">Low</th>
                        <th className="px-6 py-3">Close</th>
                        <th className="px-6 py-3">Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllHistory ? customHistory : customHistory.slice(-10)).map((row, index) => (
                        <tr key={index} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                          <td className="px-6 py-4">{row.time}</td>
                          <td className="px-6 py-4">${row.open?.toFixed(2)}</td>
                          <td className="px-6 py-4">${row.high?.toFixed(2)}</td>
                          <td className="px-6 py-4">${row.low?.toFixed(2)}</td>
                          <td className="px-6 py-4">${row.close?.toFixed(2)}</td>
                          <td className="px-6 py-4">{row.volume?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {customHistory.length > 10 && (
                  <button 
                    className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                    onClick={() => setShowAllHistory(!showAllHistory)}
                  >
                    {showAllHistory ? 'Show Less' : `Show All (${customHistory.length} rows)`}
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {activeTab === 'ai' && (
          <AIInsights
            ticker={selectedTicker}
            currentPrice={prices[selectedTicker] || 0}
            historicalData={customHistory}
            predictions={predictions}
          />
        )}
        {activeTab === 'predictions' && (
          <PredictionChart
            ticker={selectedTicker}
            historicalData={customHistory}
            predictions={predictions}
            onRequestPrediction={fetchPredictions}
          />
        )}
        {activeTab === 'indicators' && (
          <TechnicalIndicators
            data={customHistory}
            ticker={selectedTicker}
          />
        )}
        {activeTab === 'risk' && (
          <RiskAnalysis
            ticker={selectedTicker}
            currentPrice={prices[selectedTicker] || 0}
            historicalData={customHistory}
          />
        )}
        {activeTab === 'news' && (
          <NewsPanel
            ticker={selectedTicker}
            fetchWithAuth={fetchWithAuth}
            serverUrl={currentServerUrl}
          />
        )}
        {activeTab === 'recommendations' && (
          <Recommendations
            currentTicker={selectedTicker}
            fetchWithAuth={fetchWithAuth}
            serverUrl={currentServerUrl}
          />
        )}
      </div>
    </div>
  );
}

export default App;