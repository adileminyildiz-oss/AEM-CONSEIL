// ============================================================================
// LAST — Edge Function « intake »
// Reçoit les demandes du site aemconseil.eu (contact, rappel, RDV, newsletter,
// kit, chatbot, identification), les enregistre dans la table `demandes` et
// notifie le cabinet par e-mail (Resend).
//
// Déploiement :  supabase functions deploy intake --no-verify-jwt
// Secrets requis :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (fournis automatiquement)
//   RESEND_API_KEY                            (à définir)
//   NOTIFY_TO   = aemconseil.sas@gmail.com    (destinataire des notifications)
//   ALLOW_ORIGIN = https://aemconseil.eu      (CORS)
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SOURCES = ["contact", "rappel", "rdv", "newsletter", "kit", "chatbot", "identification", "autre"];

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Content-Type": "application/json",
  };
}

Deno.serve(async (req) => {
  const allow = Deno.env.get("ALLOW_ORIGIN") || "*";
  const headers = cors(allow);

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method" }), { status: 405, headers });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "json" }), { status: 400, headers }); }

  // Anti-spam : honeypot
  if (body["_honey"]) return new Response(JSON.stringify({ ok: true }), { headers });

  const source = SOURCES.includes(String(body.source)) ? String(body.source) : "autre";
  const row = {
    source,
    type: str(body.type),
    nom: str(body.nom),
    prenom: str(body.prenom),
    email: str(body.email),
    telephone: str(body.telephone),
    siren: str(body.siren),
    entreprise: str(body.entreprise),
    objet: str(body.objet),
    message: str(body.message),
    meta: (body.meta && typeof body.meta === "object") ? body.meta : {},
  };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase.from("demandes").insert(row).select("id").single();
  if (error) return new Response(JSON.stringify({ error: "db", detail: error.message }), { status: 500, headers });

  // Notification e-mail (best-effort, n'échoue pas la requête)
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const notifyTo = Deno.env.get("NOTIFY_TO");
  if (resendKey && notifyTo) {
    const lines = Object.entries(row)
      .filter(([k, v]) => v && k !== "meta")
      .map(([k, v]) => `<tr><td style="padding:4px 10px;color:#64748b">${k}</td><td style="padding:4px 10px"><b>${esc(String(v))}</b></td></tr>`)
      .join("");
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "LAST <notifications@aemconseil.eu>",
          to: [notifyTo],
          subject: `Nouvelle demande (${source}) — AEM-CONSEIL`,
          html: `<h2>Nouvelle demande — ${source}</h2><table>${lines}</table>
                 <p><a href="https://last.aemconseil.eu/#demandes">Ouvrir dans LAST →</a></p>`,
        }),
      });
    } catch { /* non bloquant */ }
  }

  return new Response(JSON.stringify({ ok: true, id: data.id }), { headers });
});

function str(v: unknown): string { return v == null ? "" : String(v).slice(0, 4000).trim(); }
function esc(s: string): string { return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c)); }
