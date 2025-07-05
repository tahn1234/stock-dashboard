# Get Your Railway URL

## Step 1: Find Your Railway URL

1. Go to [Railway.app](https://railway.app)
2. Sign in to your account
3. Click on your project
4. Look for the "Deployments" tab
5. Find your latest deployment
6. Copy the URL (it should look like `https://your-app-name.railway.app`)

## Step 2: Update Your Configuration

### Option A: Update Environment Variable (Recommended)

1. In your Railway project settings, add this environment variable:
   ```
   VITE_API_URL=https://your-actual-railway-url.railway.app
   ```

2. In your Vercel project settings, add this environment variable:
   ```
   VITE_API_URL=https://your-actual-railway-url.railway.app
   ```

### Option B: Update Code Directly

Replace `'https://your-railway-app-url.railway.app'` in `src/App.tsx` with your actual Railway URL.

## Step 3: Deploy the Changes

1. Commit and push your changes:
   ```bash
   git add .
   git commit -m "Update server URL configuration"
   git push origin main
   ```

2. Railway and Vercel will automatically redeploy with the new configuration.

## Step 4: Test

Your app should now connect to your Railway backend without 502 errors! 