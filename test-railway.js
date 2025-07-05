// Test script to verify Railway backend is working
// Run this with: node test-railway.js

const https = require('https');

// Replace this with your actual Railway URL
const RAILWAY_URL = 'https://your-railway-app-url.railway.app';

console.log('Testing Railway backend connection...');
console.log(`URL: ${RAILWAY_URL}`);

// Test health endpoint
https.get(`${RAILWAY_URL}/health`, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    if (res.statusCode === 200) {
      console.log('✅ Railway backend is working!');
    } else {
      console.log('❌ Railway backend returned an error');
    }
  });
}).on('error', (err) => {
  console.log('❌ Error connecting to Railway:', err.message);
});

// Test root endpoint
https.get(`${RAILWAY_URL}/`, (res) => {
  console.log(`\nRoot endpoint status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Root response:', data.substring(0, 200) + '...');
  });
}).on('error', (err) => {
  console.log('❌ Error connecting to root endpoint:', err.message);
}); 