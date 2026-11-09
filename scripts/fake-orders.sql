-- 200.000 đơn rải đều trong 90 ngày
INSERT INTO "Order" (total, status, "createdAt")
SELECT 0,
       (ARRAY['PAID','PAID','PAID','SHIPPED','CANCELLED'])[1 + floor(random() * 5)::int]::"OrderStatus",
       now() - random() * interval '90 days'
FROM generate_series(1, 200000);

-- Mỗi đơn 1–3 dòng hàng, biến thể chọn ngẫu nhiên
INSERT INTO "OrderItem" ("orderId", "variantId", quantity, "unitPrice")
SELECT o.id, v.id, 1 + floor(random() * 3)::int, v.price
FROM "Order" o
CROSS JOIN LATERAL (
  SELECT id, price FROM "Variant"
  ORDER BY random() + o.id * 0
  LIMIT 1 + floor(random() * 3)::int
) v
WHERE o.total = 0 AND o."shopifyOrderId" IS NULL;

-- Tính lại tổng tiền
UPDATE "Order" o
SET total = s.sum
FROM (SELECT "orderId", SUM(quantity * "unitPrice") AS sum FROM "OrderItem" GROUP BY "orderId") s
WHERE s."orderId" = o.id AND o.total = 0;

ANALYZE;
