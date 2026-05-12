const express = require('express');
const router = express.Router();
const {
    getPasswordFormatters,
    getPasswordFormatterById,
    createPasswordFormatter,
    updatePasswordFormatter,
    deletePasswordFormatter,
    getPasswordFormattersList
} = require('../controllers/passwordFormatterController');
const { protect } = require('../middleware/authMiddleware');

// Routes
router.route('/')
    .get(protect, getPasswordFormatters)
    .post(protect, createPasswordFormatter);

router.route('/list')
    .get(protect, getPasswordFormattersList);

router.route('/:id')
    .get(protect, getPasswordFormatterById)
    .put(protect, updatePasswordFormatter)
    .delete(protect, deletePasswordFormatter);

module.exports = router;