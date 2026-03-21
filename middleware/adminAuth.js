const jwt = require('jsonwebtoken');

function requireAdminAuth(req, res, next) {
  try {
    const authorizationHeader = req.headers.authorization || '';
    const [scheme, token] = authorizationHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Admin authorization token is required.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin privileges are required.' });
    }

    req.admin = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired admin token.' });
  }
}

module.exports = {
  requireAdminAuth,
};
