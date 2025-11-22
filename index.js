const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const { subDays, format } = require('date-fns');

// Configuration des mots-clés pour identifier les réponses de candidature
const CANDIDATURE_KEYWORDS = [
  'candidature',
  'poste',
  'cv',
  'candidat',
  'entretien',
  'recrutement',
  'application',
  'candidature pour'
];

// Mots-clés positifs pour les candidatures retenues
const POSITIVE_KEYWORDS = [
  'retenu',
  'retenue',
  'accepté',
  'acceptée',
  'intéressé',
  'intéressée',
  'sélectionné',
  'sélectionnée',
  'retenu pour',
  'entretien',
  'convaincu',
  'convaincue',
  'apprécié',
  'appréciée'
];

// Mots-clés négatifs (exclusion)
const NEGATIVE_KEYWORDS = [
  'refus',
  'refusé',
  'refusée',
  'non retenu',
  'non retenue',
  'déclinée',
  'décliner',
  'ne correspond pas'
];

/**
 * Vérifie si un texte contient des mots-clés de candidature
 */
function isCandidatureResponse(subject, text) {
  const content = `${subject} ${text}`.toLowerCase();
  return CANDIDATURE_KEYWORDS.some(keyword => 
    content.includes(keyword.toLowerCase())
  );
}

/**
 * Analyse un email avec Perplexity pour déterminer le statut de la candidature
 * Retourne un objet avec: status (accepted/rejected/neutral), companyName, reason, nextStep
 */
async function analyzeEmailWithPerplexity(subject, text, from) {
  const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!perplexityApiKey) {
    throw new Error('PERPLEXITY_API_KEY n\'est pas configuré dans les variables d\'environnement');
  }
  
  // Limiter la taille du texte pour économiser les tokens (premiers 2000 caractères)
  const truncatedText = text.substring(0, 2000);
  
  const prompt = `Analyse ce mail de réponse à une candidature et réponds UNIQUEMENT avec un JSON valide au format suivant (sans texte avant ou après) :

{
  "status": "accepted" | "rejected" | "neutral",
  "companyName": "nom de l'entreprise si trouvé, sinon null",
  "reason": "raison du refus si rejected, prochaine étape si accepted, null si neutral",
  "nextStep": "description de la prochaine étape du processus si accepted, null sinon"
}

Critères :
- "accepted" : le mail invite à une étape suivante (entretien, test, etc.) ou confirme un intérêt positif
- "rejected" : le mail refuse explicitement la candidature
- "neutral" : le mail est une réponse mais sans décision claire

Sujet du mail: ${subject}
Expéditeur: ${from}
Contenu: ${truncatedText}`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'Tu es un assistant qui analyse des emails de recrutement. Réponds UNIQUEMENT avec du JSON valide, sans texte supplémentaire.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erreur API Perplexity:', response.status, errorText);
      // En cas d'erreur, retourner une analyse neutre
      return {
        status: 'neutral',
        companyName: null,
        reason: null,
        nextStep: null
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    
    // Extraire le JSON de la réponse (peut contenir du markdown)
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      jsonMatch = content;
    }
    
    try {
      const analysis = JSON.parse(jsonMatch[0] || jsonMatch);
      return {
        status: analysis.status || 'neutral',
        companyName: analysis.companyName || null,
        reason: analysis.reason || null,
        nextStep: analysis.nextStep || null
      };
    } catch (parseError) {
      console.error('Erreur parsing réponse Perplexity:', parseError, 'Contenu:', content);
      return {
        status: 'neutral',
        companyName: null,
        reason: null,
        nextStep: null
      };
    }
  } catch (error) {
    console.error('Erreur lors de l\'appel Perplexity:', error);
    return {
      status: 'neutral',
      companyName: null,
      reason: null,
      nextStep: null
    };
  }
}

/**
 * Obtient un access token OAuth2 depuis un refresh token
 */
async function getAccessTokenFromRefreshToken() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  const refreshToken = process.env.MICROSOFT_REFRESH_TOKEN;
  const email = process.env.EMAIL || 'monmail@hotmail.com';

  if (!refreshToken) {
    throw new Error('MICROSOFT_REFRESH_TOKEN n\'est pas configuré. Vous devez d\'abord obtenir un refresh token.');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('refresh_token', refreshToken);
  params.append('grant_type', 'refresh_token');
  // Utiliser exactement les mêmes scopes que lors de l'obtention initiale du refresh token
  // Ordre important : offline_access en premier, puis les scopes Graph
  // Demander tous les scopes nécessaires : User.Read pour /me, Mail.Read/Send pour les emails, offline_access pour le refresh token
  params.append('scope', 'offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send');

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: 'unknown', error_description: errorText };
      }
      
      // Vérifier si c'est une erreur de consentement
      if (errorData.error === 'invalid_grant' && 
          (errorData.error_description?.includes('consent') || 
           errorData.error_description?.includes('AADSTS65001'))) {
        throw new Error(`Le consentement n'a pas été accordé pour l'application. ` +
          `Vérifiez dans Azure AD que les permissions API sont accordées. ` +
          `Vous devrez peut-être obtenir un nouveau refresh token après avoir accordé le consentement. ` +
          `Erreur: ${errorData.error_description}`);
      }
      
      throw new Error(`Erreur lors de l'obtention du token: ${response.status} ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    // Sauvegarder le nouveau refresh token si fourni
    if (data.refresh_token) {
      console.log('Nouveau refresh token obtenu (à mettre à jour dans les variables d\'environnement)');
      console.log('Nouveau refresh token:', data.refresh_token.substring(0, 30) + '...');
    }
    
    // Log des scopes obtenus (pour debug)
    if (data.scope) {
      console.log('Scopes dans le token:', data.scope);
    }
    
    // Log du type de token et de l'expiration
    if (data.token_type) {
      console.log('Type de token:', data.token_type);
    }
    if (data.expires_in) {
      console.log('Token expire dans:', data.expires_in, 'secondes');
    }
    
    // Décoder le token JWT pour vérifier les scopes réels
    try {
      const tokenParts = data.access_token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        console.log('Scopes dans le JWT (payload):', payload.scp || payload.roles || 'non trouvé');
        console.log('Audience JWT:', payload.aud);
        console.log('UPN/Email JWT:', payload.upn || payload.email || payload.preferred_username || 'non trouvé');
      }
    } catch (e) {
      console.log('Impossible de décoder le JWT pour debug');
    }
    
    if (!data.access_token) {
      throw new Error('Aucun access_token dans la réponse');
    }
    
    return data.access_token;
  } catch (error) {
    console.error('Erreur getAccessToken:', error);
    throw error;
  }
}

/**
 * Récupère les mails des dernières 24 heures via Microsoft Graph API
 */
async function fetchRecentEmails(accessToken, email) {
  // Calculer la date d'il y a 24 heures
  const yesterday = subDays(new Date(), 1);
  const filterDate = format(yesterday, "yyyy-MM-dd'T'HH:mm:ss'Z'");
  
  // Décoder le token pour vérifier les scopes (pour debug)
  try {
    const tokenParts = accessToken.split('.');
    if (tokenParts.length === 3) {
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      console.log('Scopes dans le token JWT:', payload.scp || payload.roles || 'non trouvé');
      console.log('Audience du token:', payload.aud);
      console.log('UPN/Email du token:', payload.upn || payload.email || payload.preferred_username || 'non trouvé');
    }
  } catch (e) {
    console.log('Impossible de décoder le token JWT pour debug');
  }
  
  // Test d'abord avec /me pour vérifier que l'authentification fonctionne
  try {
    console.log('Test de connexion avec /me...');
    console.log('Token utilisé (premiers 20 caractères):', accessToken.substring(0, 20) + '...');
    
    const meResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Lire les headers de réponse pour debug
    const meResponseHeaders = {};
    meResponse.headers.forEach((value, key) => {
      meResponseHeaders[key] = value;
    });
    
    if (!meResponse.ok) {
      const meErrorText = await meResponse.text();
      let meErrorDetails;
      try {
        meErrorDetails = JSON.parse(meErrorText);
      } catch (e) {
        meErrorDetails = { error: meErrorText };
      }
      
      console.error('Erreur avec /me:', {
        status: meResponse.status,
        statusText: meResponse.statusText,
        headers: meResponseHeaders,
        error: meErrorDetails
      });
      
      // Si c'est une erreur 401, cela peut indiquer que le token n'a pas les bons scopes
      // ou qu'il y a un problème avec le compte
      if (meResponse.status === 401) {
        throw new Error(`L'authentification de base échoue (test /me): ${meResponse.status}. ` +
          `Le token semble invalide ou ne contient pas les permissions nécessaires. ` +
          `Vérifiez que User.Read est bien accordé. ` +
          `Erreur: ${JSON.stringify(meErrorDetails)}`);
      }
      
      throw new Error(`L'authentification de base échoue (test /me): ${meResponse.status} - ${meErrorText}`);
    }
    
    const meData = await meResponse.json();
    console.log('Connexion /me réussie. Utilisateur:', meData.userPrincipalName || meData.mail || meData.displayName);
  } catch (error) {
    console.error('Erreur lors du test /me:', error);
    throw error;
  }
  
  // Pour les comptes personnels, essayons plusieurs approches
  // Commençons par /me/messages directement (plus simple)
  let graphUrl = `https://graph.microsoft.com/v1.0/me/messages?$top=50&$orderby=receivedDateTime desc&$select=subject,from,receivedDateTime,bodyPreview,body`;
  
  console.log(`Récupération des emails depuis: ${filterDate}`);
  console.log(`Tentative avec URL: ${graphUrl.substring(0, 100)}...`);
  
  try {
    let response = await fetch(graphUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Si cela échoue avec 401, essayons de tester l'accès aux mailFolders d'abord
    if (!response.ok && response.status === 401) {
      console.log('Première tentative échouée, testons l\'accès aux mailFolders...');
      
      // Testons d'abord si on peut accéder aux mailFolders
      const foldersResponse = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (foldersResponse.ok) {
        const foldersData = await foldersResponse.json();
        console.log('Accès aux mailFolders OK. Nombre de dossiers:', foldersData.value?.length || 0);
        
        // Essayons maintenant avec mailFolders/inbox/messages
        console.log('Tentative avec /me/mailFolders/inbox/messages...');
        graphUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime desc&$select=subject,from,receivedDateTime,bodyPreview,body`;
        
        response = await fetch(graphUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
      } else {
        const foldersError = await foldersResponse.text();
        console.error('Impossible d\'accéder aux mailFolders:', foldersResponse.status, foldersError);
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch (e) {
        // Si le body est vide, essayons de lire les headers
        errorDetails = { 
          error: { 
            message: errorText || 'Réponse vide (401 Unauthorized)', 
            code: 'parse_error' 
          } 
        };
      }
      
      // Log des headers de réponse pour debug
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      
      // Vérifier s'il y a un header WWW-Authenticate qui pourrait donner plus d'infos
      const wwwAuthenticate = response.headers.get('www-authenticate');
      if (wwwAuthenticate) {
        console.log('Header WWW-Authenticate:', wwwAuthenticate);
      }
      
      console.error('Erreur Graph API détaillée:', {
        status: response.status,
        statusText: response.statusText,
        wwwAuthenticate: wwwAuthenticate,
        headers: responseHeaders,
        error: errorDetails,
        url: graphUrl
      });
      
      // Si c'est une erreur 401, vérifier les scopes
      if (response.status === 401) {
        throw new Error(`Erreur d'authentification Graph API (401) pour l'accès aux messages. ` +
          `L'authentification de base fonctionne (/me), mais l'accès aux messages est refusé. ` +
          `Cela peut indiquer que les permissions Mail.Read ne sont pas complètement accordées pour ce compte. ` +
          `Vérifiez dans Azure AD que les permissions déléguées sont bien accordées. ` +
          `URL testée: ${graphUrl} ` +
          `Détails: ${JSON.stringify(errorDetails)}`);
      }
      
      throw new Error(`Erreur Graph API: ${response.status} - ${errorDetails.error?.message || errorText}`);
    }

    const data = await response.json();
    const messages = data.value || [];

    console.log(`${messages.length} mail(s) récupéré(s) au total`);

    // Filtrer les emails des dernières 24 heures
    const yesterday = subDays(new Date(), 1);
    const recentMessages = messages.filter(msg => {
      const msgDate = new Date(msg.receivedDateTime);
      return msgDate >= yesterday;
    });

    console.log(`${recentMessages.length} mail(s) trouvé(s) dans les dernières 24 heures`);

    // Formater les emails dans un format similaire à IMAP
    const emails = recentMessages.map(msg => {
      // Extraire le texte du body (HTML ou texte)
      let textContent = '';
      if (msg.body) {
        if (msg.body.contentType === 'html') {
          // Simple extraction de texte depuis HTML (basique)
          textContent = msg.body.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
        } else {
          textContent = msg.body.content;
        }
      } else if (msg.bodyPreview) {
        textContent = msg.bodyPreview;
      }

      return {
        subject: msg.subject || '',
        from: msg.from?.emailAddress?.address || msg.from?.emailAddress?.name || 'Inconnu',
        date: new Date(msg.receivedDateTime),
        text: textContent
      };
    });

    return emails;
  } catch (error) {
    console.error('Erreur fetchRecentEmails:', error);
    throw error;
  }
}

/**
 * Génère le rapport HTML des candidatures analysées
 */
function generateReport(acceptedCandidatures, rejectedCandidatures) {
  let html = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
          h2 { color: #2c3e50; }
          .section { margin: 20px 0; }
          .candidature { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .accepted { background-color: #d4edda; border-color: #c3e6cb; }
          .rejected { background-color: #f8d7da; border-color: #f5c6cb; }
          .header { font-weight: bold; color: #34495e; margin-bottom: 10px; }
          .content { margin-top: 10px; color: #555; }
          .company { color: #2980b9; font-weight: bold; }
          .reason { color: #e74c3c; font-style: italic; }
          .next-step { color: #27ae60; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>Rapport d'analyse des candidatures - 24 dernières heures</h2>
  `;

  // Section candidatures retenues
  if (acceptedCandidatures.length > 0) {
    html += `
      <div class="section">
        <h3 style="color: #27ae60;">✅ ${acceptedCandidatures.length} candidature(s) retenue(s)</h3>
    `;

    acceptedCandidatures.forEach((email, index) => {
      const emailDate = email.date instanceof Date ? email.date : new Date(email.date);
      const dateStr = format(emailDate, 'dd/MM/yyyy à HH:mm');
      const excerpt = email.text.substring(0, 200).replace(/\n/g, '<br>');
      
      html += `
        <div class="candidature accepted">
          <div class="header">Candidature #${index + 1}</div>
          ${email.analysis?.companyName ? `<div class="company">🏢 Entreprise: ${email.analysis.companyName}</div>` : ''}
          <div><strong>De:</strong> ${email.from}</div>
          <div><strong>Date:</strong> ${dateStr}</div>
          <div><strong>Sujet:</strong> ${email.subject}</div>
          ${email.analysis?.nextStep ? `<div class="next-step">📅 Prochaine étape: ${email.analysis.nextStep}</div>` : ''}
          <div class="content">
            <strong>Extrait:</strong><br>
            ${excerpt}${email.text.length > 200 ? '...' : ''}
          </div>
        </div>
      `;
    });

    html += `</div>`;
  } else {
    html += `<p>Aucune candidature retenue trouvée.</p>`;
  }

  // Section candidatures refusées
  if (rejectedCandidatures.length > 0) {
    html += `
      <div class="section">
        <h3 style="color: #e74c3c;">❌ ${rejectedCandidatures.length} candidature(s) refusée(s)</h3>
    `;

    rejectedCandidatures.forEach((email, index) => {
      const emailDate = email.date instanceof Date ? email.date : new Date(email.date);
      const dateStr = format(emailDate, 'dd/MM/yyyy à HH:mm');
      
      html += `
        <div class="candidature rejected">
          <div class="header">Refus #${index + 1}</div>
          ${email.analysis?.companyName ? `<div class="company">🏢 Entreprise: ${email.analysis.companyName}</div>` : ''}
          <div><strong>De:</strong> ${email.from}</div>
          <div><strong>Date:</strong> ${dateStr}</div>
          <div><strong>Sujet:</strong> ${email.subject}</div>
          ${email.analysis?.reason ? `<div class="reason">📝 Motif: ${email.analysis.reason}</div>` : ''}
        </div>
      `;
    });

    html += `</div>`;
  }

  html += `
      </body>
    </html>
  `;

  return html;
}

/**
 * Envoie le rapport par email via Microsoft Graph API (OAuth2)
 */
async function sendReport(htmlReport, accessToken) {
  const email = process.env.EMAIL || 'monmail@hotmail.com';
  const recipient = process.env.RECIPIENT_EMAIL || email;

  // Utiliser Microsoft Graph API pour envoyer l'email au lieu de SMTP
  // Cela évite le problème d'authentification de base désactivée
  const graphUrl = 'https://graph.microsoft.com/v1.0/me/sendMail';

  // Créer le message au format Microsoft Graph API
  const message = {
    message: {
      subject: 'Rapport d\'analyse des candidatures - 24 dernières heures',
      body: {
        contentType: 'HTML',
        content: htmlReport
      },
      toRecipients: [
        {
          emailAddress: {
            address: recipient
          }
        }
      ]
    }
  };

  try {
    console.log(`Envoi du rapport par email à ${recipient} via Graph API...`);
    
    const response = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch (e) {
        errorDetails = { error: { message: errorText } };
      }
      
      console.error('Erreur envoi email Graph API:', {
        status: response.status,
        statusText: response.statusText,
        error: errorDetails
      });
      
      throw new Error(`Erreur lors de l'envoi de l'email via Graph API: ${response.status} - ${JSON.stringify(errorDetails)}`);
    }

    // Graph API renvoie 202 Accepted si l'email est accepté pour envoi
    if (response.status === 202 || response.status === 200) {
      console.log('✅ Rapport envoyé avec succès via Graph API');
      return { messageId: 'graph-api-sent', accepted: true };
    }

    // Si on arrive ici, c'est un statut inattendu
    const responseText = await response.text();
    console.log('Réponse Graph API:', response.status, responseText);
    return { messageId: 'graph-api-sent', accepted: true };
    
  } catch (error) {
    console.error('Erreur envoi email:', error);
    throw error;
  }
}

/**
 * Handler Lambda principal
 */
exports.handler = async (event) => {
  console.log('Démarrage de l\'analyse des mails...');
  
  const email = process.env.EMAIL || 'monmail@hotmail.com';
  
  try {
    // Obtenir un access token OAuth2
    console.log('Obtention du token d\'accès OAuth2...');
    const accessToken = await getAccessTokenFromRefreshToken();
    console.log('Token d\'accès obtenu avec succès');
    
    // Récupération des mails récents via Graph API
    const emails = await fetchRecentEmails(accessToken, email);
    console.log(`${emails.length} mail(s) récupéré(s)`);
    
    // Filtrage préalable avec mots-clés pour économiser les appels API Perplexity
    const candidatureEmails = emails.filter(email => 
      isCandidatureResponse(email.subject, email.text)
    );
    console.log(`${candidatureEmails.length} réponse(s) de candidature trouvée(s) (filtrage préalable)`);
    
    // Analyser chaque email avec Perplexity (une requête par email)
    console.log('Analyse des emails avec Perplexity...');
    const analyzedEmails = [];
    
    for (let i = 0; i < candidatureEmails.length; i++) {
      const email = candidatureEmails[i];
      console.log(`Analyse ${i + 1}/${candidatureEmails.length}: ${email.subject.substring(0, 50)}...`);
      
      const analysis = await analyzeEmailWithPerplexity(email.subject, email.text, email.from);
      email.analysis = analysis;
      analyzedEmails.push(email);
      
      // Petit délai pour éviter de surcharger l'API
      if (i < candidatureEmails.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Séparer les candidatures acceptées et refusées
    const acceptedCandidatures = analyzedEmails.filter(email => 
      email.analysis?.status === 'accepted'
    );
    const rejectedCandidatures = analyzedEmails.filter(email => 
      email.analysis?.status === 'rejected'
    );
    
    console.log(`${acceptedCandidatures.length} candidature(s) retenue(s)`);
    console.log(`${rejectedCandidatures.length} candidature(s) refusée(s)`);
    
    // Génération du rapport avec les deux listes
    const report = generateReport(acceptedCandidatures, rejectedCandidatures);
    
    // Envoi du rapport par email via Graph API (utilise le même access token)
    await sendReport(report, accessToken);
    
    // Réponse Lambda
    const response = {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Analyse terminée avec succès',
        totalEmails: emails.length,
        candidatureEmails: candidatureEmails.length,
        acceptedCandidatures: acceptedCandidatures.length,
        rejectedCandidatures: rejectedCandidatures.length,
        reportSent: true
      }),
    };
    
    return response;
    
  } catch (error) {
    console.error('Erreur lors de l\'analyse:', error);
    
    const response = {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Erreur lors de l\'analyse des mails',
        error: error.message
      }),
    };
    
    return response;
  }
};
