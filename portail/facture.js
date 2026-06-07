/* ===========================================================
   Portail Alaska Animation — Affichage d'une facture
   (mise en page calquée sur le modèle Canva de Maggie)
   =========================================================== */
import { supabase, requireSession } from "./supabase.js";
import { getSettings } from "./settings.js";

await requireSession();
const settings = await getSettings();

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Format monétaire du modèle : « 930$ », « 205$/h », « 50,50$ » */
const num = (n) => {
  n = Number(n) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
};
const dollars = (n) => num(n) + "$";

/* Date jj.mm.aaaa */
const dotDate = (d) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
};

let toastTimer;
function toast(msg, isError = false) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show" + (isError ? " err" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), 2600);
}

const id = new URLSearchParams(location.search).get("id");
let invoice = null;

if (!id) { $("facCard").innerHTML = '<p class="empty">Facture introuvable.</p>'; }
else { load(); }

async function load() {
  const { data, error } = await supabase
    .from("alaska_invoices").select("*").eq("id", id).single();
  if (error || !data) { $("facCard").innerHTML = '<p class="empty">Facture introuvable.</p>'; return; }
  invoice = data;
  render();
  $("actions").hidden = false;
  bindActions();
}

function render() {
  const inv = invoice;
  const b = settings.business;

  const rows = (inv.items || []).map((it) => `
    <tr>
      <td>${esc(it.description || "")}</td>
      <td>${it.price ? esc(dollars(it.price) + (it.suffix || "")) : ""}</td>
      <td>${esc(it.qty ?? "")}</td>
      <td class="r">${esc(dollars(it.total))}</td>
    </tr>`).join("");

  const addr = b.address ? `\n${b.address}` : "";

  $("facCard").innerHTML = `
    <div class="fac__title">Facture</div>

    <div class="fac__party">
      <div class="fac__lbl">Clients:</div>
      <div>
        <div class="fac__cname">${esc(inv.client_name)}</div>
        ${inv.client_address ? `<div class="fac__caddr">${esc(inv.client_address)}</div>` : ""}
      </div>
    </div>
    ${(inv.contact_name || inv.client_phone) ? `
    <div class="fac__party">
      <div class="fac__lbl">Contact:</div>
      <div class="fac__contact">${esc([inv.contact_name, inv.client_phone].filter(Boolean).join(" "))}</div>
    </div>` : ""}

    <hr class="fac__rule">

    <table class="fac__table">
      <colgroup>
        <col class="c-det"><col class="c-prix"><col class="c-qty"><col class="c-tot">
      </colgroup>
      <thead>
        <tr><th>Détails</th><th>Prix unité</th><th>Qty</th><th class="r">Total</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="fac__sub">
      <span class="fac__lbl">Subtotal</span>
      <span>${esc(dollars(inv.subtotal))}</span>
    </div>

    <div class="fac__lower">
      <div class="fac__totals">
        <div class="ln"><span>Tax</span><span>${esc(num(inv.tax || 0))}</span></div>
        <div class="ln total"><span class="fac__lbl">Total</span><span>${esc(dollars(inv.total))}</span></div>
      </div>

      <div class="fac__meta">
        <div><span class="fac__lbl">Invoice no:</span><span class="v">${esc(inv.invoice_number || "")}</span></div>
        <div><span class="fac__lbl">date:</span><span class="v">${esc(dotDate(inv.invoice_date))}</span></div>
      </div>

      <div class="fac__pay">
        <span class="fac__lbl">Info payment:</span>
        ${esc(b.owner_name || "")}${addr ? esc(addr).replace(/\n/g, "<br>") : ""}
        ${b.phone ? "<br>" + esc(b.phone) : ""}
      </div>

      <div class="fac__sign">
        <div class="fac__signname">${esc(b.owner_name || "")}</div>
        <div class="fac__signtitle">${esc(b.owner_title || "")}</div>
      </div>
    </div>
  `;
}

/* ---------- Boutons d'action ---------- */
function bindActions() {
  const paidBtn = $("paidBtn");
  syncPaidBtn();
  paidBtn.addEventListener("click", async () => {
    const newStatus = invoice.status === "paid" ? "unpaid" : "paid";
    const { error } = await supabase.from("alaska_invoices").update({ status: newStatus }).eq("id", invoice.id);
    if (error) { toast(error.message, true); return; }
    invoice.status = newStatus; syncPaidBtn();
    toast(newStatus === "paid" ? "Marquée payée ✓" : "Marquée non payée");
  });
  function syncPaidBtn() {
    const isPaid = invoice.status === "paid";
    paidBtn.querySelector("span").textContent = isPaid ? "Marquer non payée" : "Marquer payée";
    paidBtn.querySelector("i").className = isPaid ? "fa-regular fa-circle-xmark" : "fa-regular fa-circle-check";
  }

  $("printBtn").addEventListener("click", () => window.print());

  $("emailBtn").addEventListener("click", () => {
    const inv = invoice;
    const b = settings.business;
    const itemsTxt = (inv.items || [])
      .map((it) => `  • ${it.description} — ${it.qty} × ${dollars(it.price)}${it.suffix || ""} = ${dollars(it.total)}`)
      .join("\n");
    const subject = `Facture ${inv.invoice_number} — ${b.business_name || "Alaska Animation"}`;
    const body =
`Bonjour${inv.contact_name ? " " + inv.contact_name : ""},

Voici votre facture ${inv.invoice_number}${inv.invoice_date ? " (" + dotDate(inv.invoice_date) + ")" : ""} :

${itemsTxt}

Sous-total : ${dollars(inv.subtotal)}
Taxe : ${num(inv.tax || 0)}
TOTAL : ${dollars(inv.total)}
Statut : ${inv.status === "paid" ? "Payée" : "À payer"}

Merci beaucoup !
${b.owner_name || ""}
${b.business_name || "Alaska Animation"}${b.phone ? "\n" + b.phone : ""}`;
    const to = inv.client_email || "";
    window.location.href =
      `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  $("deleteBtn").addEventListener("click", async () => {
    if (!confirm("Supprimer définitivement cette facture ?")) return;
    const { error } = await supabase.from("alaska_invoices").delete().eq("id", invoice.id);
    if (error) { toast(error.message, true); return; }
    window.location.replace("app.html");
  });
}
