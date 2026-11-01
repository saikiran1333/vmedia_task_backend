import { ASSIGNMENT_CATEGORIES, BUDGET_BANDS, OCCASIONS } from '../../../constants/catalogue.js';
import { dbQuery } from '../../../db/query.js';
import { paiseToRupees } from '../../../utils/money.js';
import { AppError } from '../../../utils/app_error.js';
import { HTTP_STATUS } from '../../../constants/http_status.js';

const PRODUCT_ID_PATTERN = /^tg-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SORTS = Object.freeze({
  name: 'p.name',
  price: 'p.displayed_price_paise',
  newest: 'p.created_at',
  updated: 'p.updated_at',
});

const escapeLike = (value) => value.replace(/[\\%_]/g, '\\$&');

const parseBooleanFlag = (value, field) => {
  if (value == null || value === '') return null;
  if (value === 'true') return true;
  throw new AppError('The request is not valid.', HTTP_STATUS.BAD_REQUEST, [
    { field, message: `${field} only accepts true.` },
  ]);
};

export const parseProductListQuery = (query) => {
  const errors = [];
  const category = query.category == null || query.category === '' ? null : String(query.category);
  if (category && !ASSIGNMENT_CATEGORIES.includes(category)) {
    errors.push({ field: 'category', message: 'Choose Drinkware, Apparel, Work Essentials, or Wellness.' });
  }

  const occasion = query.occasion == null || query.occasion === '' ? null : String(query.occasion);
  const catalogueOccasions = OCCASIONS.filter((row) => row.catalogueFilter).map((row) => row.name);
  if (occasion && !catalogueOccasions.includes(occasion)) {
    errors.push({ field: 'occasion', message: 'Choose an occasion from the catalogue list.' });
  }

  const budget = query.budget == null || query.budget === '' ? null : String(query.budget);
  if (budget && !BUDGET_BANDS.includes(budget)) {
    errors.push({ field: 'budget', message: 'Choose a budget band from the list.' });
  }

  const q = query.q == null ? '' : String(query.q).trim();
  if (q.length > 80) errors.push({ field: 'q', message: 'Search text must be 80 characters or fewer.' });

  let justIn = null;
  let fastSelling = null;
  try {
    justIn = parseBooleanFlag(query.justIn, 'justIn');
    fastSelling = parseBooleanFlag(query.fastSelling, 'fastSelling');
  } catch (error) {
    if (error instanceof AppError && Array.isArray(error.details)) errors.push(...error.details);
    else throw error;
  }

  const sort = query.sort == null || query.sort === '' ? 'name' : String(query.sort);
  if (!Object.prototype.hasOwnProperty.call(SORTS, sort)) {
    errors.push({ field: 'sort', message: 'Sort must be name, price, newest, or updated.' });
  }
  const order = query.order == null || query.order === '' ? 'asc' : String(query.order).toLowerCase();
  if (!['asc', 'desc'].includes(order)) {
    errors.push({ field: 'order', message: 'Order must be asc or desc.' });
  }

  const page = query.page == null || query.page === '' ? 1 : Number(query.page);
  const pageSize = query.pageSize == null || query.pageSize === '' ? 20 : Number(query.pageSize);
  if (!Number.isInteger(page) || page < 1 || page > 10000) {
    errors.push({ field: 'page', message: 'Page must be a whole number from 1.' });
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    errors.push({ field: 'pageSize', message: 'Page size must be a whole number from 1 to 100.' });
  }

  if (errors.length) {
    throw new AppError('The request is not valid.', HTTP_STATUS.BAD_REQUEST, errors);
  }

  return {
    category,
    occasion,
    budget,
    q,
    justIn,
    fastSelling,
    sort,
    order,
    page,
    pageSize,
  };
};

const presentSummary = (row, occasions, customisationOptions) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  category: row.category_name,
  displayedPrice: paiseToRupees(row.displayed_price_paise),
  originalPrice: paiseToRupees(row.original_price_paise),
  currency: row.currency,
  budgetBand: row.budget_band,
  imageKey: row.image_key,
  justIn: row.just_in,
  fastSelling: row.fast_selling,
  occasions,
  customisationOptions,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const relationMaps = async (productIds) => {
  const occasions = new Map();
  const customisations = new Map();
  if (!productIds.length) return { occasions, customisations };

  const occasionRows = await dbQuery(
    `SELECT po.product_id, o.name
     FROM product_occasions po
     JOIN occasions o ON o.id = po.occasion_id
     WHERE po.product_id = ANY($1::text[]) AND o.catalogue_filter = true
     ORDER BY o.id`,
    [productIds]
  );
  const optionRows = await dbQuery(
    `SELECT pc.product_id, c.name
     FROM product_customisation_options pc
     JOIN customisation_options c ON c.id = pc.customisation_option_id
     WHERE pc.product_id = ANY($1::text[])
     ORDER BY c.id`,
    [productIds]
  );

  for (const row of occasionRows.rows) {
    const list = occasions.get(row.product_id) || [];
    list.push(row.name);
    occasions.set(row.product_id, list);
  }
  for (const row of optionRows.rows) {
    const list = customisations.get(row.product_id) || [];
    list.push(row.name);
    customisations.set(row.product_id, list);
  }
  return { occasions, customisations };
};

export class ProductService {
  static async list(query) {
    const filters = parseProductListQuery(query);
    const where = ['p.active = true'];
    const params = [];

    if (filters.category) {
      params.push(filters.category);
      where.push(`c.name = $${params.length}`);
    }
    if (filters.budget) {
      params.push(filters.budget);
      where.push(`p.budget_band = $${params.length}`);
    }
    if (filters.q) {
      params.push(`%${escapeLike(filters.q)}%`);
      where.push(`p.name ILIKE $${params.length} ESCAPE '\\'`);
    }
    if (filters.occasion) {
      params.push(filters.occasion);
      where.push(`EXISTS (
        SELECT 1 FROM product_occasions po
        JOIN occasions o ON o.id = po.occasion_id
        WHERE po.product_id = p.id AND o.name = $${params.length} AND o.catalogue_filter = true
      )`);
    }
    if (filters.justIn) where.push('p.just_in = true');
    if (filters.fastSelling) where.push('p.fast_selling = true');

    const whereSql = where.join(' AND ');
    const count = await dbQuery(
      `SELECT COUNT(*)::int AS total
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${whereSql}`,
      params
    );
    const total = Number(count.rows[0].total);

    const sortColumn = SORTS[filters.sort];
    const direction = filters.order === 'desc' ? 'DESC' : 'ASC';
    const listParams = params.slice();
    listParams.push(filters.pageSize, (filters.page - 1) * filters.pageSize);
    const rows = await dbQuery(
      `SELECT p.id, p.slug, p.name, p.displayed_price_paise, p.original_price_paise,
              p.currency, p.budget_band, p.just_in, p.fast_selling, p.created_at, p.updated_at,
              c.name AS category_name, img.asset_key AS image_key
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN LATERAL (
         SELECT asset_key FROM product_images i
         WHERE i.product_id = p.id AND i.role = 'primary'
         ORDER BY sort_order
         LIMIT 1
       ) img ON true
       WHERE ${whereSql}
       ORDER BY ${sortColumn} ${direction}, p.id ASC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    const maps = await relationMaps(rows.rows.map((row) => row.id));
    return {
      items: rows.rows.map((row) =>
        presentSummary(row, maps.occasions.get(row.id) || [], maps.customisations.get(row.id) || [])
      ),
      page: filters.page,
      pageSize: filters.pageSize,
      total,
    };
  }

  static async getById(id) {
    if (!PRODUCT_ID_PATTERN.test(id) || id.length > 40) {
      throw new AppError('Product id is not valid.', HTTP_STATUS.BAD_REQUEST, [
        { field: 'id', message: 'Product id is not valid.' },
      ]);
    }

    const result = await dbQuery(
      `SELECT p.id, p.slug, p.name, p.short_description, p.description, p.category_review,
              p.site_categories, p.displayed_price_paise, p.original_price_paise,
              p.price_min_paise, p.price_max_paise, p.currency, p.budget_band, p.featured,
              p.just_in, p.fast_selling, p.active, p.created_at, p.updated_at,
              c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError('Product not found.', HTTP_STATUS.NOT_FOUND);
    }
    if (!row.active) {
      throw new AppError('This product is not available.', HTTP_STATUS.NOT_FOUND);
    }

    const images = await dbQuery(
      `SELECT asset_key, role FROM product_images WHERE product_id = $1 ORDER BY sort_order, id`,
      [id]
    );
    const maps = await relationMaps([id]);
    const summary = presentSummary(
      {
        ...row,
        image_key: images.rows.find((image) => image.role === 'primary')?.asset_key || null,
      },
      maps.occasions.get(id) || [],
      maps.customisations.get(id) || []
    );

    return {
      ...summary,
      description: row.description,
      shortDescription: row.short_description,
      galleryKeys: images.rows.filter((image) => image.role === 'gallery').map((image) => image.asset_key),
      priceMin: paiseToRupees(row.price_min_paise),
      priceMax: paiseToRupees(row.price_max_paise),
      siteCategories: row.site_categories,
      categoryReview: row.category_review,
      featured: row.featured,
    };
  }
};
