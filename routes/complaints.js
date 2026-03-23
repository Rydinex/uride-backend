const express = require('express');
const {
  createComplaint,
  listComplaints,
  updateComplaintStatus,
} = require('../controllers/complaintController');

const requireAdminAuth = require('../middleware/adminAuth'); // FIXED

const router = express.Router();

router.post('/', createComplaint);
router.get('/', requireAdminAuth, listComplaints);
router.patch('/:complaintId/status', requireAdminAuth, updateComplaintStatus);

module.exports = router;