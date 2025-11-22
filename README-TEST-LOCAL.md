# Test Local

Pour tester la fonction Lambda en local sans avoir à déployer à chaque fois.

## Installation

1. Installez les dépendances :
   ```bash
   npm install
   ```

2. Créez un fichier `.env` à la racine du projet avec vos variables d'environnement :

   ```env
   EMAIL=votre_email@hotmail.com
   MICROSOFT_CLIENT_ID=votre_client_id
   MICROSOFT_CLIENT_SECRET=votre_client_secret
   MICROSOFT_TENANT_ID=common
   MICROSOFT_REFRESH_TOKEN=votre_refresh_token_complet_ici
   PERPLEXITY_API_KEY=votre_cle_api_perplexity
   RECIPIENT_EMAIL=votre_email@hotmail.com
   ```

   ⚠️ **Important** : Le fichier `.env` est dans `.gitignore` et ne sera pas commité. Ne partagez jamais vos credentials.

## Utilisation

Exécutez simplement :

```bash
npm run test-local
```

ou directement :

```bash
node test-local.js
```

## Avantages

- ✅ Test rapide sans déployer sur Lambda
- ✅ Logs en temps réel dans votre terminal
- ✅ Débogage plus facile
- ✅ Pas besoin de refresh token à chaque fois (tant que le token est valide)

## Mise à jour du refresh token

Si vous obtenez une erreur indiquant que le refresh token est expiré ou invalide :

1. Exécutez `npm run get-token` pour obtenir un nouveau refresh token
2. Mettez à jour la variable `MICROSOFT_REFRESH_TOKEN` dans votre fichier `.env`
3. Relancez `npm run test-local`
