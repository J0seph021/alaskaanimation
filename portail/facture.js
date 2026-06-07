/* ===========================================================
   Portail Alaska Animation — Consultation d'une facture
   =========================================================== */
import { supabase, requireSession } from "./supabase.js";
import { BUSINESS } from "./config.js";

await requireSession();

const $ = (id) => document.getElementById(id);
const money = (n) => (Number(n) || 0).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let toastTimer;
function toast(msg, isError = false) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show" + (isError ? " err" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), 2600);
}

const fmtDate = (d) => d
  ? new Date(d + "T00:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })
  : "—";

const id = new URLSearchParams(location.search).get("id");
let invoice = null;

if (!id) {
  $("invoiceCard").innerHTML = '<p class="empty">Facture introuvable.</p>';
} else {
  load();
}

async function load() {
  const { data, error } = await supabase
    .from("alaska_invoices")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    $("invoiceCard").innerHTML = '<p class="empty">Facture introuvable.</p>';
    return;
  }
  invoice = data;
  render();
  $("actions").hidden = false;
  bindActions();
}

function render() {
  const inv = invoice;
  const bizContact = [
    BUSINESS.region,
    BUSINESS.phone,
    BUSINESS.email,
    BUSINESS.website,
  ].filter(Boolean).join(" · ");

  const rows = (inv.items || []).map((it) => `
    <tr>
      <td>${esc(it.description || "")}</td>
      <td class="num">${it.qty}</td>
      <td class="num">${money(it.price)}</td>
      <td class="num">${money(it.total)}</td>
    </tr>`).join("");

  const clientLines = [
    inv.client_name,
    inv.client_phone,
    inv.client_email,
  ].filter(Boolean).map((l) => `<div>${esc(l)}</div>`).join("");

  const eventLines = [
    inv.event_type ? `<div>${esc(inv.event_type)}</div>` : "",
    inv.event_date ? `<div>${fmtDate(inv.event_date)}</div>` : "",
    inv.event_location ? `<div>${esc(inv.event_location)}</div>` : "",
  ].join("") || "<div>—</div>";

  const createdOn = new Date(inv.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });

  $("invoiceCard").innerHTML = `
    <div class="inv-top">
      <div class="inv-biz">
        <img src="${esc(BUSINESS.logo)}" alt="">
        <div>
          <div class="nm">${esc(BUSINESS.name)}</div>
          <div class="tg">${esc(BUSINESS.tagline)}</div>
          ${bizContact ? `<div class="ct">${esc(bizContact)}</div>` : ""}
        </div>
      </div>
      <div class="inv-label">
        <div class="big">FACTURE</div>
        <div class="no">${esc(inv.invoice_number || "")}</div>
        <div class="no">${createdOn}</div>
        <span class="inv-status ${inv.status}">${inv.status === "paid" ? "PAYÉE" : "NON PAYÉE"}</span>
      </div>
    </div>

    <hr class="sep">

    <div class="blocks">
      <div class="b">
        <h4>Facturé à</h4>
        <div>${clientLines || "—"}</div>
      </div>
      <div class="b">
        <h4>Événement</h4>
        <div>${eventLines}</div>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>Description</th><th class="num">Qté</th><th class="num">Prix</th><th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="4">—</td></tr>'}</tbody>
    </table>

    <div class="grand">
      <div class="box">
        <div class="ln total"><span>Total</span><span class="amt">${money(inv.total)}</span></div>
      </div>
    </div>

    ${inv.notes ? `<div class="inv-notes"><strong>Notes :</strong>\n${esc(inv.notes)}</div>` : ""}

    <div class="inv-foot">Merci de faire confiance à ${esc(BUSINESS.name)} ! 🎈</div>
  `;
}

function bindActions() {
  // Marquer payée / non payée
  const paidBtn = $("paidBtn");
  syncPaidBtn();
  paidBtn.addEventListener("click", async () => {
    const newStatus = invoice.status === "paid" ? "unpaid" : "paid";
    const { error } = await supabase
      .from("alaska_invoices")
      .update({ status: newStatus })
      .eq("id", invoice.id);
    if (error) { toast(error.message, true); return; }
    invoice.status = newStatus;
    render();
    syncPaidBtn();
    toast(newStatus === "paid" ? "Marquée payée ✓" : "Marquée non payée");
  });

  function syncPaidBtn() {
    const isPaid = invoice.status === "paid";
    paidBtn.querySelector("span").textContent = isPaid ? "Marquer non payée" : "Marquer payée";
    paidBtn.querySelector("i").className = isPaid ? "fa-regular fa-circle-xmark" : "fa-regular fa-circle-check";
  }

  // Imprimer / PDF
  $("printBtn").addEventListener("click", () => window.print());

  // Envoyer par courriel (ouvre l'app de courriel pré-remplie)
  $("emailBtn").addEventListener("click", () => {
    const inv = invoice;
    const itemsTxt = (inv.items || [])
      .map((it) => `  • ${it.description} — ${it.qty} × ${money(it.price)} = ${money(it.total)}`)
      .join("\n");
    const subject = `Facture ${inv.invoice_number} — ${BUSINESS.name}`;
    const body =
`Bonjour ${inv.client_name},

Voici votre facture pour ${inv.event_type ? inv.event_type.toLowerCase() : "l'événement"}${inv.event_date ? " du " + fmtDate(inv.event_date) : ""}.

Facture : ${inv.invoice_number}
${itemsTxt}

TOTAL : ${money(inv.total)}
Statut : ${inv.status === "paid" ? "Payée" : "À payer"}
${inv.notes ? "\n" + inv.notes + "\n" : ""}
Merci beaucoup !
${BUSINESS.name}${BUSINESS.phone ? "\n" + BUSINESS.phone : ""}`;

    const to = inv.client_email || "";
    window.location.href =
      `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  // Supprimer
  $("deleteBtn").addEventListener("click", async () => {
    if (!confirm("Supprimer définitivement cette facture ?")) return;
    const { error } = await supabase.from("alaska_invoices").delete().eq("id", invoice.id);
    if (error) { toast(error.message, true); return; }
    window.location.replace("app.html");
  });
}
