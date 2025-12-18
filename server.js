const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 1111;

// Enable CORS for all requests
app.use(cors());

// Remove timeout from incoming requests
app.use((req, res, next) => {
  req.setTimeout(0);
  res.setTimeout(0);
  next();
});

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Configure the proxy
app.use('/', createProxyMiddleware({
  target: 'https://api.replicate.com',
  changeOrigin: true,
  proxyTimeout: 0, // No timeout for the proxy
  timeout: 0, // No timeout for the connection
  pathRewrite: {
    // No need to rewrite the path, just pass it as is
  },
  onProxyReq: (proxyReq, req, res) => {
    // Remove socket timeout
    proxyReq.setTimeout(0);
    // Log for debugging
    console.log(`Proxying to: https://api.replicate.com${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // Ensure CORS headers are present
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = '*';
  },
  onError: (err, req, res) => {
    console.error('Proxy Error:', err);
    res.status(500).json({
      error: 'Proxy error',
      message: err.message
    });
  }
}));

const server = app.listen(PORT, () => {
  console.log(`🚀 Replicate Proxy Server running on http://localhost:${PORT}`);
  console.log(`📡 Forwarding requests to https://api.replicate.com`);
  console.log(`\nExample usage:`);
  console.log(`  http://localhost:${PORT}/v1/models/google/nano-banana-pro/predictions`);
  console.log(`\nDon't forget to add your Authorization header with your Replicate API token!`);
});

// Remove server timeout to allow long responses
server.setTimeout(0);
server.keepAliveTimeout = 0;
server.headersTimeout = 0;
