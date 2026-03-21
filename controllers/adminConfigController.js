const { getEffectiveSystemConfig, updatePricingConfig, updateSurgeConfig } = require('../services/configService');

async function getPricingConfig(req, res) {
  try {
    const config = await getEffectiveSystemConfig();
    return res.status(200).json(config.pricing);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch pricing config.' });
  }
}

async function updatePricing(req, res) {
  try {
    const updatedConfig = await updatePricingConfig(req.body, req.admin?.email || 'admin');
    return res.status(200).json({
      message: 'Pricing configuration updated successfully.',
      pricing: updatedConfig.pricing,
      updatedAt: updatedConfig.updatedAt,
      updatedBy: updatedConfig.updatedBy,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update pricing config.' });
  }
}

async function getSurgeConfig(req, res) {
  try {
    const config = await getEffectiveSystemConfig();
    return res.status(200).json(config.surge);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch surge config.' });
  }
}

async function updateSurge(req, res) {
  try {
    const updatedConfig = await updateSurgeConfig(req.body, req.admin?.email || 'admin');
    return res.status(200).json({
      message: 'Surge configuration updated successfully.',
      surge: updatedConfig.surge,
      updatedAt: updatedConfig.updatedAt,
      updatedBy: updatedConfig.updatedBy,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update surge config.' });
  }
}

module.exports = {
  getPricingConfig,
  updatePricing,
  getSurgeConfig,
  updateSurge,
};
