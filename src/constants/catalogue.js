// Assignment categories. A product stays uncategorised when the public site has none of these.
export const ASSIGNMENT_CATEGORIES = Object.freeze([
  'Drinkware',
  'Apparel',
  'Work Essentials',
  'Wellness',
]);

// Catalogue price bands, derived from displayed price. These filter products.
export const BUDGET_BANDS = Object.freeze([
  'Under ₹500',
  '₹500 to ₹1,500',
  '₹1,500 to ₹3,000',
  'Above ₹3,000',
]);

// Live enquiry form budgets. The en dash is U+2013, copied from the public form.
export const ENQUIRY_BUDGETS = Object.freeze([
  'Under ₹200 per gift',
  '₹200 \u2013 ₹500 per gift',
  '₹500 \u2013 ₹1,000 per gift',
  '₹1,000 \u2013 ₹2,500 per gift',
  '₹2,500+ per gift',
  'Flexible / Not sure',
]);

// Assignment names plus the live-form labels. The seventh label is not a catalogue filter.
export const OCCASIONS = Object.freeze([
  {
    name: 'Employee Onboarding',
    enquiryLabel: 'Employee Joining Kit / Onboarding',
    catalogueFilter: true,
  },
  {
    name: 'Corporate Diwali Gifting',
    enquiryLabel: 'Corporate Diwali Gifting',
    catalogueFilter: true,
  },
  {
    name: 'New Year Gifts',
    enquiryLabel: 'New Year Corporate Gifts',
    catalogueFilter: true,
  },
  {
    name: 'Client and Vendor Gifting',
    enquiryLabel: 'Client / Vendor Gifting',
    catalogueFilter: true,
  },
  {
    name: 'Events and Trade Shows',
    enquiryLabel: 'Trade Show / Event Giveaways',
    catalogueFilter: true,
  },
  {
    name: 'Employee Recognition',
    enquiryLabel: 'Employee Recognition / Awards',
    catalogueFilter: true,
  },
  {
    name: null,
    enquiryLabel: 'Branded Merchandise / Promotional Gifts',
    catalogueFilter: false,
  },
]);

export const CUSTOMISATION_OPTIONS = Object.freeze([
  'Logo printing',
  'Laser engraving',
  'Name personalisation',
]);

export const ENQUIRY_SOURCES = Object.freeze(['WEBSITE', 'MOBILE']);

export const ENQUIRY_STATUSES = Object.freeze(['NEW', 'CONTACTED', 'CONVERTED', 'LOST']);

export const CUSTOMISATION_BASIS = 'site-faq';
