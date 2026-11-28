const dns = require('node:dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch {}

const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config();

const { startScheduler } = require('./services/scheduler');
const { startTelegramPolling } = require('./services/telegram');

const authRoutes = require('./routes/auth');
const channelsRoutes = require('./routes/channels');
const rulesRoutes = require('./routes/rules');
const postsRoutes = require('./routes/posts');
const commentsRoutes = require('./routes/comments');
const settingsRoutes = require('./routes/settings');
const uploadRoutes = require('./routes/upload');
const whatsappRoutes = require('./routes/whatsapp');
const instagramLeadsRoutes = require('./routes/instagram_leads');
const telegramRoutes = require('./routes/telegram');
const callingRoutes = require('./routes/calling');
const crmRoutes = require('./routes/crm');
const brandRoutes = require('./routes/brand');
const analyticsRoutes = require('./routes/analytics');
const automationsRoutes = require('./routes/automations');
const copilotRoutes = require('./routes/copilot');
const notificationsRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  'http://localhost:5000', 
  'http://127.0.0.1:5000', 
  'http://localhost:3000', 
  'http://127.0.0.1:3000',
  'https://kaleidoscopic-granita-e8cc8a.netlify.app'
];

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin || 
      allowedOrigins.includes(origin) || 
      origin.startsWith('http://localhost:') || 
      origin.endsWith('.netlify.app') ||
      (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.split(',').includes(origin))
    ) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true
}));

// Defense-in-depth Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelsRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/instagram', instagramLeadsRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/calling', callingRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/brand', brandRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/automations', automationsRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api/notifications', notificationsRoutes);

// Global JSON & Express Error Handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload' });
  }
  console.error('[ServerError]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// Process-level crash prevention
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Process Uncaught Exception prevented:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[WARN] Process Unhandled Rejection caught:', reason);
});

// Serve uploaded media
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback for API routes that do not match: ALWAYS return JSON 404, never index.html!
app.all('/api/*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: `API endpoint not found: ${req.method} ${req.originalUrl}` 
  });
});

// Serve Vite frontend in production if built
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Start background workers
startScheduler();
startTelegramPolling().catch(console.error);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=================================================`);
  console.log(`🚀 Social Manager Server running at http://localhost:${PORT}`);
  console.log(`📡 API Endpoints available at http://localhost:${PORT}/api`);
  console.log(`=================================================\n`);
});
