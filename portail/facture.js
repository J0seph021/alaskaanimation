/* ===========================================================
   Portail Alaska Animation — Affichage d'une facture
   (mise en page calquée sur le modèle Canva de Maggie)
   =========================================================== */
import { supabase, requireSession } from "./supabase.js";
import { getSettings } from "./settings.js";
import { parseNotes, serializeNotes, expenseTotals, normalizeExpense } from "./notes.js";

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
  initPrivate();
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
    ${(inv.contact_name || inv.client_phone || inv.client_email) ? `
    <div class="fac__party">
      <div class="fac__lbl">Contact:</div>
      <div class="fac__contact">${esc([inv.contact_name, inv.client_phone].filter(Boolean).join(" "))}${
        inv.client_email ? `<div>${esc(inv.client_email)}</div>` : ""}</div>
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

  $("emailBtn").addEventListener("click", openSendSheet);
  $("sendClose").addEventListener("click", closeSendSheet);
  $("sendSheet").addEventListener("click", (e) => { if (e.target.id === "sendSheet") closeSendSheet(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSendSheet(); });
  $("sendPdfBtn").addEventListener("click", sendWithPdf);
  $("sendTextBtn").addEventListener("click", sendTextOnly);

  $("deleteBtn").addEventListener("click", async () => {
    if (!confirm("Supprimer définitivement cette facture ?")) return;
    const { error } = await supabase.from("alaska_invoices").delete().eq("id", invoice.id);
    if (error) { toast(error.message, true); return; }
    window.location.replace("app.html");
  });
}

/* ===========================================================
   Envoi par courriel
   -----------------------------------------------------------
   Sur téléphone : le PDF de la facture est créé ici, puis le
   menu « Partager » du téléphone l'envoie à Outlook / Gmail
   déjà en pièce jointe. Le courriel du client est copié pour
   être collé dans « À ».
   Ailleurs : le PDF se télécharge et le courriel s'ouvre avec
   l'adresse, l'objet et le message déjà remplis.
   =========================================================== */
const canShareFiles = (() => {
  try {
    return !!navigator.canShare &&
      navigator.canShare({ files: [new File(["x"], "test.pdf", { type: "application/pdf" })] });
  } catch (_) { return false; }
})();

let pdfFile = null;     // PDF prêt (créé une seule fois)
let pdfPromise = null;

const pdfName = () =>
  `Facture-${String(invoice.invoice_number || "").replace(/[^\w-]+/g, "") || "Alaska"}-Alaska-Animation.pdf`;

async function buildPdf() {
  if (typeof html2pdf === "undefined") throw new Error("Outil PDF non chargé");
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const el = $("facCard").cloneNode(true);
  el.removeAttribute("id");
  el.classList.add("fac--pdf");
  const blob = await html2pdf().set({
    margin: 0,
    image: { type: "jpeg", quality: 0.95 },
    html2canvas: { scale: 2, backgroundColor: "#F4F1E9", windowWidth: 900, scrollX: 0, scrollY: 0 },
    jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
  }).from(el).outputPdf("blob");
  return new File([blob], pdfName(), { type: "application/pdf" });
}

function preparePdf() {
  if (!pdfPromise) {
    pdfPromise = buildPdf()
      .then((f) => (pdfFile = f))
      .catch((e) => { console.error(e); pdfPromise = null; throw e; });
  }
  return pdfPromise;
}

function setPdfBtn(state) {
  const btn = $("sendPdfBtn");
  if (state === "loading") {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Préparation du PDF…';
  } else if (state === "error") {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Réessayer de créer le PDF';
  } else {
    btn.disabled = false;
    btn.innerHTML = canShareFiles
      ? '<i class="fa-solid fa-paperclip"></i> Envoyer avec le PDF'
      : '<i class="fa-solid fa-paperclip"></i> Télécharger le PDF et écrire le courriel';
  }
}

function openSendSheet() {
  $("sendTo").value = invoice.client_email || "";
  $("sendHint").textContent = canShareFiles
    ? "Choisis Outlook (ou Gmail) dans la liste : la facture PDF sera déjà jointe. " +
      "Le courriel du client est copié automatiquement : appuie longuement dans « À » et choisis Coller."
    : "La facture PDF va se télécharger et ton courriel va s'ouvrir avec l'adresse et le message déjà écrits. " +
      "Il reste à joindre le PDF avec le trombone 📎.";
  $("sendSheet").hidden = false;
  if (pdfFile) { setPdfBtn("ready"); return; }
  setPdfBtn("loading");
  preparePdf().then(() => setPdfBtn("ready"), () => {
    setPdfBtn("error");
    toast("Impossible de créer le PDF. Vérifie ta connexion.", true);
  });
}

function closeSendSheet() { $("sendSheet").hidden = true; }

/* Lit et valide l'adresse ; la garde dans la facture si elle a changé */
function readRecipient() {
  const input = $("sendTo");
  const to = input.value.trim();
  if (to && !input.checkValidity()) {
    toast("Le courriel du client ne semble pas valide.", true);
    input.focus();
    return null;
  }
  if (to !== (invoice.client_email || "")) {
    invoice.client_email = to || null;
    render();
    pdfFile = null; pdfPromise = null;     // l'adresse figure sur la facture
    supabase.from("alaska_invoices").update({ client_email: invoice.client_email }).eq("id", invoice.id)
      .then(({ error }) => { if (error) toast("Courriel non enregistré : " + error.message, true); });
  }
  return to;
}

function emailSubject() {
  return `Facture ${invoice.invoice_number || ""} · ${settings.business.business_name || "Alaska Animation"}`;
}

function emailSignature() {
  const b = settings.business;
  return [b.owner_name, b.business_name || "Alaska Animation", b.phone].filter(Boolean).join("\n");
}

function emailHello() {
  return `Bonjour${invoice.contact_name ? " " + invoice.contact_name : ""},`;
}

function bodyWithPdf() {
  const inv = invoice;
  return `${emailHello()}

Vous trouverez ci-joint la facture ${inv.invoice_number || ""}${inv.invoice_date ? " du " + dotDate(inv.invoice_date) : ""} (PDF).

Montant total : ${dollars(inv.total)}
${inv.status === "paid" ? "Cette facture est déjà payée, merci !" : "Les informations de paiement sont indiquées sur la facture."}

Merci beaucoup et au plaisir !

${emailSignature()}`;
}

function bodyTextOnly() {
  const inv = invoice;
  const itemsTxt = (inv.items || [])
    .map((it) => `  • ${it.description} : ${it.qty} × ${dollars(it.price)}${it.suffix || ""} = ${dollars(it.total)}`)
    .join("\n");
  return `${emailHello()}

Voici votre facture ${inv.invoice_number || ""}${inv.invoice_date ? " (" + dotDate(inv.invoice_date) + ")" : ""} :

${itemsTxt}

Sous-total : ${dollars(inv.subtotal)}
Taxe : ${num(inv.tax || 0)}
TOTAL : ${dollars(inv.total)}
Statut : ${inv.status === "paid" ? "Payée" : "À payer"}

Merci beaucoup !

${emailSignature()}`;
}

function openMailto(to, subject, body) {
  const addr = to.split(",").map((a) => encodeURIComponent(a.trim()).replace(/%40/g, "@")).filter(Boolean).join(",");
  window.location.href = `mailto:${addr}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function sendWithPdf() {
  const to = readRecipient();
  if (to === null) return;

  if (!pdfFile) {                       // PDF à (re)créer
    setPdfBtn("loading");
    try { await preparePdf(); setPdfBtn("ready"); }
    catch (_) { setPdfBtn("error"); toast("Impossible de créer le PDF. Vérifie ta connexion.", true); return; }
    // Le téléphone exige un nouveau toucher pour ouvrir le partage
    if (canShareFiles) { toast("PDF prêt : appuie de nouveau sur « Envoyer »."); return; }
  }

  if (canShareFiles) {
    if (to && navigator.clipboard) { try { await navigator.clipboard.writeText(to); } catch (_) {} }
    try {
      await navigator.share({ files: [pdfFile], title: emailSubject(), text: bodyWithPdf() });
      closeSendSheet();
      return;
    } catch (e) {
      if (e.name === "AbortError") return;          // annulé par l'utilisateur
      console.error(e);                             // sinon : plan B ci-dessous
    }
  }

  downloadFile(pdfFile);
  closeSendSheet();
  toast("PDF téléchargé : joins-le au courriel 📎");
  setTimeout(() => openMailto(to, emailSubject(), bodyWithPdf()), 600);
}

function sendTextOnly() {
  const to = readRecipient();
  if (to === null) return;
  closeSendSheet();
  openMailto(to, emailSubject(), bodyTextOnly());
}

/* ===========================================================
   Notes et dépenses (privé, jamais sur la facture)
   =========================================================== */
const money2 = (n) =>
  (Number(n) || 0).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
let notesDirty = false;

function initPrivate() {
  const { text, expenses } = parseNotes(invoice.notes);
  $("noteText").value = text;
  expenses.filter((e) => e.type === "labour").forEach((e) => addLabourRow(e));
  expenses.filter((e) => e.type !== "labour").forEach((e) => addOtherRow(e));
  $("addLabour").addEventListener("click", () => { addLabourRow({}, true); markDirty(); });
  $("addOther").addEventListener("click", () => { addOtherRow({}, true); markDirty(); });
  $("noteText").addEventListener("input", markDirty);
  $("saveNotesBtn").addEventListener("click", saveNotes);
  window.addEventListener("beforeunload", (e) => { if (notesDirty) { e.preventDefault(); e.returnValue = ""; } });
  recalcExpenses();
  $("privateBox").hidden = false;
}

function markDirty() { notesDirty = true; }

function numInput(cls, label, value, step, placeholder) {
  return `<label class="mini"><span>${label}</span>
    <input class="${cls}" type="number" inputmode="decimal" min="0" step="${step}" placeholder="${placeholder}" value="${value ?? ""}"></label>`;
}

function wireRow(row, focus) {
  row.querySelectorAll("input").forEach((i) => i.addEventListener("input", () => { markDirty(); recalcExpenses(); }));
  row.querySelector(".del").addEventListener("click", () => { row.remove(); markDirty(); recalcExpenses(); });
  if (focus) row.querySelector(".lbl").focus();
}

function addLabourRow(e = {}, focus = false) {
  const row = document.createElement("div");
  row.className = "exp-row exp-labour";
  row.innerHTML = `
    <label class="mini"><span>Qui</span>
      <input class="lbl" type="text" placeholder="Ex. Sarah (employée)" value="${esc(e.label)}"></label>
    ${numInput("people", "Pers.", e.people ?? 1, "1", "1")}
    ${numInput("hours", "Heures", e.hours, "0.25", "0")}
    ${numInput("rate", "$/h", e.rate, "0.01", "0")}
    <div class="line-total">0 $</div>
    <button type="button" class="del" title="Retirer" aria-label="Retirer">&times;</button>`;
  $("labourList").appendChild(row);
  wireRow(row, focus);
}

function addOtherRow(e = {}, focus = false) {
  const row = document.createElement("div");
  row.className = "exp-row exp-other";
  row.innerHTML = `
    <label class="mini"><span>Quoi</span>
      <input class="lbl" type="text" placeholder="Ex. Peinture et paillettes" value="${esc(e.label)}"></label>
    ${numInput("amount", "Montant $", e.amount, "0.01", "0")}
    <button type="button" class="del" title="Retirer" aria-label="Retirer">&times;</button>`;
  $("otherList").appendChild(row);
  wireRow(row, focus);
}

function readExpenses() {
  const v = (row, cls) => row.querySelector(cls).value;
  const list = [];
  $("labourList").querySelectorAll(".exp-row").forEach((r) =>
    list.push(normalizeExpense({ type: "labour", label: v(r, ".lbl"), people: v(r, ".people"), hours: v(r, ".hours"), rate: v(r, ".rate") })));
  $("otherList").querySelectorAll(".exp-row").forEach((r) =>
    list.push(normalizeExpense({ type: "other", label: v(r, ".lbl"), amount: v(r, ".amount") })));
  return list;
}

function recalcExpenses() {
  const list = readExpenses();
  $("labourList").querySelectorAll(".exp-row").forEach((r, i) =>
    (r.querySelector(".line-total").textContent = money2(list.filter((e) => e.type === "labour")[i].total)));
  const exp = expenseTotals(list).total;
  const revenue = Number(invoice.subtotal) || 0;
  $("sumRevenue").textContent = money2(revenue);
  $("sumExpenses").textContent = money2(exp);
  $("sumProfit").textContent = money2(revenue - exp);
  $("sumProfit").parentElement.classList.toggle("neg", revenue - exp < 0);
}

async function saveNotes() {
  const btn = $("saveNotesBtn");
  const notes = serializeNotes({ text: $("noteText").value, expenses: readExpenses() });
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement…';
  const { error } = await supabase.from("alaska_invoices").update({ notes }).eq("id", invoice.id);
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Enregistrer les notes';
  if (error) { toast("Erreur : " + error.message, true); return; }
  invoice.notes = notes;
  notesDirty = false;
  toast("Notes enregistrées ✓");
}
