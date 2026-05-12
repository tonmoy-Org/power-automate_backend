const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { getAllUsers, getUserById, createUser, updateUser, deleteUser, toggleUserStatus } = require('../controllers/userController');

const validateUser = [
    body('name').trim().notEmpty().isLength({ min: 2, max: 50 }),
    body('email').trim().notEmpty().isEmail().normalizeEmail(),
    body('password').optional().isLength({ min: 6 }),
    body('role').optional().isIn(['superadmin', 'member', 'client']),
];

router.use(authMiddleware.protect);

const adminAccess = roleMiddleware.restrictTo('superadmin');

router.get('/', adminAccess, getAllUsers);
router.get('/:id', adminAccess, getUserById);
router.post('/register', adminAccess, validateUser, createUser);
router.put('/:id', adminAccess, validateUser, updateUser);
router.delete('/:id', adminAccess, deleteUser);
router.patch('/:id/toggle-status', adminAccess, toggleUserStatus);

module.exports = router;
