// The database stores integer paise. JSON uses rupees, so 67500 paise is 675 rupees.
export const rupeesToPaise = (rupees) => {
  if (rupees == null) return null;
  if (typeof rupees !== 'number' || !Number.isFinite(rupees)) {
    throw new Error('Price must be a finite number of rupees.');
  }
  return Math.round(rupees * 100);
};

export const paiseToRupees = (paise) => {
  if (paise == null) return null;
  return Number(paise) / 100;
};
