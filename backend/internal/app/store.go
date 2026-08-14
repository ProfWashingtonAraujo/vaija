package app

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() { s.pool.Close() }

func (s *Store) Initialize(ctx context.Context, seedDemoData bool) error {
	statements := []string{
		`create table if not exists users (
			id bigserial primary key, tenant_id text not null default 'default', name text not null,
			role text not null, role_key text not null default 'operator', shift text not null,
			email text not null, password_hash text not null,
			created_at timestamptz not null default now(), updated_at timestamptz not null default now())`,
		`create index if not exists users_tenant_idx on users (tenant_id)`,
		`alter table users drop constraint if exists users_email_key`,
		`create unique index if not exists users_tenant_email_idx on users (tenant_id, lower(email))`,
		`alter table users add column if not exists role_key text not null default 'operator'`,
		`update users set role_key='admin', role='Administrador' where lower(email)=lower('contato@taperaspizzaria.com.br') and role_key='operator'`,
		`create table if not exists auth_sessions (
			id bigserial primary key, user_id bigint not null references users(id) on delete cascade,
			refresh_token_hash text not null unique, expires_at timestamptz not null,
			created_at timestamptz not null default now())`,
		`create table if not exists categories (
			name text not null, tenant_id text not null default 'default', menu_enabled boolean not null default false,
			pos_enabled boolean not null default false, sort_index integer not null,
			created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
			primary key (name, tenant_id))`,
		`create index if not exists categories_tenant_idx on categories (tenant_id)`,
		`create index if not exists categories_sort_index_idx on categories (sort_index)`,
		`create table if not exists products (
			id text not null, tenant_id text not null default 'default', name text not null,
			price numeric(10,2) not null, category_name text not null, description text not null,
			image text not null, available boolean not null default true, size_prices jsonb not null default '[]'::jsonb, sort_index integer not null,
			created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
			primary key (id, tenant_id))`,
		`alter table products add column if not exists size_prices jsonb not null default '[]'::jsonb`,
		`create index if not exists products_tenant_idx on products (tenant_id)`,
		`create index if not exists products_sort_index_idx on products (sort_index)`,
		`create table if not exists orders (
			id integer not null, tenant_id text not null default 'default', customer text not null,
			phone text not null, address text not null, items jsonb not null, elapsed text not null,
			value numeric(10,2) not null, status text not null, payment text not null, time text not null,
			source text not null default 'Online', table_number jsonb, delivery_fee numeric(10,2), notes text not null default '',
			sort_index integer not null, created_at timestamptz not null default now(),
			updated_at timestamptz not null default now(), primary key (id, tenant_id))`,
		`alter table orders add column if not exists source text not null default 'Online'`,
		`alter table orders add column if not exists table_number jsonb`,
		`alter table orders add column if not exists delivery_fee numeric(10,2)`,
		`alter table orders add column if not exists notes text not null default ''`,
		`do $$ begin
			if exists (
				select 1 from pg_constraint
				where conrelid = 'orders'::regclass and contype = 'p'
				and pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
			) then
				alter table orders drop constraint orders_pkey;
				alter table orders add constraint orders_pkey primary key (id, tenant_id);
			end if;
		end $$`,
		`create index if not exists orders_tenant_idx on orders (tenant_id)`,
		`create index if not exists orders_sort_index_idx on orders (sort_index)`,
	}
	for _, statement := range statements {
		if _, err := s.pool.Exec(ctx, statement); err != nil {
			return err
		}
	}
	if seedDemoData {
		return s.seed(ctx)
	}
	return nil
}

func (s *Store) EnsureBootstrapAdmin(ctx context.Context, email, password string) error {
	if email == "" || password == "" {
		return nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `insert into users (tenant_id,name,role,role_key,shift,email,password_hash)
		values ('admin','Administrador SaaS','Administrador SaaS','admin','Administracao Vaija',$1,$2)
		on conflict (tenant_id,lower(email)) do update set password_hash=excluded.password_hash,updated_at=now()`, strings.ToLower(email), string(hash))
	return err
}

func (s *Store) seed(ctx context.Context) error {
	var userCount int
	if err := s.pool.QueryRow(ctx, `select count(*) from users`).Scan(&userCount); err != nil {
		return err
	}
	if userCount == 0 {
		users := []struct{ name, role, roleKey, shift, email string }{
			{"Washington", "Administrador", "admin", "Caixa 01 - Aberto", "contato@taperaspizzaria.com.br"},
			{"Gerente Teste", "Gerente", "manager", "Gerencia - Aberto", "gerente@taperaspizzaria.com.br"},
			{"Operador Teste", "Operador", "operator", "Caixa 02 - Aberto", "operador@taperaspizzaria.com.br"},
		}
		for _, user := range users {
			hash, err := bcrypt.GenerateFromPassword([]byte("123456"), 10)
			if err != nil {
				return err
			}
			if _, err := s.pool.Exec(ctx, `insert into users (tenant_id,name,role,role_key,shift,email,password_hash) values ('default',$1,$2,$3,$4,$5,$6)`, user.name, user.role, user.roleKey, user.shift, user.email, string(hash)); err != nil {
				return err
			}
		}
	}

	var categoryCount, productCount int
	if err := s.pool.QueryRow(ctx, `select count(*) from categories`).Scan(&categoryCount); err != nil {
		return err
	}
	if err := s.pool.QueryRow(ctx, `select count(*) from products`).Scan(&productCount); err != nil {
		return err
	}
	if categoryCount == 0 || productCount == 0 {
		categories := []Category{
			{Name: "Pizzas Especiais", MenuEnabled: false, POSEnabled: true},
			{Name: "Pizzas Doces", MenuEnabled: true, POSEnabled: true},
			{Name: "Hamburgueres", MenuEnabled: false, POSEnabled: true},
			{Name: "Bebidas", MenuEnabled: true, POSEnabled: true},
			{Name: "Pizzas Salgadas", MenuEnabled: true, POSEnabled: false},
		}
		products := initialProducts()
		tx, err := s.pool.Begin(ctx)
		if err != nil {
			return err
		}
		defer tx.Rollback(ctx)
		for i, category := range categories {
			if _, err := tx.Exec(ctx, `insert into categories (name,tenant_id,menu_enabled,pos_enabled,sort_index) values ($1,'default',$2,$3,$4) on conflict (name,tenant_id) do update set menu_enabled=excluded.menu_enabled,pos_enabled=excluded.pos_enabled,sort_index=excluded.sort_index`, category.Name, category.MenuEnabled, category.POSEnabled, i); err != nil {
				return err
			}
		}
		for i, product := range products {
			if err := upsertProduct(ctx, tx, product, i, "default"); err != nil {
				return err
			}
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}

	var orderCount int
	if err := s.pool.QueryRow(ctx, `select count(*) from orders`).Scan(&orderCount); err != nil {
		return err
	}
	if orderCount == 0 {
		tx, err := s.pool.Begin(ctx)
		if err != nil {
			return err
		}
		defer tx.Rollback(ctx)
		for i, order := range initialOrders() {
			if err := upsertOrder(ctx, tx, order, i, "default"); err != nil {
				return err
			}
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) UserByEmail(ctx context.Context, email, tenant string, global bool) (User, error) {
	query := `select id,name,role,role_key,shift,email,tenant_id,password_hash from users where lower(email)=lower($1) and tenant_id=$2 limit 1`
	args := []any{email, tenant}
	if global {
		query, args = `select id,name,role,role_key,shift,email,tenant_id,password_hash from users where lower(email)=lower($1) limit 1`, []any{email}
	}
	var user User
	err := s.pool.QueryRow(ctx, query, args...).Scan(&user.ID, &user.Name, &user.Role, &user.RoleKey, &user.Shift, &user.Email, &user.TenantID, &user.PasswordHash)
	user.Permissions = permissions(user.RoleKey)
	return user, err
}

func (s *Store) UserByID(ctx context.Context, id int64, tenant string, password bool) (User, error) {
	query := `select id,name,role,role_key,shift,email,tenant_id from users where id=$1 and tenant_id=$2 limit 1`
	var user User
	var err error
	if password {
		err = s.pool.QueryRow(ctx, `select id,name,role,role_key,shift,email,tenant_id,password_hash from users where id=$1 and tenant_id=$2 limit 1`, id, tenant).Scan(&user.ID, &user.Name, &user.Role, &user.RoleKey, &user.Shift, &user.Email, &user.TenantID, &user.PasswordHash)
	} else {
		err = s.pool.QueryRow(ctx, query, id, tenant).Scan(&user.ID, &user.Name, &user.Role, &user.RoleKey, &user.Shift, &user.Email, &user.TenantID)
	}
	user.Permissions = permissions(user.RoleKey)
	return user, err
}

func (s *Store) Users(ctx context.Context, tenant string) ([]User, error) {
	rows, err := s.pool.Query(ctx, `select id,name,role,role_key,shift,email,tenant_id from users where tenant_id=$1 order by id`, tenant)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := []User{}
	for rows.Next() {
		var user User
		if err := rows.Scan(&user.ID, &user.Name, &user.Role, &user.RoleKey, &user.Shift, &user.Email, &user.TenantID); err != nil {
			return nil, err
		}
		user.Permissions = permissions(user.RoleKey)
		users = append(users, user)
	}
	return users, rows.Err()
}

func (s *Store) CreateUser(ctx context.Context, user User) (User, error) {
	err := s.pool.QueryRow(ctx, `insert into users (tenant_id,name,role,role_key,shift,email,password_hash) values ($1,$2,$3,$4,$5,$6,$7) returning id`, user.TenantID, user.Name, user.Role, user.RoleKey, user.Shift, user.Email, user.PasswordHash).Scan(&user.ID)
	user.Permissions = permissions(user.RoleKey)
	return user, err
}

func (s *Store) UpdatePassword(ctx context.Context, id int64, tenant, hash string) error {
	_, err := s.pool.Exec(ctx, `update users set password_hash=$1,updated_at=now() where id=$2 and tenant_id=$3`, hash, id, tenant)
	return err
}

func refreshHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (s *Store) CreateSession(ctx context.Context, userID int64, token string, expires time.Time) error {
	_, err := s.pool.Exec(ctx, `insert into auth_sessions (user_id,refresh_token_hash,expires_at) values ($1,$2,$3)`, userID, refreshHash(token), expires)
	return err
}

func (s *Store) RotateSession(ctx context.Context, token string) (User, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return User{}, err
	}
	defer tx.Rollback(ctx)
	var sessionID int64
	var expires time.Time
	var user User
	err = tx.QueryRow(ctx, `select s.id,s.expires_at,u.id,u.name,u.role,u.role_key,u.shift,u.email,u.tenant_id from auth_sessions s join users u on u.id=s.user_id where s.refresh_token_hash=$1 for update`, refreshHash(token)).Scan(&sessionID, &expires, &user.ID, &user.Name, &user.Role, &user.RoleKey, &user.Shift, &user.Email, &user.TenantID)
	if err != nil {
		return User{}, err
	}
	if !expires.After(time.Now()) {
		return User{}, pgx.ErrNoRows
	}
	if _, err := tx.Exec(ctx, `delete from auth_sessions where id=$1`, sessionID); err != nil {
		return User{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return User{}, err
	}
	user.Permissions = permissions(user.RoleKey)
	return user, nil
}

func (s *Store) DeleteSession(ctx context.Context, token string) error {
	_, err := s.pool.Exec(ctx, `delete from auth_sessions where refresh_token_hash=$1`, refreshHash(token))
	return err
}

func (s *Store) Categories(ctx context.Context, tenant string) ([]Category, error) {
	rows, err := s.pool.Query(ctx, `select name,menu_enabled,pos_enabled,tenant_id from categories where tenant_id=$1 order by sort_index,name`, tenant)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Category{}
	for rows.Next() {
		var category Category
		if err := rows.Scan(&category.Name, &category.MenuEnabled, &category.POSEnabled, &category.TenantID); err != nil {
			return nil, err
		}
		result = append(result, category)
	}
	return result, rows.Err()
}

func (s *Store) ReplaceCategories(ctx context.Context, categories []Category, tenant string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	names := make([]string, len(categories))
	for i, category := range categories {
		names[i] = category.Name
		if _, err := tx.Exec(ctx, `insert into categories (name,tenant_id,menu_enabled,pos_enabled,sort_index) values ($1,$2,$3,$4,$5) on conflict (name,tenant_id) do update set menu_enabled=excluded.menu_enabled,pos_enabled=excluded.pos_enabled,sort_index=excluded.sort_index`, category.Name, tenant, category.MenuEnabled, category.POSEnabled, i); err != nil {
			return err
		}
	}
	if len(names) == 0 {
		_, err = tx.Exec(ctx, `delete from categories where tenant_id=$1`, tenant)
	} else {
		_, err = tx.Exec(ctx, `delete from categories where tenant_id=$1 and not (name=any($2::text[]))`, tenant, names)
	}
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) Products(ctx context.Context, tenant string) ([]Product, error) {
	rows, err := s.pool.Query(ctx, `select id,name,price,category_name,description,image,available,size_prices,tenant_id from products where tenant_id=$1 order by sort_index,id`, tenant)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Product{}
	for rows.Next() {
		var product Product
		var available bool
		var sizePrices []byte
		if err := rows.Scan(&product.ID, &product.Name, &product.Price, &product.Category, &product.Description, &product.Image, &available, &sizePrices, &product.TenantID); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(sizePrices, &product.SizePrices); err != nil {
			return nil, err
		}
		product.Available = &available
		result = append(result, product)
	}
	return result, rows.Err()
}

func upsertProduct(ctx context.Context, tx pgx.Tx, product Product, index int, tenant string) error {
	sizePrices, err := json.Marshal(product.SizePrices)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `insert into products (id,tenant_id,name,price,category_name,description,image,available,size_prices,sort_index) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) on conflict (id,tenant_id) do update set name=excluded.name,price=excluded.price,category_name=excluded.category_name,description=excluded.description,image=excluded.image,available=excluded.available,size_prices=excluded.size_prices,sort_index=excluded.sort_index,updated_at=now()`, product.ID, tenant, product.Name, product.Price, product.Category, product.Description, product.Image, *product.Available, sizePrices, index)
	return err
}

func (s *Store) ReplaceProducts(ctx context.Context, products []Product, tenant string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	ids := make([]string, len(products))
	for i, product := range products {
		ids[i] = product.ID
		if err := upsertProduct(ctx, tx, product, i, tenant); err != nil {
			return err
		}
	}
	if len(ids) == 0 {
		_, err = tx.Exec(ctx, `delete from products where tenant_id=$1`, tenant)
	} else {
		_, err = tx.Exec(ctx, `delete from products where tenant_id=$1 and not (id=any($2::text[]))`, tenant, ids)
	}
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) Orders(ctx context.Context, tenant string) ([]Order, error) {
	rows, err := s.pool.Query(ctx, `select id,customer,phone,address,items,elapsed,value,status,payment,time,source,table_number,delivery_fee,notes,tenant_id from orders where tenant_id=$1 order by sort_index,id desc`, tenant)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Order{}
	for rows.Next() {
		var order Order
		var tableNumber []byte
		if err := rows.Scan(&order.ID, &order.Customer, &order.Phone, &order.Address, &order.Items, &order.Elapsed, &order.Value, &order.Status, &order.Payment, &order.Time, &order.Source, &tableNumber, &order.DeliveryFee, &order.Notes, &order.TenantID); err != nil {
			return nil, err
		}
		if len(tableNumber) > 0 {
			if err := json.Unmarshal(tableNumber, &order.TableNumber); err != nil {
				return nil, err
			}
		}
		result = append(result, order)
	}
	return result, rows.Err()
}

func upsertOrder(ctx context.Context, tx pgx.Tx, order Order, index int, tenant string) error {
	tableNumber, err := json.Marshal(order.TableNumber)
	if err != nil {
		return err
	}
	if order.Source == "" {
		order.Source = "Online"
	}
	_, err = tx.Exec(ctx, `insert into orders (id,tenant_id,customer,phone,address,items,elapsed,value,status,payment,time,source,table_number,delivery_fee,notes,sort_index) values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16) on conflict (id,tenant_id) do update set customer=excluded.customer,phone=excluded.phone,address=excluded.address,items=excluded.items,elapsed=excluded.elapsed,value=excluded.value,status=excluded.status,payment=excluded.payment,time=excluded.time,source=excluded.source,table_number=excluded.table_number,delivery_fee=excluded.delivery_fee,notes=excluded.notes,sort_index=excluded.sort_index,updated_at=now()`, order.ID, tenant, order.Customer, order.Phone, order.Address, order.Items, order.Elapsed, order.Value, order.Status, order.Payment, order.Time, order.Source, tableNumber, order.DeliveryFee, order.Notes, index)
	return err
}

func (s *Store) ReplaceOrders(ctx context.Context, orders []Order, tenant string) (changed, added []Order, err error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback(ctx)
	rows, err := tx.Query(ctx, `select id,status from orders where tenant_id=$1`, tenant)
	if err != nil {
		return nil, nil, err
	}
	previous := map[int]string{}
	for rows.Next() {
		var id int
		var status string
		if err := rows.Scan(&id, &status); err != nil {
			rows.Close()
			return nil, nil, err
		}
		previous[id] = status
	}
	rows.Close()
	ids := make([]int, len(orders))
	for i, order := range orders {
		ids[i] = order.ID
		old, exists := previous[order.ID]
		if !exists {
			added = append(added, order)
		}
		if !exists || old != order.Status {
			changed = append(changed, order)
		}
		if err := upsertOrder(ctx, tx, order, i, tenant); err != nil {
			return nil, nil, err
		}
	}
	if len(ids) == 0 {
		_, err = tx.Exec(ctx, `delete from orders where tenant_id=$1`, tenant)
	} else {
		_, err = tx.Exec(ctx, `delete from orders where tenant_id=$1 and not (id=any($2::int[]))`, tenant, ids)
	}
	if err != nil {
		return nil, nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, nil, err
	}
	return changed, added, nil
}

func (s *Store) UpdateOrderStatus(ctx context.Context, id int, tenant, status string) (Order, error) {
	command, err := s.pool.Exec(ctx, `update orders set status=$1,updated_at=now() where id=$2 and tenant_id=$3`, status, id, tenant)
	if err != nil {
		return Order{}, err
	}
	if command.RowsAffected() == 0 {
		return Order{}, pgx.ErrNoRows
	}
	orders, err := s.Orders(ctx, tenant)
	if err != nil {
		return Order{}, err
	}
	for _, order := range orders {
		if order.ID == id {
			return order, nil
		}
	}
	return Order{}, pgx.ErrNoRows
}

func (s *Store) CreateOrder(ctx context.Context, order Order, tenant string) (Order, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Order{}, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `select pg_advisory_xact_lock(hashtext($1))`, tenant); err != nil {
		return Order{}, err
	}
	if err := tx.QueryRow(ctx, `select coalesce(max(id),0)+1 from orders where tenant_id=$1`, tenant).Scan(&order.ID); err != nil {
		return Order{}, err
	}
	if _, err := tx.Exec(ctx, `update orders set sort_index=sort_index+1 where tenant_id=$1`, tenant); err != nil {
		return Order{}, err
	}
	if err := upsertOrder(ctx, tx, order, 0, tenant); err != nil {
		return Order{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Order{}, err
	}
	order.TenantID = tenant
	return order, nil
}

func (s *Store) FindOrders(ctx context.Context, tenant, query string) ([]Order, error) {
	orders, err := s.Orders(ctx, tenant)
	if err != nil {
		return nil, err
	}
	queryID, idQueryErr := strconv.Atoi(query)
	queryPhone := nonDigits.ReplaceAllString(query, "")
	result := []Order{}
	for _, order := range orders {
		if idQueryErr == nil {
			if order.ID == queryID {
				result = append(result, order)
			}
			continue
		}
		phone := nonDigits.ReplaceAllString(order.Phone, "")
		if len(queryPhone) >= 8 && strings.Contains(phone, queryPhone) {
			result = append(result, order)
		}
	}
	return result, nil
}

func initialProducts() []Product {
	available, unavailable := true, false
	return []Product{
		{ID: "prod-1", Name: "Pepperoni Premium", Price: 64.9, Category: "Pizzas Especiais", Description: "Molho italiano, pepperoni artesanal e blend especial de queijos.", Image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80", Available: &available},
		{ID: "prod-2", Name: "Trufa & Cogumelos", Price: 89, Category: "Pizzas Especiais", Description: "Shiitake, champignon paris e toque de azeite trufado.", Image: "https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?auto=format&fit=crop&w=800&q=80", Available: &available},
		{ID: "prod-3", Name: "Margherita D.O.P", Price: 58, Category: "Pizzas Salgadas", Description: "Mozzarella premium, tomate confit e manjericao fresco.", Image: "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=800&q=80", Available: &available},
		{ID: "prod-4", Name: "Quattro Formaggi + Mel", Price: 72.5, Category: "Pizzas Especiais", Description: "Mix de quatro queijos nobres finalizado com mel picante.", Image: "https://images.unsplash.com/photo-1594007654729-407eedc4be65?auto=format&fit=crop&w=800&q=80", Available: &available},
		{ID: "prod-5", Name: "Coca-Cola 600ml", Price: 8.5, Category: "Bebidas", Description: "Gelada e pronta para acompanhar qualquer pedido.", Image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80", Available: &available},
		{ID: "prod-6", Name: "Chocolate & Morango", Price: 52, Category: "Pizzas Doces", Description: "Ganache cremoso, morangos frescos e raspas especiais.", Image: "https://images.unsplash.com/photo-1519864600265-abb23847ef2c?auto=format&fit=crop&w=800&q=80", Available: &unavailable},
		{ID: "prod-7", Name: "Calabresa Gourmet", Price: 61, Category: "Pizzas Salgadas", Description: "Calabresa premium, cebola roxa e cobertura generosa.", Image: "https://images.unsplash.com/photo-1511689660979-10d2b1aada49?auto=format&fit=crop&w=800&q=80", Available: &available},
		{ID: "prod-8", Name: "Burger da Casa", Price: 34.9, Category: "Hamburgueres", Description: "Pao brioche, carne angus, cheddar e maionese da casa.", Image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80", Available: &available},
		{ID: "prod-9", Name: "Coca-Cola 2L", Price: 14, Category: "Bebidas", Description: "Ideal para pedidos em familia.", Image: "https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=800&q=80", Available: &available},
	}
}

func initialOrders() []Order {
	return []Order{
		{ID: 4852, Customer: "Ricardo Oliveira", Phone: "(11) 99999-4852", Address: "Rua das Oliveiras, 72", Items: []byte(`["Pepperoni Premium","Coca-Cola 600ml"]`), Elapsed: "8 min", Value: 84.9, Status: "Em producao", Payment: "Pix", Time: "19:42"},
		{ID: 4851, Customer: "Maria Paula", Phone: "(11) 99888-4851", Address: "Av. Central, 145", Items: []byte(`["Trufa & Cogumelos","Coca-Cola 2L"]`), Elapsed: "16 min", Value: 112, Status: "Pendente", Payment: "Cartao", Time: "19:35"},
		{ID: 4850, Customer: "Carlos Eduardo", Phone: "(11) 97777-4850", Address: "Rua Nobre, 231", Items: []byte(`["Margherita D.O.P","Quattro Formaggi + Mel"]`), Elapsed: "21 min", Value: 96.5, Status: "Pronto para retirada", Payment: "Dinheiro", Time: "19:21"},
		{ID: 4849, Customer: "Mariana Souza", Phone: "(11) 96666-4849", Address: "Alameda Aurora, 52", Items: []byte(`["Burger da Casa","Coca-Cola 600ml"]`), Elapsed: "5 min", Value: 43.4, Status: "Pendente", Payment: "Pix", Time: "19:50"},
		{ID: 4848, Customer: "Beatriz Ramos", Phone: "(11) 95555-4848", Address: "Rua das Flores, 900", Items: []byte(`["Calabresa Gourmet","Coca-Cola 2L"]`), Elapsed: "14 min", Value: 75, Status: "Em producao", Payment: "Cartao", Time: "19:30"},
	}
}
