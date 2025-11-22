// Script de test local pour tester la fonction Lambda sans déployer
// Charge les variables d'environnement depuis .env si disponible
try {
  require('dotenv').config();
} catch (e) {
  // dotenv n'est pas installé, on utilisera les variables d'environnement du système
  console.log('⚠️  dotenv non trouvé, utilisation des variables d\'environnement système\n');
}

// Import du handler depuis index.js
// Dans index.js, on utilise exports.handler, donc il sera disponible directement
const { handler } = require('./index');

if (!handler) {
  console.error('❌ Handler non trouvé dans index.js');
  console.error('Assurez-vous que index.js exporte bien exports.handler');
  process.exit(1);
}

// Simuler un événement Lambda (vide dans notre cas)
const event = {};

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  Test local de la fonction Lambda Mail Analyzer         ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Vérifier les variables d'environnement requises
const requiredVars = [
  'EMAIL',
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
  'MICROSOFT_TENANT_ID',
  'MICROSOFT_REFRESH_TOKEN'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Variables d\'environnement manquantes:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n💡 Créez un fichier .env avec ces variables ou exportez-les dans votre shell.\n');
  process.exit(1);
}

console.log('✅ Variables d\'environnement configurées\n');
console.log('📧 Email:', process.env.EMAIL);
console.log('🔑 Client ID:', process.env.MICROSOFT_CLIENT_ID?.substring(0, 8) + '...');
console.log('🌍 Tenant ID:', process.env.MICROSOFT_TENANT_ID);
console.log('🔐 Refresh Token:', process.env.MICROSOFT_REFRESH_TOKEN?.substring(0, 20) + '...\n');

// Exécuter la fonction handler
handler(event)
  .then((response) => {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║  ✅ Résultat de l\'exécution                              ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log('Status Code:', response.statusCode);
    
    try {
      const body = JSON.parse(response.body);
      console.log('\n📊 Résultats:');
      console.log(JSON.stringify(body, null, 2));
    } catch (e) {
      console.log('Body:', response.body);
    }
    
    if (response.statusCode === 200) {
      console.log('\n✅ Succès !');
      process.exit(0);
    } else {
      console.log('\n❌ Erreur détectée');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n╔═══════════════════════════════════════════════════════════╗');
    console.error('║  ❌ Erreur lors de l\'exécution                          ║');
    console.error('╚═══════════════════════════════════════════════════════════╝\n');
    console.error('Erreur:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  });
