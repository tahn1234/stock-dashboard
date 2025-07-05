# Quick Deployment Guide

## 🚀 Fastest Way to Deploy

### Step 1: Prepare Your Repository
```bash
# Make sure all changes are committed
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### Step 2: Get API Keys
1. [Finnhub API Key](https://finnhub.io/register) - Free tier available
2. [NewsAPI Key](https://newsapi.org/register) - Free tier available  
3. [OpenAI API Key](https://platform.openai.com/api-keys) - Pay per use

### Step 3: Deploy Backend (Railway - Recommended)
1. Go to [Railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Add environment variables:
   ```
   FINNHUB_API_KEY=your_finnhub_key
   NEWSAPI_KEY=your_newsapi_key
   OPENAI_API_KEY=your_openai_key
   JWT_SECRET_KEY=your_secure_random_string
   PORT=5002
   FLASK_ENV=production
   DEBUG=False
   ```
6. Note your Railway URL (e.g., `https://your-app.railway.app`)

### Step 4: Deploy Frontend (Vercel)
1. Go to [Vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "New Project" → "Import Git Repository"
4. Select your repository
5. Add environment variable:
   ```
   VITE_API_URL=https://your-railway-url.railway.app
   ```
6. Deploy!

## 🎯 Your app will be live at your Vercel URL!

## ⚠️ Important Notes
- Make sure your API keys have sufficient credits
- The free tiers have rate limits
- Monitor your usage to avoid unexpected charges

## 🆘 Need Help?
- Check the full `DEPLOYMENT.md` for detailed instructions
- Review error logs in your hosting platform's dashboard
- Ensure all environment variables are set correctly 