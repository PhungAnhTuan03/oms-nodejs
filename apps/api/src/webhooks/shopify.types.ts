export interface ShopifyLineItem {
  sku: string | null;
  quantity: number;
  price: string; // Shopify gửi giá dạng chuỗi, ví dụ "249000.00"
}

export interface ShopifyOrderPayload {
  id: number;
  line_items: ShopifyLineItem[];
}
