/* ===========================================================
   Portail Alaska Animation — Page Réglages (simple)
   =========================================================== */
import { requireSession } from "./supabase.js";
import { getSettings, saveSettings, ensureClients, sortClients } from "./settings.js";

await requireSession();
const settings = await getSettings();

const $ = (id) => document.getElementById(id);
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

/* ---------- Pré-remplir le formulaire ---------- */
const b = settings.business;
$("ownerName").value    = b.owner_name || "";
$("ownerTitle").value   = b.owner_title || "";
$("businessName").value = b.business_name || "";
$("address").value      = b.address || "";
$("phone").value        = b.phone || "";
$("email").value        = b.email || "";
$("nextNo").value       = settings.next_invoice_no || 1;

/* ---------- Liste des services ---------- */
const svcList = $("svcList");

function addSvcRow(label = "", price = "", suffix = "") {
  const row = document.createElement("div");
  row.className = "svc-row";
  row.innerHTML = `
    <input class="lbl"   type="text"   placeholder="Ex. Maquillage fantaisie" value="${esc(label)}">
    <input class="price" type="number" min="0" step="0.01" placeholder="0" value="${price}">
    <input class="sfx"   type="text"   placeholder="/h" maxlength="6" value="${esc(suffix)}">
    <button type="button" class="del" title="Retirer" aria-label="Retirer">&times;</button>`;
  row.querySelector(".del").addEventListener("click", () => {
    if (svcList.children.length > 1) row.remove();
    else row.querySelectorAll("input").forEach((i) => (i.value = ""));
  });
  svcList.appendChild(row);
}

(settings.services.length ? settings.services : [{}]).forEach((s) =>
  addSvcRow(s.label, s.price ?? "", s.suffix || ""));

$("addSvc").addEventListener("click", () => addSvcRow());

/* ---------- Mes clients ---------- */
const clientList = $("clientList");

function addClientRow(c = {}, open = false) {
  const d = document.createElement("details");
  d.className = "client-row";
  d.open = open;
  d.innerHTML = `
    <summary><span class="cname">${esc(c.name) || "Nouveau client"}</span>
      <span class="cmeta">${esc([c.contact, c.phone].filter(Boolean).join(" · "))}</span></summary>
    <div class="client-body">
      <label>Nom du client</label>
      <input class="c-name" type="text" value="${esc(c.name)}" placeholder="Ex. CPE Les Petits Pas">
      <label>Adresse</label>
      <textarea class="c-address" placeholder="Rue, ville, code postal…">${esc(c.address)}</textarea>
      <label>Personne contact</label>
      <input class="c-contact" type="text" value="${esc(c.contact)}" placeholder="Ex. Julie Martel">
      <div class="row">
        <div><label>Téléphone</label>
          <input class="c-phone" type="tel" value="${esc(c.phone)}" placeholder="(819) 000-0000"></div>
        <div><label>Courriel</label>
          <input class="c-email" type="email" multiple value="${esc(c.email)}" placeholder="client@courriel.com"></div>
      </div>
      <button type="button" class="c-del"><i class="fa-regular fa-trash-can"></i> Retirer ce client</button>
    </div>`;
  const nameEl = d.querySelector(".c-name");
  nameEl.addEventListener("input", () =>
    (d.querySelector(".cname").textContent = nameEl.value.trim() || "Nouveau client"));
  d.querySelector(".c-del").addEventListener("click", () => {
    if (nameEl.value.trim() && !confirm("Retirer « " + nameEl.value.trim() + " » de ta liste de clients ?")) return;
    d.remove();
  });
  clientList.appendChild(d);
  if (open) nameEl.focus();
}

function readClients() {
  const list = [];
  clientList.querySelectorAll(".client-row").forEach((d) => {
    const v = (cls) => d.querySelector(cls).value.trim();
    const name = v(".c-name");
    if (name) list.push({ name, address: v(".c-address"), contact: v(".c-contact"), phone: v(".c-phone"), email: v(".c-email") });
  });
  return sortClients(list);
}

(await ensureClients()).forEach((c) => addClientRow(c));
$("addClient").addEventListener("click", () => addClientRow({}, true));

$("clientSearch").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase().trim();
  clientList.querySelectorAll(".client-row").forEach((d) => {
    const txt = [...d.querySelectorAll("input,textarea")].map((i) => i.value).join(" ").toLowerCase();
    d.hidden = !!q && !txt.includes(q);
  });
});

/* ---------- Enregistrer ---------- */
$("saveBtn").addEventListener("click", async () => {
  const services = [];
  svcList.querySelectorAll(".svc-row").forEach((row) => {
    const label = row.querySelector(".lbl").value.trim();
    if (!label) return;
    services.push({
      label,
      price: parseFloat(row.querySelector(".price").value) || 0,
      suffix: row.querySelector(".sfx").value.trim(),
    });
  });

  const next = parseInt($("nextNo").value, 10);

  const updated = {
    business: {
      owner_name:    $("ownerName").value.trim(),
      owner_title:   $("ownerTitle").value.trim(),
      business_name: $("businessName").value.trim(),
      address:       $("address").value.trim(),
      phone:         $("phone").value.trim(),
      email:         $("email").value.trim(),
    },
    next_invoice_no: Number.isFinite(next) && next > 0 ? next : 1,
    services: services.length ? services : settings.services,
    clients: readClients(),
  };

  const btn = $("saveBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement…';
  try {
    await saveSettings(updated);
    toast("Réglages enregistrés ✓");
  } catch (e) {
    toast("Erreur : " + e.message, true);
  }
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Enregistrer';
});
