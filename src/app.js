const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const phoneNumberRoutes = require('./routes/phoneNumberRoutes');
const indianNumberRoutes = require('./routes/indianNumberRoutes');
const passwordFormatterRoutes = require('./routes/passwordFormatterRoutes');
const phoneCredentialRoutes = require('./routes/phoneCredentialRoutes');
const machineRoutes = require('./routes/machineRoutes');
const setupSwagger = require('./config/swagger');
const { startPhoneNumberMonitor } = require('./services/phoneNumberMonitor');


startPhoneNumberMonitor(10, 60)

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'https://power-automate-fontend.vercel.app',
  'https://power-automate-pa-1.vercel.app',
  "http://ec2-100-54-233-67.compute-1.amazonaws.com",
  "http://23.95.140.149",
  "http://23.95.140.149:5173",
  "http://23.95.140.149:3000"
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
app.use('/api/machines', machineRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

module.exports = app;