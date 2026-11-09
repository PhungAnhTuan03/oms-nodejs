import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyShopifyHmac(
  rawBody: Buffer | undefined,
  header: string | undefined,
  secret: string,
): boolean {
  if (!rawBody || !header || !secret) return false;
  const digest = createHmac('sha256', secret).update(rawBody).digest('base64');
  const a = Buffer.from(digest);
  const b = Buffer.from(header);
  // timingSafeEqual so sánh trong thời gian cố định, chống đoán chữ ký theo thời gian phản hồi
  return a.length === b.length && timingSafeEqual(a, b);
}
