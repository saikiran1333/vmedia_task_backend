import { seedCatalogue } from '../src/db/seed.js';

seedCatalogue()
  .then((summary) => {
    console.log(`Seeded ${summary.products} products and ${summary.images} images.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error.message || 'Seed failed.');
    process.exit(1);
  });
