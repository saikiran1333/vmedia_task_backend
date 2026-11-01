import { AppError } from '../utils/app_error.js';
import { HTTP_STATUS } from '../constants/http_status.js';
import { verifyAdminToken } from '../features/admin_auth/admin_token.js';
import { AdminAuthService } from '../features/admin_auth/services/admin_auth_service.js';

// Requires a live admin JWT. A disabled account is rejected even if the token has not expired.
export const authenticateAdmin = async (req, res, next) => {
  try {
    const header = req.get('authorization') || '';
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    if (!match) throw new AppError('Sign in required.', HTTP_STATUS.UNAUTHORIZED);

    const payload = verifyAdminToken(match[1]);
    const admin = await AdminAuthService.findById(payload.sub);
    if (!admin) throw new AppError('Sign in required.', HTTP_STATUS.UNAUTHORIZED);
    if (admin.disabled_at) throw new AppError('This admin account is disabled.', HTTP_STATUS.FORBIDDEN);
    if (admin.role !== 'admin') {
      throw new AppError('You do not have access to this resource.', HTTP_STATUS.FORBIDDEN);
    }

    req.admin = { id: admin.id, email: admin.email, name: admin.name };
    next();
  } catch (error) {
    next(error);
  }
};
