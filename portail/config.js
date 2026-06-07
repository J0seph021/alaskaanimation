/* ===========================================================
   Portail Alaska Animation — Configuration technique
   -----------------------------------------------------------
   ⚠️ Maggie n'a PAS besoin de toucher à ce fichier.
   Tous les réglages modifiables (services, prix, coordonnées,
   courriel…) se font dans la page « ⚙️ Réglages » du portail.

   Ne change PAS les deux clés ci-dessous : ce sont les
   coordonnées de la base de données (la clé est « publique »,
   c'est normal — l'accès reste protégé par mot de passe + RLS).
   =========================================================== */

export const SUPABASE_URL = "https://ryaigwgkskeceseglhli.supabase.co";
export const SUPABASE_KEY = "sb_publishable_0PuIPgM4uq61bgBZn8TDbQ_y9vbC8xd";

/* Valeurs par défaut si aucun réglage n'existe encore.
   (Sert seulement de filet de sécurité — les vrais réglages
   sont enregistrés dans la base via la page Réglages.) */
export const DEFAULT_SETTINGS = {
  business: {
    owner_name:    "Maggie Forget",
    business_name: "Alaska Animation",
    owner_title:   "Propriétaire de Alaska Animation",
    address:       "1735 rue chanoine-boulet\nPlessisville, Qc, G6L 1B3",
    phone:         "(514)708-8281",
    email:         "alaskaanimationco@outlook.com",
  },
  next_invoice_no: 1,
  services: [
    { label: "Forfait maquillage fantaisie base",        price: 205, suffix: "/h" },
    { label: "Forfait maquillage fantaisie additionnel", price: 145, suffix: ""   },
    { label: "Sculptures de ballons",                     price: 0,   suffix: "/h" },
    { label: "Animation de fête complète",                price: 0,   suffix: ""   },
    { label: "Événement corporatif / festival",          price: 0,   suffix: "/h" },
    { label: "Frais de déplacement",                      price: 0,   suffix: ""   },
  ],
};
