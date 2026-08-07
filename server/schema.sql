create table if not exists orders (
  id integer primary key,
  tenant_id text not null default 'default',
  customer text not null,
  phone text not null,
  address text not null,
  items jsonb not null,
  elapsed text not null,
  value numeric(10, 2) not null,
  status text not null,
  payment text not null,
  time text not null,
  sort_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_sort_index_idx on orders (sort_index);
create index if not exists orders_tenant_idx on orders (tenant_id);

create table if not exists categories (
  name text not null,
  tenant_id text not null default 'default',
  menu_enabled boolean not null default false,
  pos_enabled boolean not null default false,
  sort_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (name, tenant_id)
);

create table if not exists products (
  id text not null,
  tenant_id text not null default 'default',
  name text not null,
  price numeric(10, 2) not null,
  category_name text not null,
  description text not null,
  image text not null,
  available boolean not null default true,
  sort_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, tenant_id)
);

create index if not exists categories_sort_index_idx on categories (sort_index);
create index if not exists categories_tenant_idx on categories (tenant_id);
create index if not exists products_sort_index_idx on products (sort_index);
create index if not exists products_tenant_idx on products (tenant_id);

create table if not exists users (
  id bigserial primary key,
  tenant_id text not null default 'default',
  name text not null,
  role text not null,
  role_key text not null default 'operator',
  shift text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_tenant_idx on users (tenant_id);

create table if not exists auth_sessions (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  refresh_token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
