# SIREN Autofill — remplissage automatique des informations entreprise

Composant **autonome, sans dépendance**, à intégrer dans le formulaire d'inscription
client / création de facture de la plateforme **yada.aemconseil.eu**.

Le client saisit son **SIREN** (ou **SIRET**) → les informations légales de son
entreprise sont récupérées automatiquement et les champs sont pré-remplis. Objectif :
**améliorer la qualité des factures** (mentions exactes, moins de saisie, moins d'erreurs).

## Source des données

**API officielle et gratuite de l'État** : `https://recherche-entreprises.api.gouv.fr`
— données **INSEE Sirene + INPI/RNE**. Aucune clé, CORS autorisé (appel direct depuis
le navigateur), pas de quota bloquant pour un usage normal.

> ⚠️ Éviter le « scraping » de Pappers.com / Société.com : contraire à leurs
> conditions d'utilisation et peu fiable. L'API officielle ci-dessus couvre le même
> besoin, légalement et gratuitement. (Pappers propose aussi une API, mais payante.)

## Champs récupérés

| Clé (objet `data`) | Contenu |
|---|---|
| `siren` | SIREN (9 chiffres) |
| `siret` | SIRET du siège (14 chiffres) |
| `raisonSociale` | Dénomination / raison sociale |
| `formeJuridique` | Forme juridique (libellé) + `formeJuridiqueCode` |
| `adresse` | Voie (n° + type + libellé) |
| `adresseComplete` | Adresse complète du siège |
| `codePostal`, `ville` | Localisation du siège |
| `codeApe`, `libelleApe` | Activité principale (NAF/APE) |
| `tvaIntra` | N° TVA intracommunautaire (FR) — **calculé** à partir du SIREN |
| `dirigeant` | Premier dirigeant (si disponible) |
| `dateCreation` | Date de création |
| `raw` | Réponse brute de l'API (pour aller plus loin) |

## Intégration en 2 étapes

**1. Charger le script** (une ligne) :
```html
<script src="/chemin/vers/siren-autofill.js"></script>
```

**2. Lier le composant à votre formulaire** :
```html
<input id="siren" placeholder="SIREN / SIRET">
<button id="siren-go" type="button">Rechercher</button>
<span id="siren-status"></span>

<script>
  SirenAutofill.bind({
    input:  '#siren',
    button: '#siren-go',      // optionnel (sinon : touche Entrée + sortie de champ)
    status: '#siren-status',  // optionnel (messages d'état)
    fields: {                 // mappez chaque clé vers le sélecteur de votre champ
      raisonSociale: '#client-nom',
      siret:         '#client-siret',
      tvaIntra:      '#client-tva',
      adresse:       '#client-adresse',
      codePostal:    '#client-cp',
      ville:         '#client-ville',
      formeJuridique:'#client-forme',
      codeApe:       '#client-ape'
    },
    onResult: function (data) { /* traitement supplémentaire éventuel */ },
    onError:  function (err)  { /* gestion d'erreur éventuelle */ },
    auto: true                // remplissage aussi à la sortie du champ (défaut : true)
  });
</script>
```

`setField` déclenche des événements `input`/`change` : compatible **React, Vue,
Angular** et formulaires classiques. Laissez vos champs **modifiables** pour que le
client puisse compléter (ex. complément d'adresse) ou corriger.

## Utilisation programmatique (sans binding)

```js
SirenAutofill.lookup('552081317')
  .then(data => console.log(data.raisonSociale, data.tvaIntra))
  .catch(err => console.error(err.message));

SirenAutofill.isValidSiren('552081317'); // true (Luhn)
SirenAutofill.tvaIntra('552081317');      // "FR..........."
```

## Notes

- **Validation** : contrôle de longueur + clé de Luhn (SIREN 9 / SIRET 14, dérogation
  La Poste incluse) avant tout appel réseau.
- **Forme juridique** : la table `SirenAutofill.FORMES` mappe les codes INSEE les plus
  courants ; complétez-la si besoin (les codes non listés renvoient « Code XXXX »).
- **TVA intracommunautaire** : calculée localement (`FR` + clé + SIREN), non fournie par
  l'API — c'est la méthode standard pour les entreprises françaises.
- **Confidentialité** : seul le SIREN saisi est envoyé à l'API publique de l'État ;
  aucune donnée client n'est transmise ailleurs.

## Démonstration

Ouvrez `demo.html` (servi en HTTP) et testez avec un vrai SIREN. Le composant fonctionne
sur toute page — il suffit d'inclure `siren-autofill.js`.
