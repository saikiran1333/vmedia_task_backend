import { Router } from 'express';
import { ProductController } from '../controllers/product_controller.js';

const router = Router();

router.get('/', ProductController.list);
router.get('/:id', ProductController.getById);

export default router;
