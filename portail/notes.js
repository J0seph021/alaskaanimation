/* ===========================================================
   Notes privées et dépenses d'une facture
   -----------------------------------------------------------
   Rangées dans la colonne texte « notes » de alaska_invoices,
   sous forme JSON : { v, text, expenses: [...] }.
   Une ancienne note en texte simple reste lue comme du texte.

   Dépense « labour » : personnes × heures × taux horaire
   Dépense « other »  : montant fixe (matériel, essence…)
   =========================================================== */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function parseNotes(raw) {
  const empty = { text: "", expenses: [] };
  if (!raw) return empty;
  try {
    const o = JSON.parse(raw);
    if (o && typeof o === "object" && o.v === 1) {
      return {
        text: String(o.text || ""),
        expenses: Array.isArray(o.expenses) ? o.expenses.map(normalizeExpense) : [],
      };
    }
  } catch (_) { /* ancienne note en texte simple */ }
  return { text: String(raw), expenses: [] };
}

export function normalizeExpense(e) {
  if (e.type === "labour") {
    const people = Number(e.people) || 0, hours = Number(e.hours) || 0, rate = Number(e.rate) || 0;
    return { type: "labour", label: String(e.label || "").trim(), people, hours, rate, total: round2(people * hours * rate) };
  }
  const amount = Number(e.amount) || 0;
  return { type: "other", label: String(e.label || "").trim(), amount, total: round2(amount) };
}

/* Retourne null quand il n'y a rien à garder */
export function serializeNotes({ text, expenses }) {
  const t = String(text || "").trim();
  const ex = (expenses || []).map(normalizeExpense).filter((e) => e.label || e.total);
  if (!t && !ex.length) return null;
  return JSON.stringify({ v: 1, text: t, expenses: ex });
}

export function expenseTotals(expenses) {
  let labour = 0, other = 0;
  (expenses || []).forEach((e) => {
    if (e.type === "labour") labour += Number(e.total) || 0;
    else other += Number(e.total) || 0;
  });
  return { labour: round2(labour), other: round2(other), total: round2(labour + other) };
}

/* Ligne lisible : « Sarah : 2 pers. × 4 h × 40 $/h » */
export function describeExpense(e) {
  if (e.type === "labour") {
    const who = e.label || "Main-d'œuvre";
    return `${who} : ${e.people} pers. × ${e.hours} h × ${e.rate} $/h`;
  }
  return e.label || "Dépense";
}
