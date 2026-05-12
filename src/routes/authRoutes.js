const express = require('express');
const {
  login,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  validateResetToken
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (no authentication required)
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/validate-reset-token/:token', validateResetToken); 

// Protected routes (require authentication)
const protectedRouter = express.Router();
protectedRouter.use(protect);

protectedRouter.get('/me', getMe);
protectedRouter.put('/profile', updateProfile);
protectedRouter.put('/change-password', changePassword);


router.use(protectedRouter);

module.exports = router;