const express = require('express');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Rate limiting: 30 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', limiter);

// Utility function to validate URL
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Utility function to check if content is JSON
function isJsonContent(contentType) {
  return contentType && contentType.toLowerCase().includes('application/json');
}

// API endpoint to validate and create proxy link
app.post('/api/create-proxy', async (req, res) => {
  const { url } = req.body;

  // Validate URL format
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({
      error: 'Invalid URL format'
    });
  }

  try {
    // Check if the URL returns JSON content
    const response = await axios.head(url, {
      timeout: 10000,
      maxContentLength: 2 * 1024 * 1024, // 2MB limit
      validateStatus: function (status) {
        return status >= 200 && status < 300;
      }
    });

    const contentType = response.headers['content-type'];
    const contentLength = response.headers['content-length'];

    // Check content type
    if (!isJsonContent(contentType)) {
      return res.status(400).json({
        error: 'URL does not serve JSON content (application/json)'
      });
    }

    // Check file size (2MB limit)
    if (contentLength && parseInt(contentLength) > 2 * 1024 * 1024) {
      return res.status(400).json({
        error: 'JSON file size exceeds 2MB limit'
      });
    }

    // Generate proxy URL
    const proxyUrl = `${req.protocol}://${req.get('host')}/proxy?url=${encodeURIComponent(url)}`;

    res.json({
      success: true,
      proxyUrl: proxyUrl,
      originalUrl: url
    });

  } catch (error) {
    console.error('Error validating URL:', error.message);
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(400).json({
        error: 'Unable to reach the provided URL'
      });
    }
    
    if (error.response && error.response.status) {
      return res.status(400).json({
        error: `URL returned status code: ${error.response.status}`
      });
    }

    res.status(500).json({
      error: 'Internal server error while validating URL'
    });
  }
});

// Proxy endpoint to serve JSON content
app.get('/proxy', async (req, res) => {
  const { url } = req.query;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({
      error: 'Invalid or missing URL parameter'
    });
  }

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      maxContentLength: 2 * 1024 * 1024, // 2MB limit
      responseType: 'json',
      validateStatus: function (status) {
        return status >= 200 && status < 300;
      }
    });

    // Set appropriate headers
    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });

    // Return the JSON content
    res.json(response.data);

  } catch (error) {
    console.error('Error proxying URL:', error.message);
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(400).json({
        error: 'Unable to reach the provided URL'
      });
    }
    
    if (error.response && error.response.status) {
      return res.status(error.response.status).json({
        error: `Source URL returned status code: ${error.response.status}`
      });
    }

    res.status(500).json({
      error: 'Internal server error while proxying URL'
    });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`JSON Proxy Service running on port ${PORT}`);
  console.log(`Access the service at: http://localhost:${PORT}`);
});