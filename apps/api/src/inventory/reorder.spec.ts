import { describe, expect, it } from 'vitest';
import { reorderPoint } from './reorder.js';

describe('reorderPoint', () => {
  it('bán 2 cái/ngày, chờ 7 ngày, an toàn 3 ngày => 20', () => {
    expect(reorderPoint(2)).toBe(20);
  });

  it('làm tròn lên', () => {
    expect(reorderPoint(0.25)).toBe(3); // 0.25 × 10 = 2.5 => 3
  });

  it('không bán gì => 0', () => {
    expect(reorderPoint(0)).toBe(0);
  });

  it('đổi được số ngày chờ hàng', () => {
    expect(reorderPoint(1, 14, 0)).toBe(14);
  });
});
