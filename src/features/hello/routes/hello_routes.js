import { Router } from 'express';
import { HelloController } from '../controllers/hello_controller.js';

const router = Router();

// Routes for hello world domain endpoint.
router.get('/', HelloController.getHelloWorld);

export default router;
