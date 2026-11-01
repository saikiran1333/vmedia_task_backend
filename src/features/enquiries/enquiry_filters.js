import { ENQUIRY_SOURCES, ENQUIRY_STATUSES, OCCASIONS } from '../../constants/catalogue.js';
import { AppError } from '../../utils/app_error.js';
import { HTTP_STATUS } from '../../constants/http_status.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SORTS = Object.freeze({
  createdAt: 'e.created_at',
  updatedAt: 'e.updated_at',
  status: 'e.status',
  name: 'e.name',
  enquiryNumber: 'e.enquiry_number',
});

export const escapeLike = (value) => value.replace(/[\\%_]/g, '\\$&');

const isRealDate = (value) => {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

// Shared by the admin list and the CSV export so both honour the same filters.
export const parseEnquiryAdminQuery = (query, { paginate }) => {
  const errors = [];
  const status = query.status == null || query.status === '' ? null : String(query.status);
  if (status && !ENQUIRY_STATUSES.includes(status)) {
    errors.push({ field: 'status', message: 'Status must be NEW, CONTACTED, CONVERTED, or LOST.' });
  }

  const source = query.source == null || query.source === '' ? null : String(query.source);
  if (source && !ENQUIRY_SOURCES.includes(source)) {
    errors.push({ field: 'source', message: 'Source must be WEBSITE or MOBILE.' });
  }

  const occasion = query.occasion == null || query.occasion === '' ? null : String(query.occasion);
  if (occasion && !OCCASIONS.some((row) => row.enquiryLabel === occasion || row.name === occasion)) {
    errors.push({ field: 'occasion', message: 'Choose an occasion from the list.' });
  }

  const q = query.q == null ? '' : String(query.q).trim();
  if (q.length > 80) errors.push({ field: 'q', message: 'Search text must be 80 characters or fewer.' });

  const from = query.from == null || query.from === '' ? null : String(query.from);
  const to = query.to == null || query.to === '' ? null : String(query.to);
  if (from && !isRealDate(from)) errors.push({ field: 'from', message: 'Enter from as YYYY-MM-DD.' });
  if (to && !isRealDate(to)) errors.push({ field: 'to', message: 'Enter to as YYYY-MM-DD.' });
  if (from && to && isRealDate(from) && isRealDate(to) && from > to) {
    errors.push({ field: 'from', message: 'from cannot be after to.' });
  }

  const sort = query.sort == null || query.sort === '' ? 'createdAt' : String(query.sort);
  if (!Object.prototype.hasOwnProperty.call(SORTS, sort)) {
    errors.push({ field: 'sort', message: 'Sort must be createdAt, updatedAt, status, name, or enquiryNumber.' });
  }
  const order = query.order == null || query.order === '' ? 'desc' : String(query.order).toLowerCase();
  if (!['asc', 'desc'].includes(order)) {
    errors.push({ field: 'order', message: 'Order must be asc or desc.' });
  }

  let page = 1;
  let pageSize = 20;
  if (paginate) {
    page = query.page == null || query.page === '' ? 1 : Number(query.page);
    pageSize = query.pageSize == null || query.pageSize === '' ? 20 : Number(query.pageSize);
    if (!Number.isInteger(page) || page < 1 || page > 10000) {
      errors.push({ field: 'page', message: 'Page must be a whole number from 1.' });
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      errors.push({ field: 'pageSize', message: 'Page size must be a whole number from 1 to 100.' });
    }
  }

  if (errors.length) {
    throw new AppError('The request is not valid.', HTTP_STATUS.BAD_REQUEST, errors);
  }

  return { status, source, occasion, q, from, to, sort, order, page, pageSize };
};

export const enquiryWhere = (filters) => {
  const clauses = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    clauses.push(sql.replace('$?', `$${params.length}`));
  };

  if (filters.status) add('e.status = $?', filters.status);
  if (filters.source) add('e.source = $?', filters.source);
  if (filters.occasion) {
    params.push(filters.occasion);
    const mark = `$${params.length}`;
    clauses.push(`(e.occasion_label = ${mark} OR e.occasion_name = ${mark})`);
  }
  if (filters.q) {
    params.push(`%${escapeLike(filters.q)}%`);
    const mark = `$${params.length}`;
    clauses.push(`(
      e.name ILIKE ${mark} ESCAPE '\\'
      OR e.email ILIKE ${mark} ESCAPE '\\'
      OR COALESCE(e.company_name, '') ILIKE ${mark} ESCAPE '\\'
      OR e.phone ILIKE ${mark} ESCAPE '\\'
      OR e.enquiry_number ILIKE ${mark} ESCAPE '\\'
    )`);
  }
  if (filters.from) {
    add(`(e.created_at AT TIME ZONE 'Asia/Kolkata')::date >= $?::date`, filters.from);
  }
  if (filters.to) {
    add(`(e.created_at AT TIME ZONE 'Asia/Kolkata')::date <= $?::date`, filters.to);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
    orderSql: `${SORTS[filters.sort]} ${filters.order === 'asc' ? 'ASC' : 'DESC'}, e.id ASC`,
  };
};
