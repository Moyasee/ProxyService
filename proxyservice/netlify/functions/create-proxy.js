const axios = require('axios');
const { URL } = require('url');

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map();

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

// Rate limiting function
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 30;
  
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  const record = rateLimitStore.get(ip);
  
  if (now > record.resetTime) {
    // Reset the window
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
}

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get client IP for rate limiting
    const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
    
    // Check rate limit
    if (!checkRateLimit(clientIP)) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ error: 'Too many requests from this IP, please try again later.' })
      };
    }

    // Parse request body
    const { url } = JSON.parse(event.body || '{}');

    // Validate URL format
    if (!url || !isValidUrl(url)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid URL format' })
      };
    }

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
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL does not serve JSON content (application/json)' })
      };
    }

    // Check file size (2MB limit)
    if (contentLength && parseInt(contentLength) > 2 * 1024 * 1024) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'JSON file size exceeds 2MB limit' })
      };
    }

    // Generate proxy URL
    const baseUrl = `https://${event.headers.host}`;
    const proxyUrl = `${baseUrl}/.netlify/functions/proxy?url=${encodeURIComponent(url)}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        proxyUrl: proxyUrl,
        originalUrl: url
      })
    };

  } catch (error) {
    console.error('Error validating URL:', error.message);
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Unable to reach the provided URL' })
      };
    }
    
    if (error.response && error.response.status) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `URL returned status code: ${error.response.status}` })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error while validating URL' })
    };
  }
};