const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const phoneNumberRoutes = require('./routes/phoneNumberRoutes');
const passwordFormatterRoutes = require('./routes/passwordFormatterRoutes');
const phoneCredential  = require('./routes/phoneCredentialRoutes');

const app = express();

app.use(
  cors({
    origin: 'https://power-automate-fontend.vercel.app/login' ,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/phone-numbers', phoneNumberRoutes);
app.use('/api/password-formatters', passwordFormatterRoutes);
app.use('/api/phone-credentials', phoneCredential);


app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ success: false, message: 'Internal server error' });
});

module.exports = app;
