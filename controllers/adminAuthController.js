const jwt = require('jsonwebtoken');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@rydinex.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_JWT_EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || '12h';

function createAdminToken(email) {
  return jwt.sign(
    {
      sub: 'admin',
      email,
      role: 'admin',
    },
    process.env.JWT_SECRET,
    { expiresIn: ADMIN_JWT_EXPIRES_IN }
  );
}

async function loginAdmin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required.' });
    }

    if (String(email).toLowerCase() !== String(ADMIN_EMAIL).toLowerCase() || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ message: 'Invalid admin credentials.' });
    }

    const token = createAdminToken(email);

    return res.status(200).json({
      message: 'Admin authenticated successfully.',
      token,
      admin: {
        email: String(email).toLowerCase(),
        role: 'admin',
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to authenticate admin.' });
  }
}

async function getAdminProfile(req, res) {
  try {
    return res.status(200).json({
      email: req.admin?.email || ADMIN_EMAIL,
      role: 'admin',
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load admin profile.' });
  }
}

module.exports = {
  loginAdmin,
  getAdminProfile,
};
