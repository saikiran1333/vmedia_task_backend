import crypto from 'crypto';
import {
  CUSTOMISATION_OPTIONS,
  ENQUIRY_BUDGETS,
  ENQUIRY_SOURCES,
  OCCASIONS,
} from '../../constants/catalogue.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRODUCT_ID_PATTERN = /^tg-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const resolveOccasion = (input) =>
  OCCASIONS.find((row) => row.enquiryLabel === input || (row.name && row.name === input)) || null;

export const normalizeIndianMobile = (input) => {
  if (typeof input !== 'string') return null;
  const compact = input.replace(/[\s()-]/g, '');
  let national = compact;
  if (national.startsWith('+91')) national = national.slice(3);
  else if (national.startsWith('91') && national.length === 12) national = national.slice(2);
  else if (national.startsWith('0') && national.length === 11) national = national.slice(1);
  if (!/^[6-9]\d{9}$/.test(national)) return null;
  return `+91${national}`;
};

const kolkataToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const isRealDate = (value) => {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

const push = (errors, field, message) => {
  errors.push({ field, message });
};

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// Units follow the selected gifts. A caller-supplied total is accepted only when it matches that sum.
export const resolveUnits = (items, suppliedUnits) => {
  if (items.length > 0) {
    const calculated = items.reduce((sum, item) => sum + item.quantity, 0);
    if (suppliedUnits != null && suppliedUnits !== calculated) {
      return {
        error: 'units must equal the sum of the selected product quantities.',
      };
    }
    if (calculated > 100000) {
      return { error: 'The combined quantity is too large.' };
    }
    return { units: calculated };
  }
  return { units: suppliedUnits };
};

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        if (value[key] !== undefined) accumulator[key] = canonical(value[key]);
        return accumulator;
      }, {});
  }
  return value;
};

export const hashEnquiryRequest = (value) =>
  crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

// Validates the public enquiry body. Product existence is checked later, inside the write transaction.
export const validateEnquiry = (body, idempotencyKey) => {
  const errors = [];
  const sourceBody = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    push(errors, 'body', 'Send the enquiry as a JSON object.');
  }

  const name = text(sourceBody.name);
  if (name.length < 2 || name.length > 80) {
    push(errors, 'name', 'Enter a name between 2 and 80 characters.');
  }

  const email = text(sourceBody.email).toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    push(errors, 'email', 'Enter a valid email address.');
  }

  const phone = normalizeIndianMobile(sourceBody.phone);
  if (!phone) {
    push(errors, 'phone', 'Enter a valid Indian mobile number.');
  }

  const city = text(sourceBody.city);
  if (city.length < 2 || city.length > 80) {
    push(errors, 'city', 'Enter a city between 2 and 80 characters.');
  }

  let companyName = null;
  if (sourceBody.companyName != null && sourceBody.companyName !== '') {
    companyName = text(sourceBody.companyName);
    if (!companyName || companyName.length > 120) {
      push(errors, 'companyName', 'Company name must be 120 characters or fewer.');
    }
  }

  const occasion = resolveOccasion(typeof sourceBody.occasion === 'string' ? sourceBody.occasion.trim() : '');
  if (!occasion) {
    push(errors, 'occasion', 'Choose an occasion from the list.');
  }

  const budgetLabel = typeof sourceBody.budget === 'string' ? sourceBody.budget.trim() : '';
  if (!ENQUIRY_BUDGETS.includes(budgetLabel)) {
    push(errors, 'budget', 'Choose a budget from the list.');
  }

  const message = text(sourceBody.message);
  if (message.length < 10 || message.length > 2000) {
    push(errors, 'message', 'Enter a message between 10 and 2000 characters.');
  }

  if (!ENQUIRY_SOURCES.includes(sourceBody.source)) {
    push(errors, 'source', 'Source must be WEBSITE or MOBILE.');
  }

  let deliveryDate = null;
  if (sourceBody.deliveryDate != null && sourceBody.deliveryDate !== '') {
    deliveryDate = typeof sourceBody.deliveryDate === 'string' ? sourceBody.deliveryDate.trim() : '';
    if (!isRealDate(deliveryDate)) {
      push(errors, 'deliveryDate', 'Enter a delivery date as YYYY-MM-DD.');
    } else if (deliveryDate < kolkataToday()) {
      push(errors, 'deliveryDate', 'Delivery date cannot be in the past.');
    }
  }

  let customisationRequirements = null;
  if (sourceBody.customisationRequirements != null && sourceBody.customisationRequirements !== '') {
    customisationRequirements = text(sourceBody.customisationRequirements);
    if (!customisationRequirements || customisationRequirements.length > 2000) {
      push(errors, 'customisationRequirements', 'Customisation requirements must be 2000 characters or fewer.');
    }
  }

  let customisationOptions = [];
  if (sourceBody.customisationOptions != null) {
    if (!Array.isArray(sourceBody.customisationOptions)) {
      push(errors, 'customisationOptions', 'Customisation options must be a list.');
    } else {
      customisationOptions = sourceBody.customisationOptions.map((option) =>
        typeof option === 'string' ? option.trim() : ''
      );
      if (customisationOptions.some((option) => !CUSTOMISATION_OPTIONS.includes(option))) {
        push(errors, 'customisationOptions', 'Choose a customisation option from the list.');
      }
      if (new Set(customisationOptions).size !== customisationOptions.length) {
        push(errors, 'customisationOptions', 'Each customisation option can be selected once.');
      }
    }
  }

  const rawItems = sourceBody.items == null ? [] : sourceBody.items;
  const items = [];
  if (sourceBody.items != null && !Array.isArray(rawItems)) {
    push(errors, 'items', 'Items must be a list.');
  } else if (Array.isArray(rawItems)) {
    if (rawItems.length > 30) {
      push(errors, 'items', 'An enquiry can include at most 30 products.');
    }
    rawItems.forEach((item, index) => {
      const productId = item && typeof item.productId === 'string' ? item.productId.trim() : '';
      if (!PRODUCT_ID_PATTERN.test(productId)) {
        push(errors, `items[${index}].productId`, 'Choose a valid product.');
        return;
      }
      if (!item || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000) {
        push(errors, `items[${index}].quantity`, 'Quantity must be a whole number from 1 to 10000.');
      }
      items.push({ productId, quantity: item?.quantity });
    });
    const ids = items.map((item) => item.productId);
    if (new Set(ids).size !== ids.length) {
      push(errors, 'items', 'Each product can appear once. Add the quantities together.');
    }
  }

  const unitsProvided = Object.prototype.hasOwnProperty.call(sourceBody, 'units')
    || Object.prototype.hasOwnProperty.call(sourceBody, 'numberOfUnits');
  const rawUnits = Object.prototype.hasOwnProperty.call(sourceBody, 'units')
    ? sourceBody.units
    : sourceBody.numberOfUnits;
  let suppliedUnits = null;
  if (items.length === 0) {
    if (!Number.isInteger(rawUnits) || rawUnits < 1 || rawUnits > 100000) {
      push(errors, 'units', 'Enter the number of gifts as a whole number.');
    } else {
      suppliedUnits = rawUnits;
    }
  } else if (unitsProvided && rawUnits != null) {
    if (!Number.isInteger(rawUnits) || rawUnits < 1) {
      push(errors, 'units', 'units must be a positive whole number.');
    } else {
      suppliedUnits = rawUnits;
      const resolved = resolveUnits(items.filter((item) => Number.isInteger(item.quantity)), suppliedUnits);
      if (resolved.error) push(errors, 'units', resolved.error);
    }
  }

  let key = null;
  if (idempotencyKey != null && idempotencyKey !== '') {
    if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      push(errors, 'Idempotency-Key', 'Use 8 to 128 letters, numbers, dots, underscores, colons, or hyphens.');
    } else {
      key = idempotencyKey;
    }
  }

  if (errors.length) return { ok: false, errors };

  const value = {
    name,
    email,
    phone,
    city,
    companyName,
    occasionName: occasion.name,
    occasionLabel: occasion.enquiryLabel,
    budgetLabel,
    message,
    source: sourceBody.source,
    deliveryDate,
    customisationRequirements,
    customisationOptions: [...new Set(customisationOptions)].sort(),
    items: items
      .map((item) => ({ productId: item.productId, quantity: item.quantity }))
      .sort((left, right) => left.productId.localeCompare(right.productId)),
    suppliedUnits,
  };
  value.requestHash = hashEnquiryRequest(value);
  value.idempotencyKey = key;
  return { ok: true, value };
};
