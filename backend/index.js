require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Route modules
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const clientRoutes = require('./routes/clients');
const productRoutes = require('./routes/products');
const invoiceRoutes = require('./routes/invoices');
const paymentRoutes = require('./routes/payments');
const projectRoutes = require('./routes/projects');
const vendorRoutes = require('./routes/vendors');
const expenseRoutes = require('./routes/expenses');
const settingRoutes = require('./routes/settings');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');
const hsnRoutes = require('./routes/hsn');
const hsnMasterRoutes = require('./routes/hsnMaster');
const busyRoutes = require('./routes/busy');
const gstRoutes = require('./routes/gst');

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// ─── Security Middleware ─────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS — whitelist allowed origins
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (!isProduction && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Global rate limiter — 200 requests per minute per IP
if (isProduction) {
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use(globalLimiter);
}

// ─── Body Parsing ────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));

// NoSQL injection prevention (Express 5 compatible)
app.use((req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$')) { delete obj[key]; continue; }
      if (typeof obj[key] === 'object') sanitize(obj[key]);
    }
    return obj;
  };
  if (req.body) sanitize(req.body);
  next();
});

// ─── Compression ─────────────────────────────────────────────
app.use(compression());

// ─── Request Logging ─────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLine = `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`;
    if (isProduction) {
      logger.info(logLine);
    } else {
      logger.debug(logLine);
    }
  });
  next();
});

// ─── Health Check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()) });
});

// ─── Mount Routes ────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/hsn', hsnRoutes);
app.use('/api/hsn-master', hsnMasterRoutes);
app.use('/api/busy', busyRoutes);
app.use('/api/gst', gstRoutes);

// Indian States for Place of Supply
app.get('/api/states', (req, res) => {
  res.json([
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
  ]);
});

// ─── Static file serving for uploads ─────────────────────────
app.use('/uploads', express.static('uploads'));

// ─── 404 Handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ────────────────────────────────────
app.use(errorHandler);

// ─── Server Startup ──────────────────────────────────────────
async function start() {
  await connectDB();
  const server = app.listen(PORT, () => {
    logger.info(`BizB API server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });

  // Graceful shutdown
  function shutdown(signal) {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      const mongoose = require('mongoose');
      mongoose.connection.close(false).then(() => {
        logger.info('MongoDB connection closed.');
        process.exit(0);
      });
    });
    // Force shutdown after 10s
    setTimeout(() => process.exit(1), 10000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err);
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
  });
}

start();
