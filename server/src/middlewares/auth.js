import { verifyToken } from "../utils/jwt.js";
import User from "../models/User.js";

// Middleware to verify JWT token from cookies or Authorization header
export const authenticateToken = async (req, res, next) => {
  try {
    // First try to get token from cookies
    let token = req.cookies.accessToken;
    
    // If no cookie token, try Authorization header
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); // Remove 'Bearer ' prefix
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const decoded = verifyToken(token);
    console.log(`[AuthMiddleware] Token decoded for user:`, decoded.userId);
    
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      console.log(`[AuthMiddleware] User not found:`, decoded.userId);
      return res.status(401).json({
        success: false,
        message: "Invalid token or user not found.",
      });
    }

    console.log(`[AuthMiddleware] User found:`, user.email, `Role:`, user.role, `Active:`, user.isActive);

    // Inactive is for admin display only; do not block login. Only explicit block/delete prevents access.

    console.log(`[AuthMiddleware] Authentication successful`);
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid token.",
      error: error.message,
    });
  }
};

// Middleware to check if user is admin
export const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Access denied. Admin role required.",
    });
  }
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;

    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId).select("-password");

      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};
