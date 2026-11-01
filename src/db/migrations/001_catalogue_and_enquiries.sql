-- Catalogue, enquiry, and admin tables for the Vmedia gifting API.
-- Prices are integer paise. Product ids are the seed keys (tg-6775).

CREATE TABLE IF NOT EXISTS categories (
  id smallserial PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  short_description text,
  description text NOT NULL,
  category_id smallint REFERENCES categories (id) ON DELETE RESTRICT,
  category_review text,
  site_categories text[] NOT NULL DEFAULT '{}',
  displayed_price_paise integer NOT NULL CHECK (displayed_price_paise >= 0),
  original_price_paise integer CHECK (original_price_paise IS NULL OR original_price_paise >= 0),
  price_min_paise integer CHECK (price_min_paise IS NULL OR price_min_paise >= 0),
  price_max_paise integer CHECK (price_max_paise IS NULL OR price_max_paise >= 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  budget_band text NOT NULL CHECK (budget_band IN (
    'Under ₹500',
    '₹500 to ₹1,500',
    '₹1,500 to ₹3,000',
    'Above ₹3,000'
  )),
  featured boolean,
  just_in boolean NOT NULL,
  fast_selling boolean NOT NULL,
  active boolean NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  source_url text NOT NULL
);

CREATE TABLE IF NOT EXISTS product_images (
  id bigserial PRIMARY KEY,
  product_id text NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  asset_key text NOT NULL,
  role text NOT NULL CHECK (role IN ('primary', 'gallery')),
  sort_order integer NOT NULL,
  UNIQUE (product_id, asset_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_images_one_primary
  ON product_images (product_id)
  WHERE role = 'primary';

CREATE TABLE IF NOT EXISTS occasions (
  id smallserial PRIMARY KEY,
  name text UNIQUE,
  enquiry_label text NOT NULL UNIQUE,
  catalogue_filter boolean NOT NULL
);

CREATE TABLE IF NOT EXISTS product_occasions (
  product_id text NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  occasion_id smallint NOT NULL REFERENCES occasions (id) ON DELETE RESTRICT,
  PRIMARY KEY (product_id, occasion_id)
);

CREATE TABLE IF NOT EXISTS customisation_options (
  id smallserial PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS product_customisation_options (
  product_id text NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  customisation_option_id smallint NOT NULL REFERENCES customisation_options (id) ON DELETE RESTRICT,
  basis text NOT NULL,
  PRIMARY KEY (product_id, customisation_option_id)
);

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_number text NOT NULL UNIQUE,
  name text NOT NULL,
  company_name text,
  email text NOT NULL,
  phone text NOT NULL,
  city text NOT NULL,
  units integer NOT NULL CHECK (units > 0 AND units <= 100000),
  occasion_name text,
  occasion_label text NOT NULL CHECK (occasion_label IN (
    'Employee Joining Kit / Onboarding',
    'Corporate Diwali Gifting',
    'New Year Corporate Gifts',
    'Client / Vendor Gifting',
    'Trade Show / Event Giveaways',
    'Employee Recognition / Awards',
    'Branded Merchandise / Promotional Gifts'
  )),
  budget_label text NOT NULL CHECK (budget_label IN (
    'Under ₹200 per gift',
    '₹200 – ₹500 per gift',
    '₹500 – ₹1,000 per gift',
    '₹1,000 – ₹2,500 per gift',
    '₹2,500+ per gift',
    'Flexible / Not sure'
  )),
  delivery_date date,
  message text NOT NULL,
  customisation_requirements text,
  source text NOT NULL CHECK (source IN ('WEBSITE', 'MOBILE')),
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONTACTED', 'CONVERTED', 'LOST')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enquiry_items (
  id bigserial PRIMARY KEY,
  enquiry_id uuid NOT NULL REFERENCES enquiries (id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 10000),
  unit_price_paise integer NOT NULL CHECK (unit_price_paise >= 0),
  UNIQUE (enquiry_id, product_id)
);

CREATE TABLE IF NOT EXISTS enquiry_customisations (
  enquiry_id uuid NOT NULL REFERENCES enquiries (id) ON DELETE CASCADE,
  customisation_option_id smallint NOT NULL REFERENCES customisation_options (id) ON DELETE RESTRICT,
  PRIMARY KEY (enquiry_id, customisation_option_id)
);

CREATE TABLE IF NOT EXISTS enquiry_status_events (
  id bigserial PRIMARY KEY,
  enquiry_id uuid NOT NULL REFERENCES enquiries (id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  admin_user_id uuid REFERENCES admin_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enquiry_idempotency_keys (
  idempotency_key text PRIMARY KEY,
  request_hash text NOT NULL,
  enquiry_id uuid NOT NULL REFERENCES enquiries (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enquiry_number_counters (
  day date PRIMARY KEY,
  last_value integer NOT NULL CHECK (last_value > 0)
);

CREATE INDEX IF NOT EXISTS products_category_id_idx ON products (category_id);
CREATE INDEX IF NOT EXISTS products_budget_band_idx ON products (budget_band);
CREATE INDEX IF NOT EXISTS products_active_idx ON products (active);
CREATE INDEX IF NOT EXISTS products_just_in_idx ON products (just_in) WHERE just_in;
CREATE INDEX IF NOT EXISTS products_fast_selling_idx ON products (fast_selling) WHERE fast_selling;
CREATE INDEX IF NOT EXISTS product_images_product_id_idx ON product_images (product_id);
CREATE INDEX IF NOT EXISTS product_occasions_occasion_id_idx ON product_occasions (occasion_id);
CREATE INDEX IF NOT EXISTS product_customisation_option_id_idx
  ON product_customisation_options (customisation_option_id);
CREATE INDEX IF NOT EXISTS enquiries_status_created_at_idx ON enquiries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS enquiries_created_at_idx ON enquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS enquiries_source_idx ON enquiries (source);
CREATE INDEX IF NOT EXISTS enquiries_occasion_label_idx ON enquiries (occasion_label);
CREATE INDEX IF NOT EXISTS enquiries_email_idx ON enquiries (email);
CREATE INDEX IF NOT EXISTS enquiry_items_enquiry_id_idx ON enquiry_items (enquiry_id);
CREATE INDEX IF NOT EXISTS enquiry_items_product_id_idx ON enquiry_items (product_id);
CREATE INDEX IF NOT EXISTS enquiry_status_events_enquiry_id_idx ON enquiry_status_events (enquiry_id);
