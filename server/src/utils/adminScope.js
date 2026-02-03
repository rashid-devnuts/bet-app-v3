/**
 * Admin scope helper: restrict data to "users created by this admin" for non-super-admins.
 * Super admins see all data.
 */
import User from "../models/User.js";

const SUPER_ADMIN_EMAIL = "admin@gmail.com";

export function isSuperAdminUser(user) {
  if (!user) return false;
  return user.isSuperAdmin === true || user.email === SUPER_ADMIN_EMAIL;
}

/**
 * Returns allowed user IDs for the requester when listing bets/finance.
 * - Super admin: null (no filter = all users).
 * - Other admin: array of user IDs where createdBy === requester._id.
 * - Non-admin: null (caller should not use for admin endpoints).
 */
export async function getAdminScopeUserIds(requester) {
  if (!requester || requester.role !== "admin") return null;
  if (isSuperAdminUser(requester)) return null;
  const users = await User.find({ createdBy: requester._id }).select("_id").lean();
  return users.map((u) => u._id);
}
