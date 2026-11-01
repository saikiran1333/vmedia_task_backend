import { Router } from 'express';
import helloRoutes from '../features/hello/routes/hello_routes.js';
import healthRoutes from '../features/health/routes/health_routes.js';
import { logger } from '../utils/logger.js';

// Central API Router mounting modular feature routes.
const apiRouter = Router();

// Mounting Hello feature routes.
logger.debug('Registering feature route: /hello');
apiRouter.use('/hello', helloRoutes);

// Mounting Health and system diagnostics feature routes.
logger.debug('Registering feature route: /health');
apiRouter.use('/health', healthRoutes);

export default apiRouter;
