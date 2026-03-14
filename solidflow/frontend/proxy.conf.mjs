export default {
  '/api': {
    target: 'http://localhost:3000',
    secure: false,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('error', (err, _req, res) => {
        // Backend not running — return a clean 503 instead of crashing the proxy
        if (res && !res.headersSent) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Backend unavailable', error: err.code }));
        }
      });
    },
  },
};
