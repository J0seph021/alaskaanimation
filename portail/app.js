/* ===========================================================
   Portail Alaska Animation — Création & liste des factures
   =========================================================== */
import { supabase, requireSession, signOut } from "./supabase.js";
import { getSettings, ensureClients, afterInvoiceSaved, clientFromInvoice } from "./settings.js";
import { parseNotes, expenseTotals, describeExpense } from "./notes.js";

await requireSession();
const settings = await getSettings();

/* ---------- Utilitaires ---------- */
const $ = (id) => document.getElementById(id);
const money = (n) =>
  (Number(n) || 0).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
const pad4 = (n) => String(n).padStart(4, "0");
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

/* ---------- Barre du haut ---------- */
$("logoutBtn").addEventListener("click", signOut);

/* ---------- Onglets ---------- */
const tabNew = $("tabNew"), tabList = $("tabList");
function showNew() {
  tabNew.classList.add("active"); tabList.classList.remove("active");
  $("viewNew").hidden = false; $("viewList").hidden = true;
}
function showList() {
  tabList.classList.add("active"); tabNew.classList.remove("active");
  $("viewList").hidden = false; $("viewNew").hidden = true;
  loadInvoices();
}
tabNew.addEventListener("click", showNew);
tabList.addEventListener("click", showList);

/* ---------- Pré-remplissage entête ---------- */
$("invoiceNo").value = pad4(settings.next_invoice_no);
$("invoiceDate").value = new Date().toISOString().split("T")[0];

/* ---------- Suggestions de services (depuis les Réglages) ---------- */
const dl = $("serviceSuggestions");
const SVC = {};
settings.services.forEach((s) => {
  const o = document.createElement("option");
  o.value = s.label;
  dl.appendChild(o);
  SVC[s.label] = s;
});

/* ---------- Banque de clients (liste déroulante) ---------- */
const clientPick = $("clientPick");
const CLIENT_INPUTS = { name: "clientName", address: "clientAddress", contact: "contactName",
                        phone: "contactPhone", email: "clientEmail" };
let clients = [];

ensureClients().then((list) => {
  clients = list;
  list.forEach((c, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = c.name;
    clientPick.appendChild(o);
  });
});

clientPick.addEventListener("change", () => {
  const c = clientPick.value === "" ? null : clients[Number(clientPick.value)];   // "" = nouveau client
  Object.entries(CLIENT_INPUTS).forEach(([f, id]) => ($(id).value = c ? c[f] || "" : ""));
});

/* ---------- Lignes de service ---------- */
const itemsList = $("itemsList");

function addItemRow(desc = "", price = "", suffix = "", qty = 1) {
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <input class="desc"  list="serviceSuggestions" placeholder="Service" value="${esc(desc)}">
    <input class="price" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0" value="${price}">
    <input class="unit"  type="text" placeholder="/h" value="${esc(suffix)}" maxlength="6">
    <input class="qty"   type="number" inputmode="decimal" min="0" step="1" value="${qty}">
    <div class="line-total">0 $</div>
    <button type="button" class="del" title="Retirer" aria-label="Retirer">&times;</button>`;
  itemsList.appendChild(row);

  const descEl  = row.querySelector(".desc");
  const priceEl = row.querySelector(".price");
  const unitEl  = row.querySelector(".unit");
  const qtyEl   = row.querySelector(".qty");

  // Choix d'un service connu → remplit prix + unité
  descEl.addEventListener("change", () => {
    const s = SVC[descEl.value];
    if (s) {
      if (!priceEl.value || priceEl.value === "0") priceEl.value = s.price || "";
      if (!unitEl.value) unitEl.value = s.suffix || "";
      recalc();
    }
  });
  [priceEl, qtyEl].forEach((el) => el.addEventListener("input", recalc));
  row.querySelector(".del").addEventListener("click", () => {
    if (itemsList.children.length > 1) row.remove();
    else { descEl.value = priceEl.value = unitEl.value = ""; qtyEl.value = 1; }
    recalc();
  });
  recalc();
}

function recalc() {
  let subtotal = 0;
  itemsList.querySelectorAll(".item-row").forEach((row) => {
    const price = parseFloat(row.querySelector(".price").value) || 0;
    const qty   = parseFloat(row.querySelector(".qty").value)   || 0;
    const line  = price * qty;
    subtotal += line;
    row.querySelector(".line-total").textContent = money(line);
  });
  const tax = parseFloat($("tax").value) || 0;
  $("grandTotal").textContent = money(subtotal + tax);
  return subtotal;
}

$("tax").addEventListener("input", recalc);
$("addItem").addEventListener("click", () => addItemRow());
addItemRow(); // une ligne au départ

/* ---------- Enregistrer ---------- */
$("invForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const items = [];
  itemsList.querySelectorAll(".item-row").forEach((row) => {
    const description = row.querySelector(".desc").value.trim();
    const price  = parseFloat(row.querySelector(".price").value) || 0;
    const suffix = row.querySelector(".unit").value.trim();
    const qty    = parseFloat(row.querySelector(".qty").value)   || 0;
    if (description || price) items.push({ description, price, suffix, qty, total: price * qty });
  });

  if (items.length === 0) { toast("Ajoute au moins un service.", true); return; }

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const tax = parseFloat($("tax").value) || 0;

  const payload = {
    invoice_number: $("invoiceNo").value.trim() || pad4(settings.next_invoice_no),
    invoice_date:   $("invoiceDate").value || new Date().toISOString().split("T")[0],
    client_name:    $("clientName").value.trim(),
    client_address: $("clientAddress").value.trim() || null,
    contact_name:   $("contactName").value.trim() || null,
    client_phone:   $("contactPhone").value.trim() || null,
    client_email:   $("clientEmail").value.trim() || null,
    items,
    subtotal,
    tax,
    total: subtotal + tax,
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

  if (error) {
    console.error(error);
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Enregistrer la facture';
    toast("Erreur : " + error.message, true);
    return;
  }

  // Mémorise le client et prépare le prochain numéro de facture
  try { await afterInvoiceSaved(clientFromInvoice(payload), parseInt(payload.invoice_number, 10)); }
  catch (err) { console.error(err); }

  toast("Facture " + data.invoice_number + " enregistrée ✓");
  window.location.href = "facture.html?id=" + data.id;
});

/* ---------- Liste des factures ---------- */
let allInvoices = [];

async function loadInvoices() {
  const box = $("listContainer");
  box.innerHTML = '<p class="empty">Chargement…</p>';
  const { data, error } = await supabase
    .from("alaska_invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { box.innerHTML = '<p class="empty">Erreur de chargement.</p>'; toast(error.message, true); return; }
  allInvoices = (data || []).map((inv) => {
    const n = parseNotes(inv.notes);
    return { ...inv, _notes: n, _exp: expenseTotals(n.expenses) };
  });
  renderInvoices(allInvoices);
  renderBilan();
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
    const d = inv.invoice_date || inv.created_at;
    const when = new Date((inv.invoice_date ? inv.invoice_date + "T00:00:00" : inv.created_at))
      .toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
    a.innerHTML = `
      <div class="info">
        <div class="name">${esc(inv.client_name)}</div>
        <div class="meta">Facture ${esc(inv.invoice_number || "")} · ${when}</div>
        <span class="badge ${inv.status}">${inv.status === "paid" ? "Payée" : "Non payée"}</span>${
          inv._exp && inv._exp.total ? `<span class="exp-tag">Dépenses ${money(inv._exp.total)}</span>` : ""}
      </div>
      <div class="amount">${money(inv.total)}</div>
      <i class="fa-solid fa-chevron-right chev"></i>`;
    box.appendChild(a);
  });
}

$("searchBox").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase().trim();
  renderInvoices(!q ? allInvoices : allInvoices.filter((inv) =>
    [inv.client_name, inv.invoice_number].filter(Boolean).join(" ").toLowerCase().includes(q)));
});

/* ---------- Bilan annuel + export Excel ---------- */
const invDate = (inv) => inv.invoice_date || String(inv.created_at || "").slice(0, 10);
const invYear = (inv) => invDate(inv).slice(0, 4);
const yearPick = $("yearPick");

function renderBilan() {
  const years = [...new Set(allInvoices.map(invYear).filter(Boolean))].sort().reverse();
  if (!years.length) { $("bilan").hidden = true; return; }
  const keep = yearPick.value;
  yearPick.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
  const thisYear = String(new Date().getFullYear());
  yearPick.value = years.includes(keep) ? keep : (years.includes(thisYear) ? thisYear : years[0]);
  $("bilan").hidden = false;
  updateBilan();
}

function yearInvoices() {
  return allInvoices.filter((inv) => invYear(inv) === yearPick.value)
    .sort((a, b) => invDate(a).localeCompare(invDate(b)));
}

function updateBilan() {
  const list = yearInvoices();
  const revenue = list.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
  const expenses = list.reduce((s, i) => s + i._exp.total, 0);
  const unpaid = list.filter((i) => i.status !== "paid").reduce((s, i) => s + (Number(i.total) || 0), 0);
  $("bRevenue").textContent = money(revenue);
  $("bExpenses").textContent = money(expenses);
  $("bProfit").textContent = money(revenue - expenses);
  $("bHint").textContent = `${list.length} facture${list.length > 1 ? "s" : ""}` +
    (unpaid ? ` · ${money(unpaid)} pas encore payé` : "") + " · Revenus avant taxes";
}
yearPick.addEventListener("change", updateBilan);

function loadSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((ok, ko) => {
    const sc = document.createElement("script");
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    sc.onload = () => ok(window.XLSX);
    sc.onerror = () => ko(new Error("Outil Excel non chargé"));
    document.head.appendChild(sc);
  });
}

$("exportBtn").addEventListener("click", async () => {
  const btn = $("exportBtn");
  btn.disabled = true;
  try {
    const XLSX = await loadSheetJS();
    const year = yearPick.value;
    const list = yearInvoices();

    const facRows = list.map((i) => ({
      "Date": invDate(i),
      "No facture": i.invoice_number || "",
      "Client": i.client_name || "",
      "Statut": i.status === "paid" ? "Payée" : "Non payée",
      "Services": (i.items || []).map((it) => it.description).filter(Boolean).join(", "),
      "Revenu avant taxes": Number(i.subtotal) || 0,
      "Taxes": Number(i.tax) || 0,
      "Total facturé": Number(i.total) || 0,
      "Main-d'œuvre": i._exp.labour,
      "Autres dépenses": i._exp.other,
      "Total dépenses": i._exp.total,
      "Profit": (Number(i.subtotal) || 0) - i._exp.total,
      "Notes": i._notes.text,
    }));
    const sum = (k) => facRows.reduce((s, r) => s + r[k], 0);
    facRows.push({
      "Date": "TOTAL " + year, "No facture": "", "Client": "", "Statut": "", "Services": "",
      "Revenu avant taxes": sum("Revenu avant taxes"), "Taxes": sum("Taxes"), "Total facturé": sum("Total facturé"),
      "Main-d'œuvre": sum("Main-d'œuvre"), "Autres dépenses": sum("Autres dépenses"),
      "Total dépenses": sum("Total dépenses"), "Profit": sum("Profit"), "Notes": "",
    });

    const expRows = [];
    list.forEach((i) => i._notes.expenses.forEach((e) => expRows.push({
      "Date": invDate(i),
      "No facture": i.invoice_number || "",
      "Client": i.client_name || "",
      "Type": e.type === "labour" ? "Main-d'œuvre" : "Autre",
      "Description": e.label || "",
      "Personnes": e.type === "labour" ? e.people : "",
      "Heures": e.type === "labour" ? e.hours : "",
      "Taux horaire": e.type === "labour" ? e.rate : "",
      "Montant": e.total,
      "Détail": describeExpense(e),
    })));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(facRows);
    ws1["!cols"] = [11, 10, 30, 10, 36, 14, 8, 12, 12, 12, 12, 12, 40].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws1, "Factures");
    const ws2 = XLSX.utils.json_to_sheet(expRows.length ? expRows : [{ "Date": "Aucune dépense notée" }]);
    ws2["!cols"] = [11, 10, 30, 13, 28, 10, 8, 12, 11, 40].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws2, "Dépenses");
    XLSX.writeFile(wb, `Alaska-Animation-bilan-${year}.xlsx`);
    toast("Fichier Excel téléchargé ✓");
  } catch (e) {
    console.error(e);
    toast("Impossible de créer le fichier. Vérifie ta connexion.", true);
  }
  btn.disabled = false;
});
