import { dbQuery } from '../../../db/query.js';

export class CatalogueService {
  static async listCategories() {
    const result = await dbQuery(
      `SELECT c.name, (COUNT(p.id) FILTER (WHERE p.active))::int AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id
       ORDER BY c.id`
    );
    return result.rows.map((row) => ({ name: row.name, productCount: Number(row.product_count) }));
  }

  static async listOccasions() {
    const result = await dbQuery(
      `SELECT name, enquiry_label, catalogue_filter
       FROM occasions
       ORDER BY id`
    );
    return result.rows.map((row) => ({
      name: row.name,
      enquiryLabel: row.enquiry_label,
      catalogueFilter: row.catalogue_filter,
    }));
  }

  static async listCustomisationOptions() {
    const result = await dbQuery('SELECT name FROM customisation_options ORDER BY id');
    return result.rows.map((row) => ({ name: row.name }));
  }
}
