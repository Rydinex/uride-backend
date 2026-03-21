const Rider = require('../models/Rider');
const PaymentLog = require('../models/PaymentLog');

async function listRiders(req, res) {
  try {
    const { status } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    const riders = await Rider.find(query)
      .select('name phone email status stripeCustomerId stripeConnectAccountId paymentMethods createdAt')
      .sort({ createdAt: -1 });

    return res.status(200).json(riders);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch riders.' });
  }
}

async function listPaymentLogs(req, res) {
  try {
    const { riderId, limit = 50 } = req.query;
    const query = {};

    if (riderId) {
      query.rider = riderId;
    }

    const parsedLimit = Math.min(Number(limit) || 50, 200);

    const logs = await PaymentLog.find(query)
      .populate('rider', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(parsedLimit);

    return res.status(200).json(logs);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch payment logs.' });
  }
}

module.exports = {
  listRiders,
  listPaymentLogs,
};
