const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const nodemailer = require('nodemailer');

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD
  }
});

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// Helper function to format user response consistently
const formatUserResponse = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    isActive: user.isActive,
    devices: user.devices || [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    __v: user.__v
  };
};

// Generate reset password token
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Send reset password email
const sendResetPasswordEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const resetExpiry = process.env.PASSWORD_RESET_EXPIRY || 5;

  const mailOptions = {
    from: 'Finance <no-reply@finance.com>',
    to: email,
    subject: 'Reset Your Password',
    html: `<!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.5; color:#333;">
          <div>
            <p>A password reset was requested for your Finance Management System account.</p>
            
            <p>If this was you, click the link below to reset your password:</p>
            
            <p style="margin:14px 0;">
              <a href="${resetUrl}"
                style="display:inline-block;background:#0d6efd;color:#fff;padding:8px 15px;text-decoration:none;border-radius:6px;">
                Reset Password
              </a>
            </p>
            
            <p>This link will expire in <strong>${resetExpiry} minute</strong>.</p>
            
            <p>If you did not request this, please ignore this message and no changes will be made.</p>
          </div>
        </body>
      </html>`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Reset password email sent to:', email);
  } catch (error) {
    console.error('Error sending reset email:', error);
    throw new Error('Failed to send reset email');
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }
    
    // Find user and explicitly include password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Debug: Check if password exists
    if (!user.password) {
      console.error('User found but password field is missing:', email);
      return res.status(500).json({ 
        success: false, 
        message: 'Authentication error' 
      });
    }

    // Compare passwords using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: 'User account is inactive' 
      });
    }

    // ---- DEVICE SAVE LOGIC START ----
    const deviceInfo = req.body.device;

    if (deviceInfo && deviceInfo.deviceId) {
      const existingDevice = user.devices.find(d => d.deviceId === deviceInfo.deviceId);

      if (!existingDevice) {
        // New device detected
        if (user.devices.length >= 5) {
          user.devices.shift(); // remove oldest
        }
        user.devices.push(deviceInfo);
        await user.save();
      }
    }
    // ---- DEVICE SAVE LOGIC END ----

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: formatUserResponse(user),
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      user: formatUserResponse(user),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if email is being changed and if it already exists
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
      user.email = email;
    }

    user.name = name || user.name;

    await user.save();

    res.status(200).json({
      success: true,
      user: formatUserResponse(user),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Forgot password - send reset email
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email });
    
    if (!user) {
      // For security reasons, don't reveal if user exists or not
      return res.status(200).json({
        success: true,
        message: 'If a user with that email exists, a password reset link has been sent'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive. Please contact administrator'
      });
    }

    // Generate reset token
    const resetToken = generateResetToken();

    // Set reset token and expiry (5 minutes from now)
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 5 * 60 * 1000; // 5 minutes

    await user.save();

    // Send email
    await sendResetPasswordEmail(user.email, resetToken);

    res.status(200).json({
      success: true,
      message: 'Password reset email sent successfully'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

const validateResetToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Reset token is required'
      });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Reset token is invalid or has expired',
        expired: true
      });
    }

    res.status(200).json({
      success: true,
      message: 'Reset token is valid',
      email: user.email
    });

  } catch (error) {
    console.error('Validate token error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Reset password with token
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }
    }).select('+password'); // Include password field for comparison

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Check if new password is different from current password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // Clear reset token fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    // Optional: Invalidate all devices on password reset for security
    // user.devices = [];

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current password and new password are required' 
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Debug: Check if password exists
    if (!user.password) {
      console.error('User found but password field is missing for user ID:', req.user.id);
      return res.status(500).json({ 
        success: false, 
        message: 'Authentication error' 
      });
    }

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    // Check if new password is different from current password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

module.exports = {
  login,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword,
  changePassword,
  validateResetToken
};