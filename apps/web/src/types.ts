export type Role = 'ADMIN' | 'STAFF';

export interface Inventory {
  variantId: number;
  available: number;
}

export interface Variant {
  id: number;
  sku: string;
  price: number;
  inventory: Inventory | null;
}

export interface Product {
  id: number;
  name: string;
  variants: Variant[];
}

export interface Page<T> {
  items: T[];
  nextCursor: number | null;
}

export interface OrderItem {
  id: number;
  variantId: number;
  quantity: number;
  unitPrice: number;
  variant: Variant & { product: Product };
}

export interface Order {
  id: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'SHIPPED';
  total: number;
  createdAt: string;
  shopifyOrderId: string | null;
  items: OrderItem[];
}
