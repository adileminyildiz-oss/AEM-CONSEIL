# Assistant IA générative — fonction Edge `chat`

Backend optionnel qui fait passer l'assistant du site d'un **mode local** (réponses
issues de la base de connaissances embarquée) à une **vraie IA générative** propulsée
par Claude. La clé API reste côté serveur : elle n'est jamais exposée au navigateur.

Tant que ce backend n'est pas déployé **ou** que `window.AEM_CHAT_ENDPOINT` n'est pas
défini, le widget continue de fonctionner en mode local, sans aucun coût d'API.

## Architecture

```
Navigateur (assets/chat.js)
   │  POST { messages: [{ role, content }, …] }
   ▼
Fonction Edge Supabase  /functions/v1/chat   ← secret ANTHROPIC_API_KEY
   │  Messages API
   ▼
Claude (claude-opus-5)  →  { reply: "…" }
```

## Prérequis

- [Supabase CLI](https://supabase.com/docs/guides/cli) installé et connecté (`supabase login`).
- Le projet Supabase du cabinet (référence `ammmyhtxnwyoopfxtans`).
- Une clé API Anthropic (console.anthropic.com).

## Déploiement (3 étapes)

```bash
# 1. Lier le dépôt local au projet Supabase
supabase link --project-ref ammmyhtxnwyoopfxtans

# 2. Enregistrer la clé API comme secret (jamais dans le code ni le dépôt)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
#   Optionnel : restreindre l'origine autorisée (CORS)
supabase secrets set AEM_ALLOWED_ORIGIN=https://aemconseil.eu

# 3. Déployer la fonction
supabase functions deploy chat
```

L'URL de la fonction sera :
`https://ammmyhtxnwyoopfxtans.supabase.co/functions/v1/chat`

## Activation côté site

Ajouter cette ligne dans `index.html` **avant** le chargement de `assets/chat.js`
(et, pour les pages statiques, dans le `head()` de `scripts/build-static.mjs`) :

```html
<script>window.AEM_CHAT_ENDPOINT = 'https://ammmyhtxnwyoopfxtans.supabase.co/functions/v1/chat';</script>
```

En cas d'erreur réseau ou d'indisponibilité du backend, `chat.js` bascule
automatiquement sur l'assistant local : le visiteur obtient toujours une réponse.

## Test rapide

```bash
curl -i -X POST https://ammmyhtxnwyoopfxtans.supabase.co/functions/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Le premier rendez-vous est-il gratuit ?"}]}'
```

Réponse attendue : `{ "reply": "Oui, le premier rendez-vous est offert et sans engagement…" }`

## Contrat d'API

**Requête** `POST` · `Content-Type: application/json`
```json
{ "messages": [ { "role": "user", "content": "…" }, { "role": "assistant", "content": "…" } ] }
```

**Réponse**
```json
{ "reply": "texte de la réponse" }
```
En cas d'erreur : `{ "error": "message" }` avec un code HTTP 4xx/5xx.

## Personnalisation

- **Modèle** : constante `MODEL` dans `index.ts` (défaut `claude-opus-5`).
- **Périmètre / ton** : constante `SYSTEM_PROMPT` (services, FAQ, règles).
- **Longueur des réponses** : `max_tokens` (défaut 700).
- **Historique conservé** : `sanitize()` garde les 12 derniers messages.
