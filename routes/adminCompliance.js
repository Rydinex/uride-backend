const express = require('express');
const { requireAdminAuth } = require('../middleware/adminAuth');
const {
  listTripLogs,
  listDriverLogs,
  listSafetyLogs,
  listIncidentReports,
  updateIncidentReport,
  getDocumentExpirationAlerts,
  getComplianceSummary,
  getSafetyReport,
  getAirportOperationsReport,
  getChicagoTnpComplianceReport,
  exportComplianceData,
} = require('../controllers/adminComplianceController');

const router = express.Router();

router.use(requireAdminAuth);

router.get('/logs/trips', listTripLogs);
router.get('/logs/drivers', listDriverLogs);
router.get('/logs/safety', listSafetyLogs);
router.get('/incidents', listIncidentReports);
router.patch('/incidents/:incidentId', updateIncidentReport);
router.get('/documents/expirations', getDocumentExpirationAlerts);
router.get('/reports/compliance/summary', getComplianceSummary);
router.get('/reports/safety', getSafetyReport);
router.get('/reports/airport', getAirportOperationsReport);
router.get('/reports/chicago-tnp', getChicagoTnpComplianceReport);
router.get('/export', exportComplianceData);

module.exports = router;
