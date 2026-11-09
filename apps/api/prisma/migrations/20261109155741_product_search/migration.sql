CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent mặc định không phải IMMUTABLE nên không dùng được trong index/cột generated.
-- Bọc lại bằng một hàm khai báo IMMUTABLE.
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- Cột tự tính: tên sản phẩm bỏ dấu, tách thành các từ
ALTER TABLE "Product" ADD COLUMN "search" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', immutable_unaccent("name"))) STORED;

-- Index GIN giúp tìm kiếm full-text nhanh
CREATE INDEX "product_search_idx" ON "Product" USING GIN ("search");
