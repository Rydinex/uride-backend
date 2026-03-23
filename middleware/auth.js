const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  try {
    const authorizationHeader = req.headers.authorization || '';
    const [scheme, token] = authorizationHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Authorization token is required.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.sub) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    req.user = {
      id: decoded.sub,
      role: decoded.role || null,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = verifyToken;