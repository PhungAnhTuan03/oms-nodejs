import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyShopifyHmac } from './shopify-hmac.js';

const SECRET = 'secret';
const body = Buffer.from('{"id":1}');
const sign = (b: Buffer, s = SECRET) => createHmac('sha256', s).update(b).digest('base64');

describe('verifyShopifyHmac', () => {
  it('chữ ký đúng => true', () => {
    expect(verifyShopifyHmac(body, sign(body), SECRET)).toBe(true);
  });

  it('sai secret => false', () => {
    expect(verifyShopifyHmac(body, sign(body, 'khac'), SECRET)).toBe(false);
  });

  it('nội dung bị sửa => false', () => {
    expect(verifyShopifyHmac(Buffer.from('{"id":2}'), sign(body), SECRET)).toBe(false);
  });

  it('thiếu header hoặc thiếu body => false', () => {
    expect(verifyShopifyHmac(body, undefined, SECRET)).toBe(false);
    expect(verifyShopifyHmac(undefined, sign(body), SECRET)).toBe(false);
  });

  it('chữ ký độ dài khác => false, không ném lỗi', () => {
    expect(verifyShopifyHmac(body, 'abc', SECRET)).toBe(false);
  });
});
