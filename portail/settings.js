/* Chargement / sauvegarde des réglages (table alaska_settings) */
import { supabase } from "./supabase.js";
import { DEFAULT_SETTINGS } from "./config.js";

let cache = null;

/* Fusionne les réglages enregistrés avec les valeurs par défaut */
function merge(saved) {
  const d = DEFAULT_SETTINGS;
  saved = saved || {};
  return {
    business: { ...d.business, ...(saved.business || {}) },
    next_invoice_no: Number.isFinite(saved.next_invoice_no) ? saved.next_invoice_no : d.next_invoice_no,
    services: Array.isArray(saved.services) && saved.services.length ? saved.services : d.services,
    // null = banque de clients jamais créée (sera remplie depuis les anciennes factures)
    clients: Array.isArray(saved.clients) ? saved.clients : null,
  };
}

export async function getSettings(force = false) {
  if (cache && !force) return cache;
  const { data, error } = await supabase
    .from("alaska_settings")
    .select("data")
    .maybeSingle();
  if (error) console.error("settings load:", error);
  cache = merge(data ? data.data : null);
  return cache;
}

export async function saveSettings(settings) {
  const { data: { session } } = await supabase.auth.getSession();
  const payload = { owner_id: session?.user?.id, data: settings };
  const { error } = await supabase
    .from("alaska_settings")
    .upsert(payload, { onConflict: "owner_id" });
  if (error) throw error;
  cache = merge(settings);
  return cache;
}

/* Incrémente le prochain numéro de facture (après une création) */
export async function bumpInvoiceNo(current) {
  const s = await getSettings();
  s.next_invoice_no = Number(current) + 1;
  await saveSettings(s);
}

/* ---------- Banque de clients ---------- */
const CLIENT_FIELDS = ["name", "address", "contact", "phone", "email"];
const clientKey = (name) => String(name || "").trim().toLowerCase().replace(/\s+/g, " ");

export function sortClients(list) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
}

/* Ajoute le client ou met à jour sa fiche (clé = nom, sans tenir compte des majuscules).
   Un champ laissé vide ne remplace pas une info déjà connue. */
export function upsertClient(list, client) {
  const c = {};
  CLIENT_FIELDS.forEach((f) => (c[f] = String(client[f] || "").trim()));
  if (!c.name) return list;
  const out = [...list];
  const i = out.findIndex((x) => clientKey(x.name) === clientKey(c.name));
  if (i === -1) out.push(c);
  else {
    const merged = { ...out[i] };
    CLIENT_FIELDS.forEach((f) => { if (c[f] && f !== "name") merged[f] = c[f]; });  // garde l'écriture du nom
    out[i] = merged;
  }
  return sortClients(out);
}

/* Fiche client à partir d'une facture */
export const clientFromInvoice = (inv) => ({
  name: inv.client_name, address: inv.client_address, contact: inv.contact_name,
  phone: inv.client_phone, email: inv.client_email,
});

/* Première utilisation : bâtit la banque à partir des factures déjà faites */
export async function ensureClients() {
  const s = await getSettings();
  if (Array.isArray(s.clients)) return s.clients;
  const { data, error } = await supabase
    .from("alaska_invoices")
    .select("client_name, client_address, contact_name, client_phone, client_email, created_at")
    .order("created_at", { ascending: true });   // la plus récente l'emporte
  if (error) { console.error("clients import:", error); return []; }
  let list = [];
  (data || []).forEach((inv) => (list = upsertClient(list, clientFromInvoice(inv))));
  s.clients = list;
  try { await saveSettings(s); } catch (e) { console.error("clients save:", e); }
  return list;
}

/* Après une nouvelle facture : mémorise le client et avance le numéro (une seule sauvegarde) */
export async function afterInvoiceSaved(client, invoiceNo) {
  await ensureClients();
  const s = await getSettings();
  s.clients = upsertClient(s.clients || [], client);
  if (Number.isFinite(invoiceNo)) s.next_invoice_no = invoiceNo + 1;
  await saveSettings(s);
}
