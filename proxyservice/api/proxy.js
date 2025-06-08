import axios from 'axios';
import { URL } from 'url';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes cache
    res.setHeader('X-Proxy-Source', url);

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
}