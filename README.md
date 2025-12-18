# Replicate API Proxy

Simple CORS proxy for Replicate API built with Cloudflare Workers. Works both locally and in production.

## Installation

```bash
npm install
```

## Usage

### Local Development

```bash
npm start
```

The server will run on `http://localhost:8787` (default Wrangler port)

### Deploy to Cloudflare

```bash
npm run deploy
```

## Example Usage

Instead of calling directly to:
```
https://api.replicate.com/v1/models/google/nano-banana-pro/predictions
```

Call to:
```
http://localhost:8787/v1/models/google/nano-banana-pro/predictions
```

Or in production:
```
https://your-worker.workers.dev/v1/models/google/nano-banana-pro/predictions
```

## Headers

Don't forget to include your authorization token in requests:

```javascript
fetch('http://localhost:8787/v1/models', {
  headers: {
    'Authorization': 'Token your_replicate_api_token',
    'Content-Type': 'application/json'
  }
})
```

## Features

- ✅ CORS bypass
- ✅ Supports all HTTP methods (GET, POST, PUT, DELETE, etc.)
- ✅ Automatic forwarding of all headers
- ✅ Query params forwarding
- ✅ Request logging
- ✅ No timeouts (handles long-running requests)
- ✅ Same code for local and production
