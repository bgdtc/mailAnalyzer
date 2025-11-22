# Correction des permissions Azure AD

## Problème identifié

Vos permissions actuelles sont de type **"Application"** (Application permissions), mais pour un compte personnel avec OAuth2, vous avez besoin de permissions **"Déléguées"** (Delegated permissions).

## Différence entre Application et Déléguées

- **Application** : Pour les applications qui agissent en leur propre nom (sans utilisateur connecté)
- **Déléguées** : Pour les applications qui agissent **au nom de l'utilisateur connecté** (notre cas)

## Permissions nécessaires (type DÉLÉGUÉES)

Pour votre application, vous devez avoir ces permissions **de type "Déléguées"** :

1. ✅ `User.Read` - "Activer la connexion et lire le profil utilisateur" (déjà présente)
2. ❌ `Mail.Read` - "Lire le courrier de l'utilisateur" (à ajouter en déléguée)
3. ❌ `Mail.Send` - "Envoyer un e-mail en tant qu'utilisateur" (à ajouter en déléguée)
4. ❌ `offline_access` - "Maintenir l'accès aux données auxquelles vous avez accordé l'accès" (à ajouter en déléguée)

## Étapes pour corriger

### 1. Ajouter les permissions déléguées manquantes

1. Dans Azure AD > App registrations > mailAnalyzer
2. Allez dans **"API permissions"** (Autorisations API)
3. Cliquez sur **"Add a permission"** (Ajouter une autorisation)
4. Sélectionnez **"Microsoft Graph"**
5. Sélectionnez **"Delegated permissions"** (Autorisations déléguées) ⚠️ **IMPORTANT**
6. Dans la recherche, tapez et sélectionnez :
   - `Mail.Read` - Cochez cette permission
   - `Mail.Send` - Cochez cette permission
   - `offline_access` - Cochez cette permission (si pas déjà présente)
7. Cliquez sur **"Add permissions"**

### 2. Vérifier que les permissions sont de type Déléguées

Dans le tableau des permissions, vous devriez voir :

| Permission | Type | Statut |
|------------|------|--------|
| `User.Read` | **Déléguée** | ✓ Accordé |
| `Mail.Read` | **Déléguée** | À accorder |
| `Mail.Send` | **Déléguée** | À accorder |
| `offline_access` | **Déléguée** | À accorder |

### 3. Accorder le consentement pour les permissions déléguées

1. Cliquez sur **"Grant admin consent for [Répertoire par défaut]"** 
   (ou accordez le consentement utilisateur lors de l'autorisation)
2. Confirmez l'action
3. Attendez que tous les statuts passent à **"✓ Accordé pour Répertoire..."**

### 4. Note sur les permissions Application

Les permissions Application que vous avez actuellement (Mail.Read, Mail.Send, etc. en type Application) **ne sont pas nécessaires** pour votre cas d'usage. Vous pouvez :
- Les laisser en place (elles ne nuisent pas)
- Ou les supprimer si vous voulez nettoyer (optionnel)

L'important est d'avoir les **permissions déléguées** correspondantes.

## Après correction

Une fois les permissions déléguées ajoutées et le consentement accordé :

1. **Réobtenez un nouveau refresh token** :
   ```bash
   npm run get-token
   ```

2. **Acceptez les nouvelles autorisations** lors de la connexion

3. **Copiez le nouveau refresh token**

4. **Mettez à jour** `MICROSOFT_REFRESH_TOKEN` dans AWS Lambda

5. **Redéployez** la Lambda :
   ```bash
   make zip
   make deploy
   ```
