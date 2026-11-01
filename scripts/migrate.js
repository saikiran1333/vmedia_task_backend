import { runMigrations } from '../src/db/migrate.js';

runMigrations()
  .then((applied) => {
    if (!applied.length) console.log('Migrations already applied.');
    else console.log(`Applied: ${applied.join(', ')}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error.message || 'Migration failed.');
    process.exit(1);
  });
