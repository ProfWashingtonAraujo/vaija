export type OrderStatus =
  | 'Pendente'
  | 'Em preparo'
  | 'Em producao'
  | 'Saiu para entrega'
  | 'Entregue'
  | 'Cancelado'
  | 'Pronto para retirada'

export type Order = {
  id: number
  customer: string
  phone: string
  address: string
  source?: 'Mesa' | 'Online'
  tableNumber?: string
  deliveryFee?: number
  items: string[]
  elapsed: string
  value: number
  status: OrderStatus
  payment: 'Pix' | 'Cartão' | 'Dinheiro'
  time: string
  notes?: string
}

export const orders: Order[] = [
  {
    id: 4852,
    customer: 'Ricardo Oliveira',
    phone: '(11) 99999-4852',
    address: 'Rua das Oliveiras, 72',
    source: 'Online',
    deliveryFee: 8,
    items: ['Pepperoni Premium', 'Coca-Cola 600ml'],
    elapsed: '8 min',
    value: 84.9,
    status: 'Em producao',
    payment: 'Pix',
    time: '19:42',
  },
  {
    id: 4851,
    customer: 'Maria Paula',
    phone: '(11) 99888-4851',
    address: 'Av. Central, 145',
    source: 'Online',
    deliveryFee: 8,
    items: ['Trufa & Cogumelos', 'Coca-Cola 2L'],
    elapsed: '16 min',
    value: 112,
    status: 'Pendente',
    payment: 'Cartão',
    time: '19:35',
  },
  {
    id: 4850,
    customer: 'Carlos Eduardo',
    phone: '(11) 97777-4850',
    address: 'Rua Nobre, 231',
    source: 'Mesa',
    tableNumber: '12',
    deliveryFee: 0,
    items: ['Margherita D.O.P', 'Quattro Formaggi + Mel'],
    elapsed: '21 min',
    value: 96.5,
    status: 'Pronto para retirada',
    payment: 'Dinheiro',
    time: '19:21',
  },
  {
    id: 4849,
    customer: 'Mariana Souza',
    phone: '(11) 96666-4849',
    address: 'Alameda Aurora, 52',
    source: 'Online',
    deliveryFee: 8,
    items: ['Burger da Casa', 'Coca-Cola 600ml'],
    elapsed: '5 min',
    value: 43.4,
    status: 'Pendente',
    payment: 'Pix',
    time: '19:50',
  },
  {
    id: 4848,
    customer: 'Beatriz Ramos',
    phone: '(11) 95555-4848',
    address: 'Rua das Flores, 900',
    source: 'Mesa',
    tableNumber: '05',
    deliveryFee: 0,
    items: ['Calabresa Gourmet', 'Coca-Cola 2L'],
    elapsed: '14 min',
    value: 75,
    status: 'Em producao',
    payment: 'Cartão',
    time: '19:30',
  },
]
