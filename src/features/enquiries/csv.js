const FORMULA_PREFIX = /^[=+\-@\t\r]/;

// RFC-style CSV cell. A leading formula character is prefixed so a spreadsheet does not execute it.
export const csvCell = (value) => {
  if (value == null) return '';
  let text = String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

export const csvLine = (values) => values.map(csvCell).join(',');

export const ENQUIRY_EXPORT_HEADERS = Object.freeze([
  'Enquiry Number',
  'Enquiry ID',
  'Created At',
  'Updated At',
  'Status',
  'Source',
  'Name',
  'Email',
  'Phone',
  'City',
  'Company Name',
  'Units',
  'Occasion',
  'Budget',
  'Delivery Date',
  'Message',
  'Customisation Requirements',
  'Customisation Options',
  'Product ID',
  'Product Name',
  'Quantity',
  'Unit Price (INR)',
]);

export const EXPORT_ROW_LIMIT = 5000;
