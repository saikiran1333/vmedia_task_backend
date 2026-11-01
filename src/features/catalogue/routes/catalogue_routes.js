import { Router } from 'express';
import { CatalogueController } from '../controllers/catalogue_controller.js';

export const categoryRoutes = Router().get('/', CatalogueController.categories);
export const occasionRoutes = Router().get('/', CatalogueController.occasions);
export const customisationRoutes = Router().get('/', CatalogueController.customisationOptions);
