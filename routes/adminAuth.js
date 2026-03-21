const express = require('express');
const { loginAdmin, getAdminProfile } = require('../controllers/adminAuthController');
const { requireAdminAuth } = require('../middleware/adminAuth');

const router = express.Router();

router.post('/login', loginAdmin);
router.get('/me', requireAdminAuth, getAdminProfile);

module.exports = router;
