# Stock Dashboard Deployment Guide

This guide will help you deploy your AI Stock Dashboard to production.

## Prerequisites

1. **API Keys**: You'll need the following API keys:
   - [Finnhub API Key](https://finnhub.io/register) (for real-time stock data)
   - [NewsAPI Key](https://newsapi.org/register) (for news data)
   - [OpenAI API Key](https://platform.openai.com/api-keys) (for AI features)

2. **GitHub Account**: For version control and deployment

## Deployment Options

### Option 1: Vercel (Frontend) + Railway (Backend) - Recommended

#### Step 1: Deploy Backend to Railway

1. **Create Railway Account**:
   - Go to [Railway.app](https://railway.app)
   - Sign up with your GitHub account

2. **Deploy Backend**:
   - Click "New Project" → "Deploy from GitHub repo"
   - Connect your GitHub repository
   - Select the repository
   - Railway will automatically detect it's a Python project

3. **Configure Environment Variables**:
   - Go to your project settings
   - Add the following environment variables:
     ```
     FINNHUB_API_KEY=your_finnhub_api_key
     NEWSAPI_KEY=your_newsapi_key
     OPENAI_API_KEY=your_openai_api_key
     JWT_SECRET_KEY=your_secure_jwt_secret
     PORT=5002
     FLASK_ENV=production
     DEBUG=False
     ```

4. **Deploy**:
   - Railway will automatically build and deploy your backend
   - Note the generated URL (e.g., `https://your-app.railway.app`)

#### Step 2: Deploy Frontend to Vercel

1. **Create Vercel Account**:
   - Go to [Vercel.com](https://vercel.com)
   - Sign up with your GitHub account

2. **Deploy Frontend**:
   - Click "New Project" → "Import Git Repository"
   - Select your repository
   - Vercel will automatically detect it's a React project

3. **Configure Environment Variables**:
   - Add environment variable:
     ```
     VITE_API_URL=https://your-backend-url.railway.app
     ```
   - Replace `your-backend-url.railway.app` with your actual Railway URL

4. **Deploy**:
   - Vercel will build and deploy your frontend
   - Your app will be live at `https://your-app.vercel.app`

### Option 2: Netlify (Frontend) + Render (Backend)

#### Backend on Render:

1. **Create Render Account**:
   - Go to [Render.com](https://render.com)
   - Sign up with your GitHub account

2. **Deploy Backend**:
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: `stock-dashboard-backend`
     - **Environment**: `Python 3`
     - **Build Command**: `pip install -r backend/requirements.txt`
     - **Start Command**: `cd backend && python server.py`

3. **Add Environment Variables** (same as Railway)

#### Frontend on Netlify:

1. **Create Netlify Account**:
   - Go to [Netlify.com](https://netlify.com)
   - Sign up with your GitHub account

2. **Deploy Frontend**:
   - Click "New site from Git"
   - Select your repository
   - Configure build settings:
     - **Build command**: `npm run build`
     - **Publish directory**: `dist`

3. **Add Environment Variable**:
   ```
   VITE_API_URL=https://your-backend-url.onrender.com
   ```

### Option 3: Heroku (Full Stack)

1. **Create Heroku Account**:
   - Go to [Heroku.com](https://heroku.com)
   - Sign up for an account

2. **Install Heroku CLI**:
   ```bash
   # macOS
   brew tap heroku/brew && brew install heroku
   
   # Windows
   # Download from https://devcenter.heroku.com/articles/heroku-cli
   ```

3. **Deploy**:
   ```bash
   # Login to Heroku
   heroku login
   
   # Create app
   heroku create your-stock-dashboard
   
   # Add buildpacks
   heroku buildpacks:add heroku/nodejs
   heroku buildpacks:add heroku/python
   
   # Set environment variables
   heroku config:set FINNHUB_API_KEY=your_finnhub_api_key
   heroku config:set NEWSAPI_KEY=your_newsapi_key
   heroku config:set OPENAI_API_KEY=your_openai_api_key
   heroku config:set JWT_SECRET_KEY=your_jwt_secret
   
   # Deploy
   git push heroku main
   ```

## Environment Variables

### Backend Environment Variables:
- `FINNHUB_API_KEY`: Your Finnhub API key
- `NEWSAPI_KEY`: Your NewsAPI key  
- `OPENAI_API_KEY`: Your OpenAI API key
- `JWT_SECRET_KEY`: A secure random string for JWT tokens
- `PORT`: Port number (usually set by hosting platform)
- `FLASK_ENV`: Set to `production`
- `DEBUG`: Set to `False` in production

### Frontend Environment Variables:
- `VITE_API_URL`: Your backend API URL

## Post-Deployment

1. **Test Your Application**:
   - Verify all features work correctly
   - Check WebSocket connections
   - Test API endpoints

2. **Monitor Performance**:
   - Set up logging and monitoring
   - Monitor API usage and costs
   - Set up alerts for errors

3. **Security Considerations**:
   - Ensure HTTPS is enabled
   - Set up proper CORS configuration
   - Monitor for security vulnerabilities

## Troubleshooting

### Common Issues:

1. **CORS Errors**:
   - Ensure your backend CORS configuration includes your frontend domain
   - Check that environment variables are set correctly

2. **WebSocket Connection Issues**:
   - Verify WebSocket URL is correct
   - Check if your hosting platform supports WebSockets

3. **API Key Issues**:
   - Verify all API keys are valid and have sufficient credits
   - Check API rate limits

4. **Build Failures**:
   - Check that all dependencies are in requirements.txt
   - Verify Node.js and Python versions are compatible

## Cost Considerations

- **Vercel**: Free tier available, paid plans start at $20/month
- **Railway**: Free tier available, paid plans start at $5/month
- **Netlify**: Free tier available, paid plans start at $19/month
- **Render**: Free tier available, paid plans start at $7/month
- **Heroku**: No free tier, starts at $7/month

## Support

If you encounter issues during deployment:
1. Check the hosting platform's documentation
2. Review error logs in your hosting platform's dashboard
3. Ensure all environment variables are set correctly
4. Verify your API keys are valid and have sufficient credits 

## Quick Deployment

To quickly deploy your application, you can use the deployment script:
```bash
./deploy.sh
```

This script will handle the deployment process for you.

## Key Features Ready for Production

- ✅ Environment variable configuration
- ✅ CORS setup for cross-origin requests
- ✅ WebSocket support for real-time updates
- ✅ JWT authentication
- ✅ API rate limiting
- ✅ Error handling and logging

Would you like me to help you with any specific part of the deployment process, or do you have questions about any of the platforms? 