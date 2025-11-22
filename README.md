# Mail Analyzer - Lambda Function

Fonction Lambda AWS pour analyser les emails de réponses aux candidatures et générer un rapport des candidatures retenues.

## Fonctionnalités

- Connexion à Outlook.com via IMAP
- Analyse des emails des dernières 24 heures
- Identification des réponses à des candidatures
- Détection des candidatures retenues (via analyse de mots-clés)
- Génération et envoi d'un rapport par email

## Structure du projet

```
mailAnalyzer/
├── index.js          # Fonction Lambda principale
├── package.json      # Dépendances Node.js
├── Makefile          # Automatisation du déploiement
└── README.md         # Documentation
```

## Installation

```bash
make install
```

ou

```bash
npm install
```

## Configuration Lambda

⚠️ **IMPORTANT** : Microsoft exige maintenant OAuth2 (authentification moderne) pour accéder aux emails Outlook.com. L'authentification par mot de passe (même avec mot de passe d'application) n'est plus supportée depuis septembre 2024.

Cette solution utilise **Microsoft Graph API** avec OAuth2, ce qui est plus simple et plus fiable que IMAP.

### Prérequis : Configuration OAuth2

Avant de déployer, vous devez :

1. **Créer une application dans Azure AD** (voir `OAUTH_SETUP.md` pour les détails)
2. **Obtenir un refresh token** (une seule fois) en utilisant le script `get-refresh-token.js`

Consultez le fichier **`OAUTH_SETUP.md`** pour les instructions complètes de configuration OAuth2.

### Variables d'environnement

Configurez ces variables dans la console AWS Lambda > Configuration > Variables d'environnement :

- `EMAIL` : Adresse email Outlook/Hotmail (ex: `monmail@hotmail.com`)
- `MICROSOFT_CLIENT_ID` : ID client de votre application Azure AD
- `MICROSOFT_CLIENT_SECRET` : Secret client de votre application Azure AD
- `MICROSOFT_TENANT_ID` : ID tenant (utilisez `common` pour les comptes personnels)
- `MICROSOFT_REFRESH_TOKEN` : Refresh token OAuth2 obtenu via le script
- `PERPLEXITY_API_KEY` : Clé API Perplexity pour l'analyse intelligente des emails (optionnel, valeur par défaut incluse)
- `RECIPIENT_EMAIL` : Adresse email pour recevoir le rapport (optionnel, utilise `EMAIL` par défaut)

### Configuration Lambda recommandée

- **Runtime** : Node.js 18.x ou 20.x
- **Timeout** : 60 secondes (ajustable selon le volume d'emails)
- **Mémoire** : 512 MB (ajustable)
- **Région** : eu-west-3

## Déploiement

### Créer le package ZIP

```bash
make zip
```

### Déployer vers AWS Lambda

```bash
make deploy
```

**Note** : Assurez-vous d'avoir configuré AWS CLI avec les bonnes credentials :

```bash
aws configure
```

### Commandes Makefile complètes

- `make install` : Installer les dépendances npm
- `make zip` : Créer le package ZIP pour Lambda
- `make deploy` : Déployer vers AWS Lambda (mailAnalyzer dans eu-west-3)
- `make clean` : Nettoyer les fichiers temporaires
- `make deep-clean` : Nettoyer complètement (inclut node_modules)
- `make help` : Afficher l'aide

## Logique de détection

### Mots-clés de candidature

La fonction identifie les réponses de candidature en cherchant ces mots-clés dans le sujet et le corps :
- candidature
- poste
- cv
- candidat
- entretien
- recrutement
- application
- candidature pour

### Mots-clés positifs (retenu)

- retenu / retenue
- accepté / acceptée
- intéressé / intéressée
- sélectionné / sélectionnée
- retenu pour
- entretien
- convaincu / convaincue
- apprécié / appréciée

### Mots-clés négatifs (exclusion)

- refus / refusé / refusée
- non retenu / non retenue
- déclinée / décliner
- ne correspond pas

## Sécurité

⚠️ **Important** : Pour la production, il est fortement recommandé d'utiliser AWS Secrets Manager au lieu de variables d'environnement Lambda pour stocker les credentials.

## Obtenir un Refresh Token (première fois)

Pour obtenir un refresh token OAuth2 :

1. Suivez les instructions dans `OAUTH_SETUP.md` pour créer une application Azure AD
2. Remplacez `CLIENT_ID` et `CLIENT_SECRET` dans `get-refresh-token.js`
3. Exécutez le script :
   ```bash
   npm run get-token
   ```
4. Ouvrez l'URL affichée dans votre navigateur
5. Connectez-vous et autorisez l'application
6. Copiez le refresh token affiché et ajoutez-le dans les variables d'environnement Lambda

## Dépannage

### Erreur "MICROSOFT_REFRESH_TOKEN n'est pas configuré"

Vous devez d'abord obtenir un refresh token en suivant les étapes ci-dessus.

### Erreur de connexion IMAP (LOGIN failed) - Ancienne version

Si vous obtenez une erreur "LOGIN failed", suivez ces étapes dans l'ordre :

#### 1. Activer l'accès IMAP sur le compte Outlook (OBLIGATOIRE)

Selon la [documentation Microsoft](https://support.microsoft.com/fr-fr/office/paramètres-pop-imap-et-smtp-pour-outlook-com-d088b986-291d-42b8-9564-9c414e2aa040), l'accès IMAP est **désactivé par défaut** et doit être activé manuellement :

1. Allez sur https://outlook.live.com/mail/
2. Cliquez sur l'icône **Paramètres** (⚙️) en haut à droite
3. Sélectionnez **"Voir tous les paramètres Outlook"**
4. Allez dans **"Courrier"** > **"Transfert et POP/IMAP"**
5. Sous **"POP et IMAP"**, basculez le curseur **"Autoriser les appareils et les applications à utiliser IMAP"** sur **ACTIVÉ**
6. Sélectionnez **"Enregistrer"**

⚠️ **Important** : Sans cette activation, la connexion IMAP échouera toujours !

#### 2. Authentification à deux facteurs (2FA) - IMPORTANT

Si l'authentification à deux facteurs est activée sur votre compte Microsoft, vous **DEVEZ** utiliser un **mot de passe d'application** au lieu de votre mot de passe normal :

1. Allez sur https://account.microsoft.com/security
2. Assurez-vous que l'authentification à deux facteurs est activée
3. Cliquez sur "Mots de passe d'application" ou "App passwords"
4. Créez un nouveau mot de passe d'application (vous pouvez le nommer "Lambda Mail Analyzer")
5. **Copiez le mot de passe généré** (il ne sera affiché qu'une seule fois)
6. Utilisez ce mot de passe dans la variable d'environnement Lambda `PASSWORD`

**⚠️ Important** : Si 2FA est activé, votre mot de passe normal ne fonctionnera **PAS** avec IMAP. Vous devez absolument utiliser un mot de passe d'application.

#### 3. Vérifier les variables d'environnement Lambda

Dans la console AWS Lambda, vérifiez que :

- `EMAIL` : Contient votre adresse email complète (ex: `theo.bogdan@hotmail.com`)
- `PASSWORD` : Contient le mot de passe d'application (si 2FA est activé) ou votre mot de passe normal
- Aucun espace avant/après les valeurs
- Les valeurs sont bien sauvegardées

#### 4. Autoriser la connexion IMAP dans l'activité récente

Parfois, Microsoft bloque la connexion IMAP par sécurité. Si la connexion échoue :

1. Allez sur https://account.live.com/activity
2. Connectez-vous avec votre compte
3. Dans **"Activité récente"**, recherchez l'événement **"Type de session"** correspondant à l'heure de la tentative de connexion
4. Cliquez sur cet événement
5. Cliquez sur **"C'était moi"** pour autoriser la connexion IMAP
6. Réessayez la connexion

#### 5. Vérifier la configuration du serveur

Assurez-vous que le code utilise bien :
- **Serveur IMAP** : `outlook.office365.com` (pas `imap-mail.outlook.com`)
- **Port** : 993
- **Chiffrement** : SSL/TLS

#### 6. Alternative : Désactiver temporairement 2FA (non recommandé pour la sécurité)

Si vous ne pouvez pas utiliser un mot de passe d'application, vous pouvez temporairement désactiver l'authentification à deux facteurs, mais ce n'est **pas recommandé** pour des raisons de sécurité.

### Timeout Lambda

Si la fonction timeout, augmentez la valeur dans la configuration Lambda ou réduisez la période d'analyse.
