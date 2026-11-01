import { Router } from 'express';
import { AdminEnquiryController } from '../controllers/admin_enquiry_controller.js';
import { authenticateAdmin } from '../../../middleware/authenticate_admin.js';

const router = Router();

router.use(authenticateAdmin);
router.get('/export', AdminEnquiryController.exportCsv);
router.get('/', AdminEnquiryController.list);
router.get('/:id', AdminEnquiryController.getById);
router.patch('/:id/status', AdminEnquiryController.updateStatus);

export default router;
