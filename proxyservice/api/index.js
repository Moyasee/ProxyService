const express = require('express');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { URL } = require('url');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
      error: 'Invalid URL format',
      message: 'Please provide a valid URL'
    });
  }

  try {
    // Check if the URL returns JSON content
    const response = await axios.head(url, {
      timeout: 5000,
      maxRedirects: 5
    });

    const contentType = response.headers['content-type'];
    
    if (!isJsonContent(contentType)) {
      return res.status(400).json({
        error: 'Invalid content type',
        message: 'The URL does not serve JSON content',
        contentType: contentType || 'unknown'
      });
    }

    // Create proxy URL
    const proxyUrl = `${req.protocol}://${req.get('host')}/proxy?url=${encodeURIComponent(url)}`;
    
    res.json({
      success: true,
      originalUrl: url,
      proxyUrl: proxyUrl,
      contentType: contentType
    });

  } catch (error) {
    console.error('Error validating URL:', error.message);
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(400).json({
        error: 'URL not accessible',
        message: 'The provided URL could not be reached'
      });
    }
    
    if (error.code === 'ETIMEDOUT') {
      return res.status(408).json({
        error: 'Request timeout',
        message: 'The URL took too long to respond'
      });
    }
    
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while validating the URL'
    });
  }
});

// Proxy endpoint
app.get('/proxy', async (req, res) => {
  const { url } = req.query;

  // Validate URL
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({
      error: 'Invalid URL',
      message: 'Please provide a valid URL parameter'
    });
  }

  try {
    // Fetch the JSON content
    const response = await axios.get(url, {
      timeout: 10000, // 10 seconds timeout
      maxContentLength: 2 * 1024 * 1024, // 2MB limit
      maxRedirects: 5,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'JSON-Proxy-Service/1.0'
      }
    });

    // Verify content type
    const contentType = response.headers['content-type'];
    if (!isJsonContent(contentType)) {
      return res.status(400).json({
        error: 'Invalid content type',
        message: 'The URL does not serve JSON content',
        contentType: contentType || 'unknown'
      });
    }

    // Set appropriate headers
    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300', // 5 minutes cache
      'X-Proxy-Source': url
    });

    // Return the JSON content
    res.json(response.data);

  } catch (error) {
    console.error('Proxy error:', error.message);
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(404).json({
        error: 'URL not found',
        message: 'The requested URL could not be reached'
      });
    }
    
    if (error.code === 'ETIMEDOUT') {
      return res.status(408).json({
        error: 'Request timeout',
        message: 'The URL took too long to respond'
      });
    }
    
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'HTTP error',
        message: `The URL returned status ${error.response.status}`,
        status: error.response.status
      });
    }
    
    res.status(500).json({
      error: 'Proxy error',
      message: 'An error occurred while fetching the content'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// For Vercel serverless functions
module.exports = (req, res) => {
  return app(req, res);
};

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`JSON Proxy Service running on port ${PORT}`);
    console.log(`Access the service at: http://localhost:${PORT}`);
  });
}