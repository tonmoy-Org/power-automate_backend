const express = require('express');
const cors = require('cors');
const compression = require('compression');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const phoneNumberRoutes = require('./routes/phoneNumberRoutes');
const indianNumberRoutes = require('./routes/indianNumberRoutes');
const passwordFormatterRoutes = require('./routes/passwordFormatterRoutes');
const phoneCredentialRoutes = require('./routes/phoneCredentialRoutes');
const indianPhoneCredentialRoutes = require('./routes/indianPhoneCredentialRoutes');
const machineRoutes = require('./routes/machineRoutes');
const dailyHistoryRoutes = require('./routes/dailyHistoryRoutes');
const systemConfigRoutes = require('./routes/systemConfigRoutes');
const recheckerRoutes = require('./routes/recheckerRoutes');
const localNumberRoutes = require('./routes/localNumberRoutes');
const setupSwagger = require('./config/swagger');
const { startPhoneNumberMonitor } = require('./services/phoneNumberMonitor');
const { startIndianNumberMonitor } = require('./services/IndianNumberMonitor');
const { startCleanupService } = require('./services/cleanupService');

if (!process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0') {
  startPhoneNumberMonitor(2);
  startIndianNumberMonitor(1);
  startCleanupService(15);
}

const app = express();
app.set('trust proxy', true);

app.use(compression());

const allowedOrigins = [
  'http://localhost:5173',
  'https://power-automate-fontend.vercel.app',
  'https://power-automate-pa-1.vercel.app',
  "http://ec2-100-54-233-67.compute-1.amazonaws.com",
  "http://23.95.140.149",
  "http://23.95.140.149:5173",
  "http://23.95.140.149:3000",
  "http://power.codegmail.com",
  "https://power.codegmail.com",
  "http://api.codegmail.com",
  "https://api.codegmail.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

setupSwagger(app);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/phone-numbers', phoneNumberRoutes);
app.use('/api/indian-numbers', indianNumberRoutes);
app.use('/api/password-formatters', passwordFormatterRoutes);
app.use('/api/phone-credentials', phoneCredentialRoutes);
app.use('/api/indian-phone-credentials', indianPhoneCredentialRoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/daily-history', dailyHistoryRoutes);
app.use('/api/rechecker', recheckerRoutes);
app.use('/api/local-numbers', localNumberRoutes);
const { sseHandler } = require('./services/realtimeService');

app.get('/api/realtime/stream', sseHandler);

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

app.use((err, req, res, next) => {
  console.error('[System Error Handler]', err.stack || err.message);
  res.status(200).json({
    success: false,
    message: err.message || 'Internal server notice',
    data: null
  });
});

module.exports = app;