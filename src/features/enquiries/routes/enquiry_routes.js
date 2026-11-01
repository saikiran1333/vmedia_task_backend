import { Router } from 'express';
import { EnquiryController } from '../controllers/enquiry_controller.js';
import { enquiryRateLimiter } from '../../../middleware/rate_limiter.js';

const router = Router();

router.post('/', enquiryRateLimiter, EnquiryController.create);

export default router;
