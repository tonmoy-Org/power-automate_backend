const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const phoneNumberRoutes = require('./routes/phoneNumberRoutes');
const passwordFormatterRoutes = require('./routes/passwordFormatterRoutes');
const phoneCredentialRoutes = require('./routes/phoneCredentialRoutes');
const setupSwagger = require('./config/swagger');

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'https://power-automate-fontend.vercel.app',
  'https://power-automate-pa-1.vercel.app'
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
app.use('/api/password-formatters', passwordFormatterRoutes);
app.use('/api/phone-credentials', phoneCredentialRoutes);

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