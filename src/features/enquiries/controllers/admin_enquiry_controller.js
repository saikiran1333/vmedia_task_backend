import { EnquiryService } from '../services/enquiry_service.js';
import { ApiResponse } from '../../../utils/api_response.js';
import { HTTP_STATUS } from '../../../constants/http_status.js';
import { asyncHandler } from '../../../middleware/async_handler.js';

export class AdminEnquiryController {
  static list = asyncHandler(async (req, res) => {
    const result = await EnquiryService.list(req.query);
    return ApiResponse.success(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Success',
      data: result,
    });
  });

  static getById = asyncHandler(async (req, res) => {
    const enquiry = await EnquiryService.getById(req.params.id);
    return ApiResponse.success(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Success',
      data: enquiry,
    });
  });

  static updateStatus = asyncHandler(async (req, res) => {
    const enquiry = await EnquiryService.updateStatus(req.params.id, req.body, req.admin.id);
    return ApiResponse.success(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Enquiry status updated.',
      data: enquiry,
    });
  });

  static exportCsv = asyncHandler(async (req, res) => {
    await EnquiryService.exportCsv(req.query, res);
  });
}
