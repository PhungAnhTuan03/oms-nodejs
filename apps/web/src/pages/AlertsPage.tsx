import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../api';

interface Alert { variantId: number; sku: string; name: string; available: number; avgDaily: number; reorderPoint: number }

export default function AlertsPage() {
  const alerts = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => (await api.get<Alert[]>('/inventory/alerts')).data,
  });

  if (alerts.isLoading) return <p>Đang tải...</p>;
  if (alerts.isError) return <p className="text-red-600">{errorMessage(alerts.error)}</p>;
  if (!alerts.data?.length) return <p>Không có biến thể nào sắp hết hàng.</p>;

  return (
    <div className="overflow-x-auto rounded border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 text-left">
          <tr><th className="p-2">Sản phẩm</th><th className="p-2">SKU</th><th className="p-2">Còn</th><th className="p-2">Bán TB/ngày</th><th className="p-2">Nên nhập khi ≤</th></tr>
        </thead>
        <tbody>
          {alerts.data.map((a) => (
            <tr key={a.variantId} className="border-t">
              <td className="p-2">{a.name}</td>
              <td className="p-2 font-mono">{a.sku}</td>
              <td className="p-2 font-bold text-red-600">{a.available}</td>
              <td className="p-2">{a.avgDaily.toFixed(2)}</td>
              <td className="p-2">{a.reorderPoint}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
