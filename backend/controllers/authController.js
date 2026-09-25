const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const https = require('https');
const { User } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseHelper');

/**
 * Generate JWT for a user
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

/**
 * Format user object for API responses (never include password_hash)
 */
const formatUser = (user) => {
  const u = user.toJSON ? user.toJSON() : user;
  return {
    id: u._id?.toString() || u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    node_id: u.node_id?._id?.toString() || u.node_id?.toString() || null,
    node: u.node_id?.name ? u.node_id : null,
    avatar_url: u.avatar_url || null,
    created_at: u.created_at,
  };
};

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

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .populate('node_id', 'id name type location')
      .select('+password_hash');

    if (!user) {
      return sendError(res, 'Invalid email or password', 401);
    }

    if (!user.password_hash) {
      return sendError(res, 'This account uses Google Sign-In. Please use the "Continue with Google" button.', 401);
    }

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

    const allowedRoles = ['WAREHOUSE_ADMIN', 'VIEWER'];
    const assignedRole = role && allowedRoles.includes(role) ? role : 'VIEWER';

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await User.findOne({ email: normalizedEmail });
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

    const fullUser = await User.findById(user._id)
      .populate('node_id', 'id name type location');

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

    let user = await User.findOne({ google_id: googleId })
      .populate('node_id', 'id name type location');

    if (!user) {
      user = await User.findOne({ email: normalizedEmail })
        .populate('node_id', 'id name type location');

      if (user) {
        user.google_id = googleId;
        user.avatar_url = picture || null;
        await user.save();
        await user.populate('node_id', 'id name type location');
      } else {
        const created = await User.create({
          name: name || normalizedEmail.split('@')[0],
          email: normalizedEmail,
          password_hash: null,
          google_id: googleId,
          avatar_url: picture || null,
          role: 'VIEWER',
        });
        user = await User.findById(created._id)
          .populate('node_id', 'id name type location');
      }
    } else {
      user.avatar_url = picture || user.avatar_url;
      await user.save();
      await user.populate('node_id', 'id name type location');
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
