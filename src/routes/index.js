import { Router } from 'express';
import helloRoutes from '../features/hello/routes/hello_routes.js';
import healthRoutes from '../features/health/routes/health_routes.js';
import productRoutes from '../features/products/routes/product_routes.js';
import { categoryRoutes, occasionRoutes, customisationRoutes } from '../features/catalogue/routes/catalogue_routes.js';
import enquiryRoutes from '../features/enquiries/routes/enquiry_routes.js';
import adminEnquiryRoutes from '../features/enquiries/routes/admin_enquiry_routes.js';
import adminAuthRoutes from '../features/admin_auth/routes/admin_auth_routes.js';
import { logger } from '../utils/logger.js';

// Central API Router mounting modular feature routes.
const apiRouter = Router();

logger.debug('Registering feature route: /hello');
apiRouter.use('/hello', helloRoutes);

logger.debug('Registering feature route: /health');
apiRouter.use('/health', healthRoutes);

logger.debug('Registering feature route: /products');
apiRouter.use('/products', productRoutes);

logger.debug('Registering feature route: /categories');
apiRouter.use('/categories', categoryRoutes);

logger.debug('Registering feature route: /occasions');
apiRouter.use('/occasions', occasionRoutes);

logger.debug('Registering feature route: /customisation-options');
apiRouter.use('/customisation-options', customisationRoutes);

logger.debug('Registering feature route: /enquiries');
apiRouter.use('/enquiries', enquiryRoutes);

logger.debug('Registering feature route: /admin/auth');
apiRouter.use('/admin/auth', adminAuthRoutes);

logger.debug('Registering feature route: /admin/enquiries');
apiRouter.use('/admin/enquiries', adminEnquiryRoutes);

export default apiRouter;
