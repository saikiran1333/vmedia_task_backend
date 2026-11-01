import { Router } from 'express';
import { AdminAuthController } from '../controllers/admin_auth_controller.js';
import { authenticateAdmin } from '../../../middleware/authenticate_admin.js';
import { loginRateLimiter } from '../../../middleware/rate_limiter.js';

const router = Router();

router.post('/login', loginRateLimiter, AdminAuthController.login);
router.get('/me', authenticateAdmin, AdminAuthController.me);

export default router;
