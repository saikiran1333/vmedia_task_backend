import { pool } from '../../../config/database.js';
import { dbQuery, assertDatabaseConfigured } from '../../../db/query.js';
import { mapDatabaseError } from '../../../db/errors.js';
import { AppError } from '../../../utils/app_error.js';
import { HTTP_STATUS } from '../../../constants/http_status.js';
import { paiseToRupees } from '../../../utils/money.js';
import { resolveUnits } from '../enquiry_rules.js';
import { ENQUIRY_STATUSES } from '../../../constants/catalogue.js';
import { enquiryWhere, parseEnquiryAdminQuery } from '../enquiry_filters.js';
import { ENQUIRY_EXPORT_HEADERS, EXPORT_ROW_LIMIT, csvLine } from '../csv.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const presentHeader = (row) => ({
  id: row.id,
  enquiryNumber: row.enquiry_number,
  name: row.name,
  email: row.email,
  phone: row.phone,
  city: row.city,
  companyName: row.company_name,
  units: row.units,
  occasion: row.occasion_label,
  occasionName: row.occasion_name,
  budget: row.budget_label,
  source: row.source,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  itemCount: row.item_count == null ? undefined : Number(row.item_count),
});

const loadEnquiry = async (client, id) => {
  const enquiry = await client.query(
    `SELECT id, enquiry_number, name, company_name, email, phone, city, units,
            occasion_name, occasion_label, budget_label, delivery_date, message,
            customisation_requirements, source, status, created_at, updated_at
     FROM enquiries WHERE id = $1`,
    [id]
  );
  if (!enquiry.rowCount) return null;
  const items = await client.query(
    `SELECT product_id, product_name, quantity, unit_price_paise
     FROM enquiry_items WHERE enquiry_id = $1 ORDER BY id`,
    [id]
  );
  const options = await client.query(
    `SELECT c.name
     FROM enquiry_customisations ec
     JOIN customisation_options c ON c.id = ec.customisation_option_id
     WHERE ec.enquiry_id = $1
     ORDER BY c.id`,
    [id]
  );
  const events = await client.query(
    `SELECT from_status, to_status, created_at
     FROM enquiry_status_events WHERE enquiry_id = $1 ORDER BY id`,
    [id]
  );
  const row = enquiry.rows[0];
  return {
    ...presentHeader({ ...row, item_count: items.rowCount }),
    deliveryDate: row.delivery_date,
    message: row.message,
    customisationRequirements: row.customisation_requirements,
    customisationOptions: options.rows.map((option) => option.name),
    items: items.rows.map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      unitPrice: paiseToRupees(item.unit_price_paise),
    })),
    statusEvents: events.rows.map((event) => ({
      fromStatus: event.from_status,
      toStatus: event.to_status,
      createdAt: event.created_at,
    })),
  };
};

const publicReceipt = (enquiry) => ({
  id: enquiry.id,
  enquiryNumber: enquiry.enquiryNumber,
  status: enquiry.status,
  source: enquiry.source,
  units: enquiry.units,
  createdAt: enquiry.createdAt,
});

const nextEnquiryNumber = async (client) => {
  const counter = await client.query(
    `INSERT INTO enquiry_number_counters (day, last_value)
     VALUES ((now() AT TIME ZONE 'Asia/Kolkata')::date, 1)
     ON CONFLICT (day) DO UPDATE SET last_value = enquiry_number_counters.last_value + 1
     RETURNING to_char(day, 'YYYYMMDD') AS day, last_value`
  );
  const row = counter.rows[0];
  return `ENQ-${row.day}-${String(row.last_value).padStart(4, '0')}`;
};

const readReplay = async (key, requestHash) => {
  const existing = await dbQuery(
    `SELECT enquiry_id, request_hash FROM enquiry_idempotency_keys WHERE idempotency_key = $1`,
    [key]
  );
  if (!existing.rowCount) return null;
  if (existing.rows[0].request_hash !== requestHash) {
    throw new AppError(
      'This idempotency key was already used for a different enquiry.',
      HTTP_STATUS.CONFLICT,
      [{ field: 'Idempotency-Key', message: 'This idempotency key was already used for a different enquiry.' }]
    );
  }
  const client = await pool.connect();
  try {
    const enquiry = await loadEnquiry(client, existing.rows[0].enquiry_id);
    return { enquiry: publicReceipt(enquiry), replay: true };
  } finally {
    client.release();
  }
};

export class EnquiryService {
  static async create(value) {
    assertDatabaseConfigured();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (value.idempotencyKey) {
        const existing = await client.query(
          `SELECT enquiry_id, request_hash
           FROM enquiry_idempotency_keys
           WHERE idempotency_key = $1
           FOR UPDATE`,
          [value.idempotencyKey]
        );
        if (existing.rowCount) {
          if (existing.rows[0].request_hash !== value.requestHash) {
            throw new AppError(
              'This idempotency key was already used for a different enquiry.',
              HTTP_STATUS.CONFLICT,
              [{ field: 'Idempotency-Key', message: 'This idempotency key was already used for a different enquiry.' }]
            );
          }
          const enquiry = await loadEnquiry(client, existing.rows[0].enquiry_id);
          await client.query('COMMIT');
          return { enquiry: publicReceipt(enquiry), replay: true };
        }
      }

      const productIds = value.items.map((item) => item.productId);
      let products = new Map();
      if (productIds.length) {
        const found = await client.query(
          `SELECT id, name, displayed_price_paise, active
           FROM products WHERE id = ANY($1::text[]) FOR SHARE`,
          [productIds]
        );
        products = new Map(found.rows.map((row) => [row.id, row]));
        const itemErrors = [];
        productIds.forEach((productId) => {
          const product = products.get(productId);
          if (!product) {
            itemErrors.push({ field: 'items', message: `Product ${productId} was not found.` });
          } else if (!product.active) {
            itemErrors.push({ field: 'items', message: `Product ${productId} is not available.` });
          }
        });
        if (itemErrors.length) {
          throw new AppError('Enquiry could not be saved.', HTTP_STATUS.BAD_REQUEST, itemErrors);
        }
      }

      if (value.customisationOptions.length) {
        const options = await client.query(
          'SELECT id, name FROM customisation_options WHERE name = ANY($1::text[])',
          [value.customisationOptions]
        );
        if (options.rowCount !== value.customisationOptions.length) {
          throw new AppError('Enquiry could not be saved.', HTTP_STATUS.BAD_REQUEST, [
            { field: 'customisationOptions', message: 'Choose a customisation option from the list.' },
          ]);
        }
        if (productIds.length) {
          const links = await client.query(
            `SELECT p.id AS product_id, c.name
             FROM products p
             JOIN product_customisation_options pc ON pc.product_id = p.id
             JOIN customisation_options c ON c.id = pc.customisation_option_id
             WHERE p.id = ANY($1::text[]) AND c.name = ANY($2::text[])`,
            [productIds, value.customisationOptions]
          );
          const available = new Set(links.rows.map((row) => `${row.product_id}:${row.name}`));
          const missing = [];
          for (const productId of productIds) {
            for (const option of value.customisationOptions) {
              if (!available.has(`${productId}:${option}`)) missing.push(option);
            }
          }
          if (missing.length) {
            throw new AppError('Enquiry could not be saved.', HTTP_STATUS.BAD_REQUEST, [
              { field: 'customisationOptions', message: 'One of the selected products does not offer that customisation.' },
            ]);
          }
        }
        value.optionIds = options.rows.map((row) => row.id);
      } else {
        value.optionIds = [];
      }

      const resolved = resolveUnits(value.items, value.suppliedUnits);
      if (resolved.error) {
        throw new AppError('Enquiry could not be saved.', HTTP_STATUS.BAD_REQUEST, [
          { field: 'units', message: resolved.error },
        ]);
      }

      const enquiryNumber = await nextEnquiryNumber(client);
      const inserted = await client.query(
        `INSERT INTO enquiries (
           enquiry_number, name, company_name, email, phone, city, units,
           occasion_name, occasion_label, budget_label, delivery_date, message,
           customisation_requirements, source, status
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12,
           $13, $14, 'NEW'
         ) RETURNING id`,
        [
          enquiryNumber,
          value.name,
          value.companyName,
          value.email,
          value.phone,
          value.city,
          resolved.units,
          value.occasionName,
          value.occasionLabel,
          value.budgetLabel,
          value.deliveryDate,
          value.message,
          value.customisationRequirements,
          value.source,
        ]
      );
      const enquiryId = inserted.rows[0].id;

      for (const item of value.items) {
        const product = products.get(item.productId);
        await client.query(
          `INSERT INTO enquiry_items (enquiry_id, product_id, product_name, quantity, unit_price_paise)
           VALUES ($1, $2, $3, $4, $5)`,
          [enquiryId, product.id, product.name, item.quantity, product.displayed_price_paise]
        );
      }
      for (const optionId of value.optionIds) {
        await client.query(
          'INSERT INTO enquiry_customisations (enquiry_id, customisation_option_id) VALUES ($1, $2)',
          [enquiryId, optionId]
        );
      }
      await client.query(
        `INSERT INTO enquiry_status_events (enquiry_id, from_status, to_status) VALUES ($1, NULL, 'NEW')`,
        [enquiryId]
      );
      if (value.idempotencyKey) {
        await client.query(
          `INSERT INTO enquiry_idempotency_keys (idempotency_key, request_hash, enquiry_id)
           VALUES ($1, $2, $3)`,
          [value.idempotencyKey, value.requestHash, enquiryId]
        );
      }

      const enquiry = await loadEnquiry(client, enquiryId);
      await client.query('COMMIT');
      return { enquiry: publicReceipt(enquiry), replay: false };
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignore a rollback failure and surface the original error.
      }
      if (error?.code === '23505' && error.constraint === 'enquiry_idempotency_keys_pkey' && value.idempotencyKey) {
        const replay = await readReplay(value.idempotencyKey, value.requestHash);
        if (replay) return replay;
      }
      if (error instanceof AppError) throw error;
      const mapped = mapDatabaseError(error);
      if (mapped.statusCode === HTTP_STATUS.SERVICE_UNAVAILABLE) {
        mapped.message = 'Enquiry could not be saved. Try again in a moment.';
      }
      throw mapped;
    } finally {
      client.release();
    }
  }

  static async list(query) {
    const filters = parseEnquiryAdminQuery(query, { paginate: true });
    const { whereSql, params, orderSql } = enquiryWhere(filters);
    const count = await dbQuery(`SELECT COUNT(*)::int AS total FROM enquiries e ${whereSql}`, params);
    const listParams = params.slice();
    listParams.push(filters.pageSize, (filters.page - 1) * filters.pageSize);
    const rows = await dbQuery(
      `SELECT e.id, e.enquiry_number, e.name, e.email, e.phone, e.city, e.company_name,
              e.units, e.occasion_name, e.occasion_label, e.budget_label, e.source, e.status,
              e.created_at, e.updated_at,
              (SELECT COUNT(*)::int FROM enquiry_items i WHERE i.enquiry_id = e.id) AS item_count
       FROM enquiries e
       ${whereSql}
       ORDER BY ${orderSql}
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );
    return {
      items: rows.rows.map((row) => presentHeader(row)),
      page: filters.page,
      pageSize: filters.pageSize,
      total: Number(count.rows[0].total),
    };
  }

  static async getById(id) {
    if (!UUID_PATTERN.test(id)) {
      throw new AppError('Enquiry id is not valid.', HTTP_STATUS.BAD_REQUEST, [
        { field: 'id', message: 'Enquiry id is not valid.' },
      ]);
    }
    assertDatabaseConfigured();
    const client = await pool.connect();
    try {
      const enquiry = await loadEnquiry(client, id);
      if (!enquiry) throw new AppError('Enquiry not found.', HTTP_STATUS.NOT_FOUND);
      return enquiry;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw mapDatabaseError(error);
    } finally {
      client.release();
    }
  }

  static async updateStatus(id, body, adminId) {
    if (!UUID_PATTERN.test(id)) {
      throw new AppError('Enquiry id is not valid.', HTTP_STATUS.BAD_REQUEST, [
        { field: 'id', message: 'Enquiry id is not valid.' },
      ]);
    }
    const status = body && typeof body.status === 'string' ? body.status.trim() : '';
    if (!ENQUIRY_STATUSES.includes(status)) {
      throw new AppError('The request is not valid.', HTTP_STATUS.BAD_REQUEST, [
        { field: 'status', message: 'Status must be NEW, CONTACTED, CONVERTED, or LOST.' },
      ]);
    }

    assertDatabaseConfigured();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query('SELECT status FROM enquiries WHERE id = $1 FOR UPDATE', [id]);
      if (!current.rowCount) throw new AppError('Enquiry not found.', HTTP_STATUS.NOT_FOUND);
      if (current.rows[0].status !== status) {
        await client.query(
          `UPDATE enquiries SET status = $2, updated_at = now() WHERE id = $1`,
          [id, status]
        );
        await client.query(
          `INSERT INTO enquiry_status_events (enquiry_id, from_status, to_status, admin_user_id)
           VALUES ($1, $2, $3, $4)`,
          [id, current.rows[0].status, status, adminId]
        );
      }
      const enquiry = await loadEnquiry(client, id);
      await client.query('COMMIT');
      return enquiry;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Keep the original failure.
      }
      if (error instanceof AppError) throw error;
      throw mapDatabaseError(error);
    } finally {
      client.release();
    }
  }

  static async exportCsv(query, res) {
    const filters = parseEnquiryAdminQuery(query, { paginate: false });
    const { whereSql, params, orderSql } = enquiryWhere(filters);
    assertDatabaseConfigured();

    const count = await dbQuery(
      `SELECT COUNT(*)::int AS total
       FROM enquiries e
       LEFT JOIN enquiry_items i ON i.enquiry_id = e.id
       ${whereSql}`,
      params
    );
    const total = count.rows[0].total;
    const truncated = total > EXPORT_ROW_LIMIT;

    const exportParams = params.slice();
    exportParams.push(EXPORT_ROW_LIMIT);
    const rows = await dbQuery(
      `SELECT e.enquiry_number, e.id, e.created_at, e.updated_at, e.status, e.source,
              e.name, e.email, e.phone, e.city, e.company_name, e.units, e.occasion_label,
              e.budget_label, e.delivery_date, e.message, e.customisation_requirements,
              COALESCE((
                SELECT string_agg(c.name, '; ' ORDER BY c.id)
                FROM enquiry_customisations ec
                JOIN customisation_options c ON c.id = ec.customisation_option_id
                WHERE ec.enquiry_id = e.id
              ), '') AS customisation_options,
              i.product_id, i.product_name, i.quantity, i.unit_price_paise
       FROM enquiries e
       LEFT JOIN enquiry_items i ON i.enquiry_id = e.id
       ${whereSql}
       ORDER BY ${orderSql}, i.id ASC NULLS FIRST
       LIMIT $${exportParams.length}`,
      exportParams
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="enquiries.csv"');
    res.setHeader('X-Export-Limit', String(EXPORT_ROW_LIMIT));
    res.setHeader('X-Export-Truncated', truncated ? 'true' : 'false');
    res.write('\uFEFF');
    res.write(`${csvLine(ENQUIRY_EXPORT_HEADERS)}\n`);
    for (const row of rows.rows) {
      res.write(`${csvLine([
        row.enquiry_number,
        row.id,
        row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        row.status,
        row.source,
        row.name,
        row.email,
        row.phone,
        row.city,
        row.company_name,
        row.units,
        row.occasion_label,
        row.budget_label,
        row.delivery_date,
        row.message,
        row.customisation_requirements,
        row.customisation_options,
        row.product_id,
        row.product_name,
        row.quantity,
        row.unit_price_paise == null ? null : paiseToRupees(row.unit_price_paise),
      ])}\n`);
    }
    res.end();
  }
}
