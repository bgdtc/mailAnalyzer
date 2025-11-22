# Configuration OAuth2 pour Microsoft Graph API

Microsoft exige maintenant OAuth2 (authentification moderne) pour accéder aux emails Outlook.com via IMAP/SMTP. Cette solution utilise Microsoft Graph API qui est plus simple et plus fiable.

## Étape 1 : Enregistrer une application dans Azure AD

1. Allez sur https://portal.azure.com/
2. Connectez-vous avec votre compte Microsoft (theo.bogdan@hotmail.com)
3. Recherchez "Azure Active Directory" ou "Microsoft Entra ID"
4. Allez dans **"App registrations"** (Inscriptions d'applications)
5. Cliquez sur **"New registration"** (Nouvelle inscription)

### Configuration de l'application

- **Name** : `Mail Analyzer Lambda`
- **Supported account types** / **Types de comptes pris en charge** : 
  - **Sélectionnez** : **"Comptes dans un annuaire d'organisation (tout locataire Microsoft Entra ID – Multilocataire) et comptes Microsoft personnels (par exemple, Skype, Xbox)"**
  - Ou en anglais : **"Accounts in any organizational directory and personal Microsoft accounts"**
  - ⚠️ **IMPORTANT** : Cette option permet d'utiliser votre compte personnel Hotmail
- **Redirect URI (URI de redirection)** : 
  - Cliquez sur **"Sélectionner une plateforme"** / **"Select a platform"**
  - Choisissez **"Web"**
  - Dans le champ URI, entrez : `http://localhost:3000/callback`
  - Cliquez sur **"Configurer"** / **"Configure"**
- Cliquez sur **"Register"** / **"Inscription"**

### Noter les informations importantes

Après l'enregistrement, notez :
- **Application (client) ID** : Copiez cette valeur
- **Directory (tenant) ID** : Copiez cette valeur

## Étape 2 : Configurer les autorisations API

1. Dans votre application, allez dans **"API permissions"** (Autorisations API)
2. Cliquez sur **"Add a permission"**
3. Sélectionnez **"Microsoft Graph"**
4. Sélectionnez **"Delegated permissions"** (Autorisations déléguées)
5. Ajoutez les permissions suivantes :
   - `Mail.Read`
   - `Mail.Send`
   - `offline_access`
   - `User.Read`
6. Cliquez sur **"Add permissions"**
7. Cliquez sur **"Grant admin consent for..."** si disponible (sinon vous devrez le faire lors de l'autorisation)

## Étape 3 : Créer un secret client

1. Dans votre application, allez dans **"Certificates & secrets"** (Certificats et secrets)
2. Dans la section **"Client secrets"**, cliquez sur **"New client secret"**
3. Description : `Lambda Secret`
4. Expiration : Choisissez 24 mois (ou plus)
5. Cliquez sur **"Add"**
6. **⚠️ IMPORTANT** : Copiez immédiatement la **Valeur** du secret (elle ne sera plus visible après)

## Étape 4 : Obtenir un refresh token (une seule fois)

Vous devez obtenir un refresh token en autorisant l'application une première fois. Voici comment procéder :

### Option A : Utiliser le script Node.js (recommandé)

Créez un fichier `get-refresh-token.js` localement :

```javascript
const http = require('http');
const url = require('url');

const CLIENT_ID = 'VOTRE_CLIENT_ID';
const TENANT_ID = 'common'; // ou votre tenant ID
const REDIRECT_URI = 'http://localhost:3000/callback';

const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?` +
  `client_id=${CLIENT_ID}&` +
  `response_type=code&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `response_mode=query&` +
  `scope=offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send&` +
  `state=12345`;

console.log('Ouvrez cette URL dans votre navigateur :');
console.log(authUrl);
console.log('\nAttendez la redirection...\n');

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  if (parsedUrl.pathname === '/callback') {
    const code = parsedUrl.query.code;
    const error = parsedUrl.query.error;
    
    if (error) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<h1>Erreur: ${error}</h1>`);
      console.error('Erreur:', error);
      server.close();
      return;
    }
    
    if (code) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <h1>Code reçu!</h1>
        <p>Vérifiez la console pour le refresh token.</p>
        <p>Code: ${code.substring(0, 20)}...</p>
      `);
      
      // Échanger le code contre un refresh token
      exchangeCodeForToken(code);
    }
  }
});

server.listen(3000, () => {
  console.log('Serveur en attente sur http://localhost:3000');
});

async function exchangeCodeForToken(code) {
  const CLIENT_SECRET = 'VOTRE_CLIENT_SECRET';
  
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  params.append('code', code);
  params.append('redirect_uri', REDIRECT_URI);
  params.append('grant_type', 'authorization_code');
  params.append('scope', 'offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send');

  try {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    const data = await response.json();
    
    if (data.refresh_token) {
      console.log('\n✅ REFRESH TOKEN OBTENU :');
      console.log(data.refresh_token);
      console.log('\n⚠️ Ajoutez ce token dans les variables d\'environnement Lambda :');
      console.log('MICROSOFT_REFRESH_TOKEN=' + data.refresh_token);
    } else {
      console.error('Erreur:', data);
    }
    
    server.close();
  } catch (error) {
    console.error('Erreur:', error);
    server.close();
  }
}
```

Remplacez `VOTRE_CLIENT_ID` et `VOTRE_CLIENT_SECRET`, puis exécutez :
```bash
node get-refresh-token.js
```

### Option B : Utiliser Postman ou curl

Suivez la documentation Microsoft pour obtenir un refresh token via le flux d'autorisation OAuth2.

## Étape 5 : Configurer les variables d'environnement Lambda

Dans AWS Lambda Console > Configuration > Variables d'environnement, ajoutez :

```
EMAIL=theo.bogdan@hotmail.com
MICROSOFT_CLIENT_ID=votre_client_id
MICROSOFT_CLIENT_SECRET=votre_client_secret
MICROSOFT_TENANT_ID=common (ou votre tenant ID)
MICROSOFT_REFRESH_TOKEN=votre_refresh_token
SMTP_PASSWORD=mot_de_passe_application_smtp (pour l'envoi d'emails)
RECIPIENT_EMAIL=theo.bogdan@hotmail.com (optionnel)
```

## Notes importantes

- Le **refresh token** expire après une période d'inactivité (généralement 90 jours)
- Si le refresh token expire, vous devrez en obtenir un nouveau en répétant l'étape 4
- Le code mettra automatiquement à jour le refresh token s'il reçoit un nouveau token de Microsoft
- Pour SMTP, vous pouvez encore utiliser un mot de passe d'application temporairement, mais idéalement il faudrait aussi utiliser OAuth2 pour SMTP

## Références

- [Documentation Microsoft Graph API](https://learn.microsoft.com/en-us/graph/overview)
- [Authentification OAuth2 avec Microsoft Graph](https://learn.microsoft.com/en-us/graph/auth-v2-user)
