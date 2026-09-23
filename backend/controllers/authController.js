const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const https = require('https');
const { User, Node } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseHelper');

/**
 * Generate JWT for a user
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

/**
 * Format user object for API responses (never include password_hash)
 */
const formatUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  node_id: user.node_id,
  node: user.node || null,
  avatar_url: user.avatar_url || null,
  created_at: user.created_at,
});

/**
 * Verify a Google id_token using Google's tokeninfo endpoint (no extra packages)
 */
const verifyGoogleToken = (idToken) => {
  return new Promise((resolve, reject) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const payload = JSON.parse(data);
          if (payload.error) return reject(new Error(payload.error_description || 'Invalid token'));
          resolve(payload);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
};

/**
 * POST /api/v1/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Email and password are required', 400);
    }

    // Find user with node info
    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
      include: [{ model: Node, as: 'node', attributes: ['id', 'name', 'type', 'location'] }],
    });

    if (!user) {
      return sendError(res, 'Invalid email or password', 401);
    }

    // OAuth-only users have no password
    if (!user.password_hash) {
      return sendError(res, 'This account uses Google Sign-In. Please use the "Continue with Google" button.', 401);
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return sendError(res, 'Invalid email or password', 401);
    }

    const token = generateToken(user);

    return sendSuccess(res, {
      token,
      user: formatUser(user),
    }, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    return sendError(res, 'Login failed', 500);
  }
};

/**
 * POST /api/v1/auth/register
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return sendError(res, 'Name, email, and password are required', 400);
    }

    if (password.length < 6) {
      return sendError(res, 'Password must be at least 6 characters', 400);
    }

    // Only Warehouse Admin and Viewer are self-assignable
    const allowedRoles = ['WAREHOUSE_ADMIN', 'VIEWER'];
    const assignedRole = role && allowedRoles.includes(role) ? role : 'VIEWER';

    const normalizedEmail = email.toLowerCase().trim();

    // Check duplicate
    const existing = await User.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      return sendError(res, 'An account with this email already exists', 409);
    }

    const password_hash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password_hash,
      role: assignedRole,
    });

    // Re-fetch with node association
    const fullUser = await User.findByPk(user.id, {
      include: [{ model: Node, as: 'node', attributes: ['id', 'name', 'type', 'location'] }],
    });

    const token = generateToken(fullUser);

    return sendSuccess(res, {
      token,
      user: formatUser(fullUser),
    }, 'Account created successfully', 201);
  } catch (error) {
    console.error('Register error:', error);
    return sendError(res, 'Registration failed', 500);
  }
};

/**
 * POST /api/v1/auth/google
 * Verifies a Google id_token, then finds-or-creates the user.
 */
const googleAuth = async (req, res) => {
  try {
    const { id_token } = req.body;

    if (!id_token) {
      return sendError(res, 'Google id_token is required', 400);
    }

    let payload;
    try {
      payload = await verifyGoogleToken(id_token);
    } catch {
      return sendError(res, 'Invalid Google token', 401);
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return sendError(res, 'Google account has no email', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find by google_id first, then fall back to email
    let user = await User.findOne({
      where: { google_id: googleId },
      include: [{ model: Node, as: 'node', attributes: ['id', 'name', 'type', 'location'] }],
    });

    if (!user) {
      user = await User.findOne({
        where: { email: normalizedEmail },
        include: [{ model: Node, as: 'node', attributes: ['id', 'name', 'type', 'location'] }],
      });

      if (user) {
        // Link existing email account to Google
        await user.update({ google_id: googleId, avatar_url: picture || null });
        await user.reload({
          include: [{ model: Node, as: 'node', attributes: ['id', 'name', 'type', 'location'] }],
        });
      } else {
        // Create new user
        const created = await User.create({
          name: name || normalizedEmail.split('@')[0],
          email: normalizedEmail,
          password_hash: null,
          google_id: googleId,
          avatar_url: picture || null,
          role: 'VIEWER',
        });
        user = await User.findByPk(created.id, {
          include: [{ model: Node, as: 'node', attributes: ['id', 'name', 'type', 'location'] }],
        });
      }
    } else {
      // Update avatar in case it changed
      await user.update({ avatar_url: picture || user.avatar_url });
      await user.reload({
        include: [{ model: Node, as: 'node', attributes: ['id', 'name', 'type', 'location'] }],
      });
    }

    const token = generateToken(user);

    return sendSuccess(res, {
      token,
      user: formatUser(user),
    }, 'Google sign-in successful');
  } catch (error) {
    console.error('Google auth error:', error);
    return sendError(res, 'Google authentication failed', 500);
  }
};

/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user
 */
const me = async (req, res) => {
  try {
    return sendSuccess(res, { user: formatUser(req.user) }, 'User retrieved');
  } catch (error) {
    console.error('Me error:', error);
    return sendError(res, 'Failed to retrieve user', 500);
  }
};

module.exports = { login, register, googleAuth, me };
