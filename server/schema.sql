create table if not exists orders (
  id integer primary key,
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

create table if not exists categories (
  name text primary key,
  menu_enabled boolean not null default false,
  pos_enabled boolean not null default false,
  sort_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id text primary key,
  name text not null,
  price numeric(10, 2) not null,
  category_name text not null references categories(name) on update cascade,
  description text not null,
  image text not null,
  available boolean not null default true,
  sort_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists categories_sort_index_idx on categories (sort_index);
create index if not exists products_sort_index_idx on products (sort_index);

create table if not exists users (
  id bigserial primary key,
  name text not null,
  role text not null,
  role_key text not null default 'operator',
  shift text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists auth_sessions (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  refresh_token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
