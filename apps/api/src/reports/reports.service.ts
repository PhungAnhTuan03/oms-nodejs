import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // Doanh thu từng ngày + trung bình trượt 7 ngày; ngày không có đơn vẫn hiện với doanh thu 0
  revenueByDay(days: number) {
    return this.prisma.$queryRaw<{ day: string; revenue: number; avg7d: number }[]>`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - make_interval(days => ${days}::int - 1),
          date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh'),
          interval '1 day'
        ) AS day
      ),
      daily AS (
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') AS day,
               SUM(total) AS revenue
        FROM "Order"
        WHERE status <> 'CANCELLED'
          AND "createdAt" >= now() - make_interval(days => ${days}::int + 1)
        GROUP BY 1
      )
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
             COALESCE(daily.revenue, 0)::float8 AS revenue,
             ROUND(AVG(COALESCE(daily.revenue, 0))
                   OVER (ORDER BY d.day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW))::float8 AS "avg7d"
      FROM days d
      LEFT JOIN daily ON daily.day = d.day
      ORDER BY d.day`;
  }

  topProducts(days: number, limit: number) {
    return this.prisma.$queryRaw<{ id: number; name: string; sold: number; revenue: number }[]>`
      SELECT p.id, p.name,
             SUM(oi.quantity)::int AS sold,
             SUM(oi.quantity * oi."unitPrice")::float8 AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o   ON o.id = oi."orderId" AND o.status <> 'CANCELLED'
      JOIN "Variant" v ON v.id = oi."variantId"
      JOIN "Product" p ON p.id = v."productId"
      WHERE o."createdAt" >= now() - make_interval(days => ${days}::int)
      GROUP BY p.id, p.name
      ORDER BY sold DESC
      LIMIT ${limit}::int`;
  }
}
