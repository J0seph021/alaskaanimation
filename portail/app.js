/* ===========================================================
   Portail Alaska Animation — Application de facturation
   =========================================================== */
import { supabase, requireSession, signOut } from "./supabase.js";
import { SERVICES } from "./config.js";

await requireSession();

/* ---------- Utilitaires ---------- */
const $  = (id) => document.getElementById(id);
const money = (n) => (Number(n) || 0).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";

let toastTimer;
function toast(msg, isError = false) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show" + (isError ? " err" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), 2600);
}

/* ---------- Déconnexion ---------- */
$("logoutBtn").addEventListener("click", signOut);

/* ---------- Onglets ---------- */
const tabNew = $("tabNew"), tabList = $("tabList");
const viewNew = $("viewNew"), viewList = $("viewList");

function showNew() {
  tabNew.classList.add("active"); tabList.classList.remove("active");
  viewNew.hidden = false; viewList.hidden = true;
}
function showList() {
  tabList.classList.add("active"); tabNew.classList.remove("active");
  viewList.hidden = false; viewNew.hidden = true;
  loadInvoices();
}
tabNew.addEventListener("click", showNew);
tabList.addEventListener("click", showList);

/* ---------- Suggestions de services ---------- */
const dl = $("serviceSuggestions");
SERVICES.forEach((s) => {
  const o = document.createElement("option");
  o.value = s.label;
  dl.appendChild(o);
});
const PRICE_BY_LABEL = Object.fromEntries(SERVICES.map((s) => [s.label, s.price]));

/* ---------- Lignes de service ---------- */
const itemsList = $("itemsList");

function addItemRow(desc = "", qty = 1, price = "") {
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <input class="desc" list="serviceSuggestions" placeholder="Service" value="${esc(desc)}">
    <input class="qty"  type="number" inputmode="decimal" min="0" step="1"    value="${qty}">
    <input class="price" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" value="${price}">
    <div class="line-total">0,00 $</div>
    <button type="button" class="del" title="Retirer" aria-label="Retirer">&times;</button>`;
  itemsList.appendChild(row);

  const descEl  = row.querySelector(".desc");
  const qtyEl   = row.querySelector(".qty");
  const priceEl = row.querySelector(".price");

  // Auto-remplit le prix suggéré quand on choisit un service connu
  descEl.addEventListener("change", () => {
    const sugg = PRICE_BY_LABEL[descEl.value];
    if (sugg && !priceEl.value) { priceEl.value = sugg; recalc(); }
  });
  [qtyEl, priceEl].forEach((el) => el.addEventListener("input", recalc));
  row.querySelector(".del").addEventListener("click", () => {
    if (itemsList.children.length > 1) row.remove();
    else { descEl.value = priceEl.value = ""; qtyEl.value = 1; }
    recalc();
  });
  recalc();
}

function recalc() {
  let total = 0;
  itemsList.querySelectorAll(".item-row").forEach((row) => {
    const qty   = parseFloat(row.querySelector(".qty").value)   || 0;
    const price = parseFloat(row.querySelector(".price").value) || 0;
    const line  = qty * price;
    total += line;
    row.querySelector(".line-total").textContent = money(line);
  });
  $("grandTotal").textContent = money(total);
  return total;
}

$("addItem").addEventListener("click", () => addItemRow());
addItemRow(); // une ligne au départ

/* ---------- Enregistrer une facture ---------- */
$("invForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const items = [];
  itemsList.querySelectorAll(".item-row").forEach((row) => {
    const description = row.querySelector(".desc").value.trim();
    const qty   = parseFloat(row.querySelector(".qty").value)   || 0;
    const price = parseFloat(row.querySelector(".price").value) || 0;
    if (description || price) items.push({ description, qty, price, total: qty * price });
  });

  if (items.length === 0) { toast("Ajoute au moins un service.", true); return; }

  const subtotal = items.reduce((s, i) => s + i.total, 0);

  const payload = {
    client_name:    $("clientName").value.trim(),
    client_phone:   $("clientPhone").value.trim() || null,
    client_email:   $("clientEmail").value.trim() || null,
    event_type:     $("eventType").value || null,
    event_date:     $("eventDate").value || null,
    event_location: $("eventLocation").value.trim() || null,
    items,
    subtotal,
    total: subtotal,
    notes: $("notes").value.trim() || null,
    status: "unpaid",
  };

  const saveBtn = $("saveBtn");
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement…';

  const { data, error } = await supabase
    .from("alaska_invoices")
    .insert(payload)
    .select("id, invoice_number")
    .single();

  saveBtn.disabled = false;
  saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Enregistrer la facture';

  if (error) {
    console.error(error);
    toast("Erreur : " + error.message, true);
    return;
  }

  toast("Facture " + data.invoice_number + " enregistrée ✓");
  // Ouvre la facture créée
  window.location.href = "facture.html?id=" + data.id;
});

/* ---------- Liste des factures ---------- */
let allInvoices = [];

async function loadInvoices() {
  const box = $("listContainer");
  box.innerHTML = '<p class="empty">Chargement…</p>';

  const { data, error } = await supabase
    .from("alaska_invoices")
    .select("id, invoice_number, client_name, event_date, event_location, total, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    box.innerHTML = '<p class="empty">Erreur de chargement.</p>';
    toast(error.message, true);
    return;
  }
  allInvoices = data || [];
  renderInvoices(allInvoices);
}

function renderInvoices(list) {
  const box = $("listContainer");
  if (list.length === 0) {
    box.innerHTML = '<p class="empty">Aucune facture pour le moment.<br>Crée ta première dans l’onglet « Nouvelle facture ».</p>';
    return;
  }
  box.innerHTML = "";
  list.forEach((inv) => {
    const a = document.createElement("a");
    a.className = "inv";
    a.href = "facture.html?id=" + inv.id;
    const when = inv.event_date
      ? new Date(inv.event_date + "T00:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" })
      : new Date(inv.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
    const lieu = inv.event_location ? " · " + inv.event_location : "";
    a.innerHTML = `
      <div class="info">
        <div class="name">${esc(inv.client_name)}</div>
        <div class="meta">${esc(inv.invoice_number || "")} · ${when}${esc(lieu)}</div>
        <span class="badge ${inv.status}">${inv.status === "paid" ? "Payée" : "Non payée"}</span>
      </div>
      <div class="amount">${money(inv.total)}</div>
      <i class="fa-solid fa-chevron-right chev"></i>`;
    box.appendChild(a);
  });
}

$("searchBox").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase().trim();
  if (!q) { renderInvoices(allInvoices); return; }
  renderInvoices(allInvoices.filter((inv) =>
    [inv.client_name, inv.invoice_number, inv.event_location]
      .filter(Boolean).join(" ").toLowerCase().includes(q)
  ));
});

/* ---------- échappement HTML ---------- */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
