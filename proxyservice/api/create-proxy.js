const axios = require('axios');
const { URL } = require('url');

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

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    const proxyUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/proxy?url=${encodeURIComponent(url)}`;
    
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
}