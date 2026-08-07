-- Migration: Add tenant_id to catalog tables
-- Run this script to migrate existing data to multi-tenant structure

-- Add tenant_id column to categories (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN tenant_id text NOT NULL DEFAULT 'default';
  END IF;
END $$;

-- Add tenant_id column to products (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE products ADD COLUMN tenant_id text NOT NULL DEFAULT 'default';
  END IF;
END $$;

-- Add tenant_id column to orders (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN tenant_id text NOT NULL DEFAULT 'default';
  END IF;
END $$;

-- Add tenant_id column to users (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE users ADD COLUMN tenant_id text NOT NULL DEFAULT 'default';
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- Update primary keys to include tenant_id
-- Categories: change primary key from (name) to (name, tenant_id)
DO $$
BEGIN
  -- Drop existing primary key if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'categories_pkey' AND conrelid = 'categories'::regclass
  ) THEN
    ALTER TABLE categories DROP CONSTRAINT categories_pkey;
  END IF;
  
  -- Add composite primary key
  ALTER TABLE categories ADD PRIMARY KEY (name, tenant_id);
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Products: change primary key from (id) to (id, tenant_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'products_pkey' AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products DROP CONSTRAINT products_pkey;
  END IF;
  
  ALTER TABLE products ADD PRIMARY KEY (id, tenant_id);
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Update foreign key in products to reference categories with tenant
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'products_category_name_fkey' AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products DROP CONSTRAINT products_category_name_fkey;
  END IF;
  
  ALTER TABLE products ADD CONSTRAINT products_category_fk 
    FOREIGN KEY (category_name, tenant_id) 
    REFERENCES categories(name, tenant_id) 
    ON UPDATE CASCADE;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Update unique constraint on users email to include tenant_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_email_key' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_email_key;
  END IF;
  
  ALTER TABLE users ADD CONSTRAINT users_email_tenant_unique 
    UNIQUE (email, tenant_id);
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Insert default tenant if not exists
INSERT INTO tenants (id, name, created_at) 
VALUES ('default', 'Default Tenant', now())
ON CONFLICT (id) DO NOTHING;

-- Log completion
DO $$ BEGIN RAISE NOTICE 'Migration completed: tenant_id added to all catalog tables'; END $$;
