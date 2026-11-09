import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage, formatVnd } from '../api';
import type { Order, Page } from '../types';

const STATUS_LABEL: Record<Order['status'], string> = {
  PENDING: 'Chờ xử lý', PAID: 'Đã thanh toán', CANCELLED: 'Đã huỷ', SHIPPED: 'Đã giao',
};

export default function OrdersPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [message, setMessage] = useState('');

  const orders = useInfiniteQuery({
    queryKey: ['orders', status],
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) =>
      (await api.get<Page<Order>>('/orders', {
        params: { limit: 20, cursor: pageParam ?? undefined, status: status || undefined },
      })).data,
    getNextPageParam: (last) => last.nextCursor,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['products'] });
  };

  const create = useMutation({
    mutationFn: () =>
      api.post<Order>('/orders', { items: [{ variantId: Number(variantId), quantity: Number(quantity) }] }),
    onSuccess: (res) => { setMessage(`Đã tạo đơn #${res.data.id}`); refresh(); },
    onError: (e) => setMessage(errorMessage(e)), // 409 hiện "Biến thể ... không đủ hàng"
  });

  const cancel = useMutation({
    mutationFn: (id: number) => api.patch(`/orders/${id}/cancel`),
    onSuccess: refresh,
    onError: (e) => alert(errorMessage(e)),
  });

  const items = orders.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded border bg-white p-4">
        <label className="text-sm">ID biến thể
          <input className="block w-28 rounded border px-2 py-1" value={variantId} onChange={(e) => setVariantId(e.target.value)} />
        </label>
        <label className="text-sm">Số lượng
          <input className="block w-20 rounded border px-2 py-1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <button onClick={() => create.mutate()} disabled={create.isPending || !variantId}
          className="rounded bg-gray-900 px-4 py-1.5 text-white disabled:opacity-50">Tạo đơn tại quầy</button>
        {message && <span className="text-sm">{message}</span>}
      </div>

      <select className="rounded border px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">Tất cả trạng thái</option>
        {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr><th className="p-2">#</th><th className="p-2">Thời gian</th><th className="p-2">Sản phẩm</th><th className="p-2">Tổng</th><th className="p-2">Trạng thái</th><th className="p-2" /></tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} className="border-t align-top">
                <td className="p-2">{o.id}{o.shopifyOrderId && <span className="ml-1 rounded bg-green-100 px-1 text-xs">Shopify</span>}</td>
                <td className="p-2">{new Date(o.createdAt).toLocaleString('vi-VN')}</td>
                <td className="p-2">{o.items.map((it) => <div key={it.id}>{it.variant.product.name} ({it.variant.sku}) × {it.quantity}</div>)}</td>
                <td className="p-2">{formatVnd(o.total)}</td>
                <td className="p-2">{STATUS_LABEL[o.status]}</td>
                <td className="p-2 text-right">
                  {(o.status === 'PENDING' || o.status === 'PAID') && (
                    <button onClick={() => confirm(`Huỷ đơn #${o.id}?`) && cancel.mutate(o.id)}
                      className="rounded border px-2 py-1 text-red-600 hover:bg-red-50">Huỷ</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {orders.hasNextPage && (
        <button onClick={() => orders.fetchNextPage()} className="w-full rounded border bg-white py-2 hover:bg-gray-100">Tải thêm</button>
      )}
    </div>
  );
}
