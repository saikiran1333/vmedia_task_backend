import { CatalogueService } from '../services/catalogue_service.js';
import { ApiResponse } from '../../../utils/api_response.js';
import { HTTP_STATUS } from '../../../constants/http_status.js';
import { asyncHandler } from '../../../middleware/async_handler.js';

const respond = (loader, message) =>
  asyncHandler(async (req, res) => {
    const data = await loader();
    return ApiResponse.success(res, {
      statusCode: HTTP_STATUS.OK,
      message,
      data,
    });
  });

export class CatalogueController {
  static categories = respond(CatalogueService.listCategories, 'Success');
  static occasions = respond(CatalogueService.listOccasions, 'Success');
  static customisationOptions = respond(CatalogueService.listCustomisationOptions, 'Success');
}
