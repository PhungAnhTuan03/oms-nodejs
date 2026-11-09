import { useQuery } from '@tanstack/react-query';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, formatVnd } from '../api';

interface RevenueRow { day: string; revenue: number; avg7d: number }
interface TopRow { id: number; name: string; sold: number; revenue: number }

export default function ReportsPage() {
  const revenue = useQuery({
    queryKey: ['revenue'],
    queryFn: async () => (await api.get<RevenueRow[]>('/reports/revenue', { params: { days: 30 } })).data,
  });
  const top = useQuery({
    queryKey: ['top-products'],
    queryFn: async () => (await api.get<TopRow[]>('/reports/top-products')).data,
  });

  return (
    <div className="space-y-6">
      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-bold">Doanh thu 30 ngày</h2>
        <div className="h-80">
          <ResponsiveContainer>
            <LineChart data={revenue.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tickFormatter={(v: number) => `${Math.round(v / 1_000_000)}tr`} />
              <Tooltip formatter={(v) => formatVnd(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Doanh thu" stroke="#111827" dot={false} />
              <Line type="monotone" dataKey="avg7d" name="TB 7 ngày" stroke="#dc2626" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-bold">Top sản phẩm bán chạy (30 ngày)</h2>
        <table className="w-full text-sm">
          <thead className="text-left"><tr><th className="p-2">Sản phẩm</th><th className="p-2">Đã bán</th><th className="p-2">Doanh thu</th></tr></thead>
          <tbody>
            {top.data?.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-2">{t.name}</td><td className="p-2">{t.sold}</td><td className="p-2">{formatVnd(t.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
