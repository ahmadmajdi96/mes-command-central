const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Opens a print-ready order summary or packing slip (packing slip hides prices). */
export function printOrder(so: any, customer: any, lines: any[], kind: "summary" | "packing") {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  const priced = kind === "summary";
  const rows = lines.map((l) => `<tr><td>${esc(l.product?.sku)}</td><td>${esc(l.product?.name)}</td><td class="r">${esc(l.qty)}</td>${priced ? `<td class="r">${Number(l.unit_price).toFixed(2)}</td><td class="r">${(Number(l.qty) * Number(l.unit_price)).toFixed(2)}</td>` : `<td class="r">☐</td>`}</tr>`).join("");
  const total = lines.reduce((s, l) => s + Number(l.qty) * Number(l.unit_price), 0);
  w.document.write(`<!doctype html><html><head><title>${esc(so.number)} ${priced ? "Order summary" : "Packing slip"}</title>
<style>body{font:13px system-ui,sans-serif;margin:32px;color:#111}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}.r{text-align:right}.meta{display:flex;justify-content:space-between;margin-top:16px}.muted{color:#666}</style></head><body>
<h1>${priced ? "Order summary" : "Packing slip"} — ${esc(so.number)}</h1>
<div class="meta"><div><b>Ship to</b><br>${esc(customer?.name)}<br>${esc(customer?.address ?? "").replace(/\n/g, "<br>")}<br>${esc(customer?.phone ?? "")}</div>
<div class="r"><span class="muted">Order date</span> ${esc(so.order_date)}<br><span class="muted">Due</span> ${esc(so.due_date ?? "—")}<br><span class="muted">Status</span> ${esc(so.status)}${customer?.payment_terms && priced ? `<br><span class="muted">Terms</span> ${esc(customer.payment_terms)}` : ""}</div></div>
<table><thead><tr><th>SKU</th><th>Product</th><th class="r">Qty</th>${priced ? `<th class="r">Unit price</th><th class="r">Line total</th>` : `<th class="r">Packed</th>`}</tr></thead><tbody>${rows}</tbody>
${priced ? `<tfoot><tr><td colspan="4" class="r"><b>Total (${esc(so.currency)})</b></td><td class="r"><b>${total.toFixed(2)}</b></td></tr></tfoot>` : ""}</table>
${so.notes ? `<p class="muted">Notes: ${esc(so.notes)}</p>` : ""}
${priced ? "" : `<p style="margin-top:40px">Packed by: ____________________ &nbsp; Date: ____________</p>`}
<script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}
