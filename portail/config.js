/* ===========================================================
   Portail Alaska Animation — Configuration
   -----------------------------------------------------------
   Tu peux modifier les infos d'entreprise ci-dessous : elles
   apparaissent en haut de chaque facture (impression / PDF).

   ⚠️ Ne change PAS SUPABASE_URL ni SUPABASE_KEY : ce sont les
   coordonnées de ta base de données (la clé est « publique »,
   c'est normal et sans danger — l'accès est protégé par mot
   de passe et par les règles de sécurité de la base).
   =========================================================== */

export const SUPABASE_URL = "https://ryaigwgkskeceseglhli.supabase.co";
export const SUPABASE_KEY = "sb_publishable_0PuIPgM4uq61bgBZn8TDbQ_y9vbC8xd";

/* Infos affichées sur les factures — ajuste-les à ta convenance */
export const BUSINESS = {
  name:    "Alaska Animation",
  tagline: "Animation de fêtes · Maquillage de fantaisie · Sculptures de ballons",
  region:  "Région des Bois-Francs · Plessisville (QC)",
  email:   "",            // ← ajoute ton courriel d'affaires (apparaît sur la facture)
  phone:   "",            // ← ajoute ton numéro de téléphone (optionnel)
  website: "alaskaanimation.ca",
  logo:    "../images/logo/logo-alaska-animation.svg",
};

/* Suggestions de services (remplissent automatiquement la liste déroulante).
   Le prix est seulement une suggestion — tu peux toujours le changer. */
export const SERVICES = [
  { label: "Maquillage de fantaisie (par heure)", price: 0 },
  { label: "Sculptures de ballons (par heure)",   price: 0 },
  { label: "Animation de fête complète",          price: 0 },
  { label: "Événement corporatif / festival",     price: 0 },
  { label: "Frais de déplacement",                price: 0 },
];
