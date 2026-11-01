# Vmedia backend

Express API for the Vmedia task platform. Persistence is Neon Postgres through the pooled `DATABASE_URL` in `.env`.

## Run

```bash
npm install
npm test
npm run dev
```

The API listens on port 5000. Interactive docs are at http://localhost:5000/api/docs.

```bash
npm run migrate
npm run seed
npm run admin:create
```

`admin:create` reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME` from the environment. Set `JWT_SECRET` to at least 32 characters before using the admin routes. Copy `.env.example` to `.env` if the environment file is missing. Do not commit `.env`.
