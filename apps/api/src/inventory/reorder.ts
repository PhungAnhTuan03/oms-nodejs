// Điểm đặt hàng lại = bán trung bình/ngày × (số ngày chờ hàng về + số ngày tồn an toàn)
export function reorderPoint(avgDailySales: number, leadTimeDays = 7, safetyDays = 3): number {
  return Math.ceil(avgDailySales * (leadTimeDays + safetyDays));
}
