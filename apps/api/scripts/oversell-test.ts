const API = process.env.API_URL ?? 'http://localhost:3000/api';
const TOKEN = process.env.TOKEN;
const VARIANT_ID = Number(process.env.VARIANT_ID ?? 1);
const N = 100;

if (!TOKEN) {
  console.error('Thiếu TOKEN. Chạy: $env:TOKEN="..." trước.');
  process.exit(1);
}

const started = Date.now();
const statuses = await Promise.all(
  Array.from({ length: N }, () =>
    fetch(`${API}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ items: [{ variantId: VARIANT_ID, quantity: 1 }] }),
    }).then((r) => r.status),
  ),
);

const count = (s: number) => statuses.filter((x) => x === s).length;
console.log(`Gửi ${N} request trong ${Date.now() - started} ms`);
console.log(`201 (thành công): ${count(201)}`);
console.log(`409 (hết hàng):   ${count(409)}`);
console.log(`Khác:             ${N - count(201) - count(409)}`);
