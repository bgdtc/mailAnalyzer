# Vérification du consentement Azure AD

L'erreur `AADSTS65001` indique que le consentement n'a pas été accordé pour l'application. Suivez ces étapes pour vérifier et corriger la configuration.

## Étape 1 : Vérifier les permissions API dans Azure AD

1. Allez sur https://portal.azure.com/
2. Naviguez vers **Azure Active Directory** > **App registrations**
3. Cliquez sur votre application **mailAnalyzer** (ID: `8aa96968-5ca7-4e20-8f6e-f5f069141287`)
4. Allez dans **"API permissions"** (Autorisations API)

### Vérifier que ces permissions sont bien ajoutées :

- ✅ `Mail.Read` (Delegated - Microsoft Graph)
- ✅ `Mail.Send` (Delegated - Microsoft Graph)  
- ✅ `offline_access` (Delegated - Microsoft Graph)
- ✅ `User.Read` (Delegated - Microsoft Graph)

### Si des permissions manquent :

1. Cliquez sur **"Add a permission"**
2. Sélectionnez **"Microsoft Graph"**
3. Sélectionnez **"Delegated permissions"**
4. Recherchez et ajoutez les permissions manquantes :
   - `Mail.Read`
   - `Mail.Send`
   - `offline_access`
   - `User.Read`
5. Cliquez sur **"Add permissions"**

## Étape 2 : Accorder le consentement administrateur

**IMPORTANT** : Pour les comptes personnels, vous devez accorder le consentement utilisateur, mais pour certaines organisations, un consentement administrateur peut être requis.

### Option A : Consentement utilisateur (pour comptes personnels)

1. Dans **"API permissions"**, vérifiez la colonne **"Status"** (État)
2. Si vous voyez "Not granted" ou un triangle jaune, vous devez donner votre consentement
3. **Vous avez déjà donné votre consentement** lors de l'exécution de `get-refresh-token.js` si vous avez accepté les autorisations

### Option B : Consentement administrateur (si nécessaire)

1. Cliquez sur le bouton **"Grant admin consent for [your tenant]"**
2. Cliquez sur **"Yes"** pour confirmer
3. Attendez que le statut passe à "Granted for [your tenant]" avec une coche verte

## Étape 3 : Vérifier que le consentement a été donné

1. Dans **"API permissions"**, tous les statuts doivent afficher :
   - ✅ **"Granted for [your email]"** ou
   - ✅ **"Granted for [your tenant]"**

2. Si vous voyez encore des triangles jaunes ou "Not granted", cliquez sur **"Grant admin consent"**

## Étape 4 : Réobtenir un nouveau refresh token

Si vous avez modifié les permissions ou accordé le consentement, vous devez obtenir un nouveau refresh token :

1. Exécutez à nouveau le script :
   ```bash
   npm run get-token
   ```

2. Connectez-vous et **acceptez les nouvelles autorisations**

3. Copiez le nouveau refresh token

4. Mettez à jour la variable d'environnement `MICROSOFT_REFRESH_TOKEN` dans AWS Lambda

## Étape 5 : Vérifier les variables d'environnement Lambda

Assurez-vous que toutes ces variables sont correctement configurées dans AWS Lambda :

```
EMAIL=votre_email@hotmail.com
MICROSOFT_CLIENT_ID=votre_client_id
MICROSOFT_CLIENT_SECRET=votre_client_secret
MICROSOFT_TENANT_ID=common
MICROSOFT_REFRESH_TOKEN=<votre_refresh_token_complet>
SMTP_PASSWORD=ldbrkqupzqnvxzhu
RECIPIENT_EMAIL=theo.bogdan@hotmail.com
```

## Problème persistant ?

Si l'erreur persiste après avoir accordé le consentement :

1. **Vérifiez que le refresh token est complet** - Il peut être très long (plusieurs lignes)
2. **Vérifiez qu'il n'y a pas d'espaces** avant ou après le token dans Lambda
3. **Réobtenez un nouveau refresh token** après avoir accordé le consentement
4. **Attendez quelques minutes** après avoir accordé le consentement pour que les changements se propagent

## Test rapide

Pour tester rapidement si le problème vient du refresh token ou du consentement :

1. Allez sur https://portal.azure.com/
2. Votre application > **"API permissions"**
3. Vérifiez que toutes les permissions ont un statut **"Granted"** (coche verte)
4. Si ce n'est pas le cas, cliquez sur **"Grant admin consent"**
