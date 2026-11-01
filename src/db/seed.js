import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDirectPool } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { rupeesToPaise } from '../utils/money.js';
import {
  ASSIGNMENT_CATEGORIES,
  BUDGET_BANDS,
  CUSTOMISATION_BASIS,
  CUSTOMISATION_OPTIONS,
  OCCASIONS,
} from '../constants/catalogue.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(moduleDir, '../../..');

export const defaultSeedPath = path.join(workspaceRoot, 'v_media_docs', 'data', 'products.seed.json');
export const defaultAssetRoot = path.join(workspaceRoot, 'vmedia_task_web', 'public', 'assets');

// Stores the client asset key, which is the path under public/assets or assets/images.
export const toAssetKey = (localWebPath) => {
  if (typeof localWebPath !== 'string' || !localWebPath.trim()) {
    throw new Error('A product image is missing its local path.');
  }
  const normalized = localWebPath.replace(/\\/g, '/');
  const marker = '/assets/';
  const index = normalized.indexOf(marker);
  if (index === -1) {
    throw new Error(`Image path is not under /assets/: ${normalized}`);
  }
  return normalized.slice(index + marker.length);
};

const sourceTimestamp = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is missing.`);
  }
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) return value;
  // The seed records WordPress site-local time. The store is in India, so the wall clock is IST.
  return `${value}+05:30`;
};

const requireBoolean = (value, label) => {
  if (typeof value !== 'boolean') throw new Error(`${label} must be true or false.`);
  return value;
};

const assertDownloaded = (image, label) => {
  if (!image || image.downloaded !== true) {
    throw new Error(`${label} was not downloaded. No replacement image was invented.`);
  }
  const assetKey = toAssetKey(image.localWebPath);
  return assetKey;
};

const assertProduct = (product) => {
  if (!product || typeof product !== 'object') throw new Error('Seed entry is not an object.');
  if (!/^tg-\d+$/.test(product.id)) throw new Error(`Product id ${product.id} is not a tg-<number> key.`);
  for (const field of ['slug', 'name', 'description', 'permalink']) {
    if (typeof product[field] !== 'string' || !product[field].trim()) {
      throw new Error(`${product.id || 'product'} is missing ${field}.`);
    }
  }
  if (!Object.prototype.hasOwnProperty.call(product, 'shortDescription')) {
    throw new Error(`${product.id} is missing shortDescription.`);
  }
  if (product.category != null && !ASSIGNMENT_CATEGORIES.includes(product.category)) {
    throw new Error(`${product.id} has a category that is not an assignment category.`);
  }
  if (!BUDGET_BANDS.includes(product.budgetBand)) {
    throw new Error(`${product.id} has a budget band that is not in the seed rules.`);
  }
  if (!Array.isArray(product.gallery)) {
    throw new Error(`${product.id} is missing its gallery.`);
  }
  if (!Array.isArray(product.occasions) || product.occasions.length === 0) {
    throw new Error(`${product.id} has no occasions.`);
  }
  for (const name of product.occasions) {
    if (!OCCASIONS.some((row) => row.name === name)) {
      throw new Error(`${product.id} lists an occasion that is not in the assignment: ${name}`);
    }
  }
  if (!Array.isArray(product.customisationOptions) || product.customisationOptions.length === 0) {
    throw new Error(`${product.id} has no customisation options.`);
  }
  for (const name of product.customisationOptions) {
    if (!CUSTOMISATION_OPTIONS.includes(name)) {
      throw new Error(`${product.id} lists a customisation option that was not verified: ${name}`);
    }
  }
  requireBoolean(product.justIn, `${product.id} justIn`);
  requireBoolean(product.fastSelling, `${product.id} fastSelling`);
  requireBoolean(product.active, `${product.id} active`);
  if (product.currency !== 'INR') throw new Error(`${product.id} currency is not INR.`);
  if (typeof product.displayedPrice !== 'number') throw new Error(`${product.id} displayed price is missing.`);
};

// Inserts reference rows and upserts every seed product. A second run updates those rows.
export const seedCatalogue = async (options = {}) => {
  const seedPath = options.seedPath || process.env.SEED_FILE || defaultSeedPath;
  const assetRoot = options.assetRoot || process.env.ASSET_ROOT || defaultAssetRoot;
  const products = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  if (!Array.isArray(products) || products.length < 8) {
    throw new Error('The seed file must contain at least 8 products.');
  }

  const direct = createDirectPool();
  if (!direct) throw new Error('DATABASE_URL is not configured.');
  const client = await direct.connect();

  try {
    await client.query('BEGIN');

    for (const name of ASSIGNMENT_CATEGORIES) {
      await client.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
    }
    const categoryRows = await client.query('SELECT id, name FROM categories');
    const categoryIds = new Map(categoryRows.rows.map((row) => [row.name, row.id]));

    for (const occasion of OCCASIONS) {
      await client.query(
        `INSERT INTO occasions (name, enquiry_label, catalogue_filter)
         VALUES ($1, $2, $3)
         ON CONFLICT (enquiry_label) DO UPDATE
         SET name = EXCLUDED.name, catalogue_filter = EXCLUDED.catalogue_filter`,
        [occasion.name, occasion.enquiryLabel, occasion.catalogueFilter]
      );
    }
    const occasionResult = await client.query('SELECT id, name FROM occasions WHERE name IS NOT NULL');
    const occasionIds = new Map(occasionResult.rows.map((row) => [row.name, row.id]));

    for (const name of CUSTOMISATION_OPTIONS) {
      await client.query(
        'INSERT INTO customisation_options (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [name]
      );
    }
    const optionRows = await client.query('SELECT id, name FROM customisation_options');
    const optionIds = new Map(optionRows.rows.map((row) => [row.name, row.id]));

    const imageRows = [];
    const occasionRows = [];
    const customRows = [];
    const productIds = [];

    for (const product of products) {
      assertProduct(product);
      const primaryKey = assertDownloaded(product.image, `${product.id} primary image`);
      const primaryPath = path.join(assetRoot, primaryKey);
      if (!fs.existsSync(primaryPath)) {
        throw new Error(`Downloaded asset is missing on disk: ${primaryKey}`);
      }

      const gallery = [];
      for (const image of product.gallery || []) {
        const assetKey = assertDownloaded(image, `${product.id} gallery image`);
        if (!fs.existsSync(path.join(assetRoot, assetKey))) {
          throw new Error(`Downloaded asset is missing on disk: ${assetKey}`);
        }
        gallery.push(assetKey);
      }
      if (gallery.includes(primaryKey)) {
        throw new Error(`${product.id} repeats the primary image in the gallery.`);
      }

      const categoryId = product.category ? categoryIds.get(product.category) : null;
      await client.query(
        `INSERT INTO products (
           id, slug, name, short_description, description, category_id, category_review,
           site_categories, displayed_price_paise, original_price_paise, price_min_paise,
           price_max_paise, currency, budget_band, featured, just_in, fast_selling, active,
           created_at, updated_at, source_url
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11,
           $12, $13, $14, $15, $16, $17, $18,
           $19, $20, $21
         )
         ON CONFLICT (id) DO UPDATE SET
           slug = EXCLUDED.slug,
           name = EXCLUDED.name,
           short_description = EXCLUDED.short_description,
           description = EXCLUDED.description,
           category_id = EXCLUDED.category_id,
           category_review = EXCLUDED.category_review,
           site_categories = EXCLUDED.site_categories,
           displayed_price_paise = EXCLUDED.displayed_price_paise,
           original_price_paise = EXCLUDED.original_price_paise,
           price_min_paise = EXCLUDED.price_min_paise,
           price_max_paise = EXCLUDED.price_max_paise,
           currency = EXCLUDED.currency,
           budget_band = EXCLUDED.budget_band,
           featured = EXCLUDED.featured,
           just_in = EXCLUDED.just_in,
           fast_selling = EXCLUDED.fast_selling,
           active = EXCLUDED.active,
           created_at = EXCLUDED.created_at,
           updated_at = EXCLUDED.updated_at,
           source_url = EXCLUDED.source_url`,
        [
          product.id,
          product.slug,
          product.name,
          product.shortDescription,
          product.description,
          categoryId,
          product.categoryReview,
          product.siteCategories || [],
          rupeesToPaise(product.displayedPrice),
          rupeesToPaise(product.originalPrice),
          rupeesToPaise(product.priceMin),
          rupeesToPaise(product.priceMax),
          product.currency,
          product.budgetBand,
          product.featured,
          product.justIn,
          product.fastSelling,
          product.active,
          sourceTimestamp(product.createdAt, `${product.id} createdAt`),
          sourceTimestamp(product.updatedAt, `${product.id} updatedAt`),
          product.permalink,
        ]
      );

      productIds.push(product.id);
      imageRows.push([product.id, primaryKey, 'primary', 0]);
      gallery.forEach((assetKey, index) => imageRows.push([product.id, assetKey, 'gallery', index + 1]));
      for (const name of product.occasions) {
        occasionRows.push([product.id, occasionIds.get(name)]);
      }
      for (const name of product.customisationOptions) {
        customRows.push([product.id, optionIds.get(name), CUSTOMISATION_BASIS]);
      }
    }

    await client.query('DELETE FROM product_images WHERE product_id = ANY($1::text[])', [productIds]);
    await client.query(
      `INSERT INTO product_images (product_id, asset_key, role, sort_order)
       SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::int[])`,
      [
        imageRows.map((row) => row[0]),
        imageRows.map((row) => row[1]),
        imageRows.map((row) => row[2]),
        imageRows.map((row) => row[3]),
      ]
    );

    await client.query('DELETE FROM product_occasions WHERE product_id = ANY($1::text[])', [productIds]);
    await client.query(
      `INSERT INTO product_occasions (product_id, occasion_id)
       SELECT * FROM UNNEST($1::text[], $2::smallint[])`,
      [occasionRows.map((row) => row[0]), occasionRows.map((row) => row[1])]
    );

    await client.query('DELETE FROM product_customisation_options WHERE product_id = ANY($1::text[])', [productIds]);
    await client.query(
      `INSERT INTO product_customisation_options (product_id, customisation_option_id, basis)
       SELECT * FROM UNNEST($1::text[], $2::smallint[], $3::text[])`,
      [customRows.map((row) => row[0]), customRows.map((row) => row[1]), customRows.map((row) => row[2])]
    );

    const imageCount = imageRows.length;

    await client.query('COMMIT');
    const summary = { products: products.length, images: imageCount };
    logger.info('Catalogue seed completed', summary);
    return summary;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The connection may already be closed. The original error is the one to surface.
    }
    throw error;
  } finally {
    client.release();
    await direct.end();
  }
};
