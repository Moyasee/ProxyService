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

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get URL from query parameters
    const url = event.queryStringParameters?.url;

    if (!url || !isValidUrl(url)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid or missing URL parameter' })
      };
    }

    // Fetch the JSON content
    const response = await axios.get(url, {
      timeout: 10000,
      maxContentLength: 2 * 1024 * 1024, // 2MB limit
      responseType: 'json',
      validateStatus: function (status) {
        return status >= 200 && status < 300;
      }
    });

    // Return the JSON content
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response.data)
    };

  } catch (error) {
    console.error('Error proxying URL:', error.message);
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Unable to reach the provided URL' })
      };
    }
    
    if (error.response && error.response.status) {
      return {
        statusCode: error.response.status,
        headers,
        body: JSON.stringify({ error: `Source URL returned status code: ${error.response.status}` })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error while proxying URL' })
    };
  }
};