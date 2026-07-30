const http = require('http');

const PORT = 3001;

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  
  const responseData = {
    status: 'success',
    message: 'Ashley ERP Test Server is Active',
    port: PORT,
    timestamp: new Date().toISOString(),
    endpoints: [
      { path: '/', method: 'GET', description: 'Server status' },
      { path: '/api/test', method: 'GET', description: 'Test data endpoint' }
    ]
  };

  if (req.url === '/api/test') {
    responseData.data = {
      test: 'This is mock data from your local test server',
      items: [
        { id: 1, name: 'Sample Item A', status: 'Staged' },
        { id: 2, name: 'Sample Item B', status: 'Transferred' }
      ]
    };
  }

  res.end(JSON.stringify(responseData, null, 2));
});

server.listen(PORT, 'localhost', () => {
  console.log(`
  🚀 Test Server is running smoothly!
  🔗 URL: http://localhost:${PORT}
  
  You can use this server to test your local environment or mock API calls.
  To stop the server, press Ctrl+C in this terminal.
  `);
});
