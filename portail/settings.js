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
