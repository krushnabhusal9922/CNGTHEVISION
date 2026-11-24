const express = require('express');
const cors = require('cors');
const path = require('path');
const { initSchema, db } = require('./db/database');
const { seedDatabase } = require('./db/seed');
const stationsRouter = require('./routes/stations');
const chatRouter = require('./routes/chat');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Serve frontend static assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/stations', stationsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/auth', authRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM stations').get();
    res.json({
      status: 'healthy',
      service: 'CNG Connect API',
      version: '1.0.0',
      database: 'SQLite (node:sqlite)',
      stationsCount: row ? row.count : 0,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      error: err.message
    });
  }
});

// Handle unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.originalUrl}' not found.`
  });
});

// Global error handler (avoids exposing internal stack traces)
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: 'An internal server error occurred. Please try again later.'
  });
});

// Seed DB if empty
try {
  initSchema();
  const countRow = db.prepare('SELECT COUNT(*) as count FROM stations').get();
  if (!countRow || countRow.count === 0) {
    console.log('[Startup] Stations table is empty. Auto-seeding initial demo records...');
    seedDatabase();
  }
} catch (err) {
  console.error('[Startup] Database initialization warning:', err.message);
}

// Start server if not imported
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 CNG Connect Server is running on http://localhost:${PORT}`);
    console.log(`📍 Web UI: http://localhost:${PORT}/`);
    console.log(`🔌 REST API: http://localhost:${PORT}/api/stations`);
    console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
    console.log(`====================================================`);
  });

  process.on('SIGINT', () => {
    console.log('\nGracefully shutting down CNG Connect server...');
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  });
}

module.exports = app;
