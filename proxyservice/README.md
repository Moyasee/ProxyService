# JSON Proxy Service

A web service that accepts a URL to a JSON file, validates it, and returns a proxy link to access the same JSON content through the proxy server.

## Features

- **URL Validation**: Ensures the provided URL is valid and accessible
- **Content Type Checking**: Verifies that the URL serves JSON content (application/json)
- **File Size Limit**: Maximum 2MB JSON file size
- **Rate Limiting**: 30 requests per minute per IP address
- **Clean Web Interface**: Modern UI built with Tailwind CSS
- **CORS Support**: Cross-origin requests enabled
- **Error Handling**: Comprehensive error messages and validation

## Installation

1. **Clone or download the project**
   ```bash
   cd proxyservice
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

4. **Access the service**
   Open your browser and go to: `http://localhost:3000`

## Usage

### Web Interface

1. Open the web interface at `http://localhost:3000`
2. Enter a URL that serves JSON content in the input field
3. Click "Get Proxy Link"
4. Copy the generated proxy URL or test it directly

### API Endpoints

#### Create Proxy Link
```http
POST /api/create-proxy
Content-Type: application/json

{
  "url": "https://example.com/data.json"
}
```

**Response (Success):**
```json
{
  "success": true,
  "proxyUrl": "http://localhost:3000/proxy?url=https%3A%2F%2Fexample.com%2Fdata.json",
  "originalUrl": "https://example.com/data.json"
}
```

**Response (Error):**
```json
{
  "error": "Invalid URL format"
}
```

#### Access Proxied JSON
```http
GET /proxy?url=https%3A%2F%2Fexample.com%2Fdata.json
```

Returns the JSON content from the original URL with proper headers.

#### Health Check
```http
GET /health
```

Returns server status and timestamp.

## Example Workflow

1. **Input URL**: `https://jsonplaceholder.typicode.com/posts/1`
2. **Generated Proxy URL**: `http://localhost:3000/proxy?url=https%3A%2F%2Fjsonplaceholder.typicode.com%2Fposts%2F1`
3. **Access the proxy URL** to get the same JSON content

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)

### Rate Limiting

- **Window**: 1 minute
- **Max Requests**: 30 per IP
- **Scope**: Applied to `/api/*` endpoints

### File Size Limits

- **Maximum JSON file size**: 2MB
- **Request timeout**: 10 seconds

## Error Handling

The service handles various error scenarios:

- Invalid URL format
- Unreachable URLs
- Non-JSON content types
- File size exceeding 2MB limit
- Network timeouts
- Rate limit exceeded

## Security Features

- Rate limiting to prevent abuse
- URL validation to prevent malicious requests
- Content-type verification
- File size limits
- CORS configuration
- Request timeouts

## Dependencies

- **express**: Web framework
- **express-rate-limit**: Rate limiting middleware
- **axios**: HTTP client for fetching URLs
- **cors**: Cross-origin resource sharing

## Development

### Project Structure
```
proxyservice/
├── server.js          # Main server file
├── package.json       # Dependencies and scripts
├── public/
│   └── index.html     # Web interface
└── README.md          # Documentation
```

### Running in Development
```bash
npm run dev
```

This uses nodemon for automatic server restart on file changes.

## Deployment

The service can be deployed to any Node.js hosting platform:

1. **Heroku**: Set the `PORT` environment variable
2. **Vercel**: Works with serverless functions
3. **DigitalOcean**: Deploy as a standard Node.js app
4. **AWS**: Use Elastic Beanstalk or EC2

## License

MIT License - feel free to use this project for any purpose.