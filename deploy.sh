#!/bin/bash

echo "🚀 Stock Dashboard Deployment Script"
echo "=================================="

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git repository not found. Please initialize git first:"
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m 'Initial commit'"
    exit 1
fi

# Check if remote repository is set
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "❌ No remote repository found. Please add your GitHub repository:"
    echo "   git remote add origin https://github.com/yourusername/your-repo-name.git"
    echo "   git push -u origin main"
    exit 1
fi

echo "✅ Git repository is properly configured"

# Check if all files are committed
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  You have uncommitted changes. Please commit them first:"
    echo "   git add ."
    echo "   git commit -m 'Prepare for deployment'"
    echo "   git push"
    exit 1
fi

echo "✅ All changes are committed"

# Build the frontend
echo "📦 Building frontend..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed"
    exit 1
fi

echo "✅ Frontend built successfully"

# Check if backend requirements are up to date
echo "🔍 Checking backend requirements..."
if [ ! -f "backend/requirements.txt" ]; then
    echo "❌ backend/requirements.txt not found"
    exit 1
fi

echo "✅ Backend requirements found"

echo ""
echo "🎉 Your project is ready for deployment!"
echo ""
echo "Next steps:"
echo "1. Push your code to GitHub:"
echo "   git push origin main"
echo ""
echo "2. Choose your deployment platform:"
echo "   - Vercel + Railway (Recommended)"
echo "   - Netlify + Render"
echo "   - Heroku"
echo ""
echo "3. Follow the instructions in DEPLOYMENT.md"
echo ""
echo "4. Don't forget to set up your API keys:"
echo "   - FINNHUB_API_KEY"
echo "   - NEWSAPI_KEY"
echo "   - OPENAI_API_KEY"
echo "   - JWT_SECRET_KEY"
echo ""
echo "Good luck with your deployment! 🚀" 