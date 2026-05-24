import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { httpError } from "../utils/httpError.js";

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) throw httpError(401, "Login required");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user || user.status !== "active") throw httpError(401, "Invalid user");

    req.user = user;
    next();
  } catch (error) {
    next(error.status ? error : httpError(401, "Invalid token"));
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(httpError(403, "You do not have access to this action"));
    }

    next();
  };
}

export function requirePermission(permission) {
  return (req, _res, next) => {
    if (req.user.role === "super_admin") return next();

    if (req.user.role === "admin" && req.user.permissions.includes(permission)) {
      return next();
    }

    return next(httpError(403, `Missing permission: ${permission}`));
  };
}
