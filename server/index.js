const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { WebsiteCloner } = require('./cloner');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// In-memory job storage
const jobs = new Map();
const jobClients = new Map(); // jobId -> Set of WebSocket clients

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve cloned pages
app.use('/clone', express.static(path.join(__dirname, '..', 'output')));

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const jobId = url.searchParams.get('jobId');

  if (jobId) {
    // Subscribe to a specific job
    if (!jobClients.has(jobId)) {
      jobClients.set(jobId, new Set());
    }
    jobClients.get(jobId).add(ws);

    ws.on('close', () => {
      const clients = jobClients.get(jobId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          jobClients.delete(jobId);
        }
      }
    });

    // Send any buffered logs
    const job = jobs.get(jobId);
    if (job && job.logs) {
      job.logs.forEach(log => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(log));
        }
      });
    }
  }

  ws.on('error', console.error);
});

/**
 * Broadcast a log message to all clients subscribed to a job
 */
function broadcastLog(jobId, logEntry) {
  const clients = jobClients.get(jobId);
  if (clients) {
    const message = JSON.stringify(logEntry);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Buffer logs
  const job = jobs.get(jobId);
  if (job) {
    job.logs.push(logEntry);
  }
}

// API: Start a clone job
app.post('/api/clone', async (req, res) => {
  const { url, headless = true } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const jobId = uuidv4();

  // Initialize job
  jobs.set(jobId, {
    id: jobId,
    url,
    status: 'running',
    startTime: new Date().toISOString(),
    logs: [],
    result: null
  });

  // Return immediately with job ID
  res.json({ jobId, status: 'running' });

  // Start cloning in background
  const cloner = new WebsiteCloner({
    headless,
    emit: (event, data) => {
      if (event === 'log') {
        broadcastLog(jobId, data);
      }
    }
  });

  try {
    const result = await cloner.clone(url);

    const job = jobs.get(jobId);
    if (job) {
      job.status = result.success ? 'completed' : 'failed';
      job.result = result;
      job.endTime = new Date().toISOString();
    }

    // Send completion message
    broadcastLog(jobId, {
      type: 'complete',
      message: result.success ? 'Clone completed successfully!' : `Clone failed: ${result.error}`,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = err.message;
      job.endTime = new Date().toISOString();
    }

    broadcastLog(jobId, {
      type: 'error',
      message: `Fatal error: ${err.message}`,
      timestamp: new Date().toISOString()
    });
  }
});

// API: Get job status
app.get('/api/jobs/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(job);
});

// API: List all jobs
app.get('/api/jobs', (req, res) => {
  const jobList = Array.from(jobs.values()).map(job => ({
    id: job.id,
    url: job.url,
    status: job.status,
    startTime: job.startTime,
    endTime: job.endTime
  }));

  res.json(jobList);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🍬  WEBSITE CLONER - Ultra-Futuristic Edition  🍬           ║
║                                                               ║
║   Server running at: http://localhost:${PORT}                   ║
║                                                               ║
║   Ready to clone the web with style!                          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, server };
