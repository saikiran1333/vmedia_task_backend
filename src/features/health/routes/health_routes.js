import { Router } from 'express';
import { HealthController } from '../controllers/health_controller.js';

const router = Router();

// Routes for system health and diagnostics monitoring.
router.get('/', HealthController.getHealth);

export default router;
