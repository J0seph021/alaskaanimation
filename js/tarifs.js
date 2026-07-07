/* ===========================================================
   Tarifs synchronisés avec le portail
   -----------------------------------------------------------
   Lit la liste des services/prix depuis Supabase (fonction
   publique get_public_services, qui n'expose QUE les prix).
   Maggie modifie ses prix dans le portail (page Réglages) et
   ils se mettent à jour ici automatiquement.

   Si le réseau échoue, la liste de secours déjà présente dans
   le HTML reste affichée — la page n'est jamais vide.
   =========================================================== */
(function () {
  "use strict";

  var SUPABASE_URL = "https://ryaigwgkskeceseglhli.supabase.co";
  var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5YWlnd2drc2tlY2VzZWdsaGxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDYzMDIsImV4cCI6MjA4OTUyMjMwMn0.amTLfnwn5nqeX_fSqbwc28WzwKjJkNoHdehlpN6MtCU";

  var el = document.getElementById("tarifsList");
  if (!el) return;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* Même format que les factures : « 205 », « 50,50 » */
  function fmt(n) {
    n = Number(n) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
  }

  function rowHtml(s) {
    var label = (s && s.label ? String(s.label) : "").trim();
    if (!label) return "";
    var price = Number(s && s.price) || 0;
    var priceHtml = price > 0
      ? '<span class="tarif-row__from">à partir de</span> ' + fmt(price) +
        '&nbsp;$<span class="tarif-row__unit">' + esc(s.suffix || "") + "</span>"
      : '<span class="tarif-row__ondemand">Sur demande</span>';
    return '<div class="tarif-row"><span class="tarif-row__label">' + esc(label) +
           '</span><span class="tarif-row__price">' + priceHtml + "</span></div>";
  }

  fetch(SUPABASE_URL + "/rest/v1/rpc/get_public_services", {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json"
    },
    body: "{}"
  })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (services) {
      if (!Array.isArray(services) || !services.length) return; // garder le secours
      var rows = services.map(rowHtml).join("");
      if (rows) el.innerHTML = rows;
    })
    .catch(function () {
      /* Réseau indisponible : la liste de secours du HTML reste affichée. */
    });
})();
