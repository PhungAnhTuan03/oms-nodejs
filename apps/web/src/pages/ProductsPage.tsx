import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage, formatVnd } from '../api';
import { getRole } from '../auth';
import type { Page, Product } from '../types';

export default function ProductsPage() {
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const isAdmin = getRole() === 'ADMIN';

  const products = useInfiniteQuery({
    queryKey: ['products', q],
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) =>
      (await api.get<Page<Product>>('/products', {
        params: { limit: 20, cursor: pageParam ?? undefined, q: q || undefined },
      })).data,
    getNextPageParam: (last) => last.nextCursor,
  });

  const adjust = useMutation({
    mutationFn: (v: { variantId: number; delta: number; reason: string }) =>
      api.post(`/inventory/${v.variantId}/adjust`, { delta: v.delta, reason: v.reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    onError: (e) => alert(errorMessage(e)),
  });

  function askAdjust(variantId: number) {
    const delta = Number(prompt('Số lượng thay đổi (ví dụ 20 hoặc -2):'));
    if (!delta) return;
    const reason = prompt('Lý do:') ?? '';
    adjust.mutate({ variantId, delta, reason });
  }

  const items = products.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className="flex-1 rounded border px-3 py-2" placeholder="Tìm sản phẩm, gõ không dấu cũng được"
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setQ(input.trim())} />
        <button onClick={() => setQ(input.trim())} className="rounded bg-gray-900 px-4 text-white">Tìm</button>
      </div>

      {products.isLoading && <p>Đang tải...</p>}
      {products.isError && <p className="text-red-600">{errorMessage(products.error)}</p>}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr><th className="p-2">Sản phẩm</th><th className="p-2">SKU</th><th className="p-2">Giá</th><th className="p-2">Tồn kho</th><th className="p-2" /></tr>
          </thead>
          <tbody>
            {items.flatMap((p) =>
              p.variants.map((v, i) => (
                <tr key={v.id} className="border-t">
                  <td className="p-2">{i === 0 ? p.name : ''}</td>
                  <td className="p-2 font-mono">{v.sku}</td>
                  <td className="p-2">{formatVnd(v.price)}</td>
                  <td className={`p-2 ${(v.inventory?.available ?? 0) <= 5 ? 'font-bold text-red-600' : ''}`}>
                    {v.inventory?.available ?? 0}
                  </td>
                  <td className="p-2 text-right">
                    {isAdmin && (
                      <button onClick={() => askAdjust(v.id)} className="rounded border px-2 py-1 hover:bg-gray-100">
                        Nhập / chỉnh kho
                      </button>
                    )}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      {products.hasNextPage && (
        <button onClick={() => products.fetchNextPage()} disabled={products.isFetchingNextPage}
          className="w-full rounded border bg-white py-2 hover:bg-gray-100">
          {products.isFetchingNextPage ? 'Đang tải...' : 'Tải thêm'}
        </button>
      )}
    </div>
  );
}
