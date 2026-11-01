import { ProductService } from '../services/product_service.js';
import { ApiResponse } from '../../../utils/api_response.js';
import { HTTP_STATUS } from '../../../constants/http_status.js';
import { asyncHandler } from '../../../middleware/async_handler.js';

export class ProductController {
  static list = asyncHandler(async (req, res) => {
    const result = await ProductService.list(req.query);
    return ApiResponse.success(res, {
      statusCode: HTTP_STATUS.OK,
      message: result.total === 0 ? 'No products match.' : 'Success',
      data: result.items,
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
    });
  });

  static getById = asyncHandler(async (req, res) => {
    const product = await ProductService.getById(req.params.id);
    return ApiResponse.success(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Success',
      data: product,
    });
  });
}
