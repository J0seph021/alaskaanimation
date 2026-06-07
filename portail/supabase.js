/* Client Supabase partagé + utilitaires d'authentification */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* Redirige vers la page de connexion si personne n'est connecté.
   Retourne la session si tout va bien. */
export async function requireSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace("index.html");
    return null;
  }
  return session;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.replace("index.html");
}
