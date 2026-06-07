/* ===========================================================
   Portail Alaska Animation — Page Réglages (simple)
   =========================================================== */
import { requireSession } from "./supabase.js";
import { getSettings, saveSettings } from "./settings.js";

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
