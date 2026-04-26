const fs = require('fs');
const path = require('path');

// Dossiers
const srcDir = path.join(__dirname, '../vtc-project/public');
const buildDir = path.join(__dirname, '../build-static');

console.log('🏗️ Génération version statique pour Hostinger...');

// Nettoyer et créer le dossier build
if (fs.existsSync(buildDir)) fs.rmSync(buildDir, { recursive: true });
fs.mkdirSync(buildDir, { recursive: true });

// Copier tous les fichiers
const copyRecursive = (src, dest) => {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};

copyRecursive(srcDir, buildDir);

// Modifier index.html pour supprimer les APIs
const indexPath = path.join(buildDir, 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');

// Remplacer les appels fetch par des alertes
indexContent = indexContent.replace(
  /fetch\s*\(['"`]\/api\/[^'"`]+['"`][^)]*\)/g, 
  "Promise.reject(new Error('Réservation disponible par téléphone : +33 6 XX XX XX XX'))"
);

// Modifier le script de soumission pour afficher un message
const staticScript = `
<script>
// Version statique - pas de réservation en ligne
function showContactInfo() {
  alert('Pour réserver, contactez-nous :\\n\\n📞 +33 6 XX XX XX XX\\n📧 contact@ismadrive.fr\\n\\nOu utilisez le formulaire de contact ci-dessous.');
}

// Remplacer tous les boutons de réservation
document.addEventListener('DOMContentLoaded', function() {
  // Boutons "Réserver"
  const bookButtons = document.querySelectorAll('button[onclick*="openModal"], .btn-book, .book-btn');
  bookButtons.forEach(btn => {
    btn.onclick = showContactInfo;
  });
  
  // Formulaire de contact simple
  const form = document.getElementById('modal-form');
  if (form) {
    form.innerHTML = \`
      <h3>Demande de Réservation</h3>
      <p>Envoyez-nous votre demande par email ou téléphone :</p>
      <div style="text-align: center; padding: 20px;">
        <p><strong>📞 +33 6 XX XX XX XX</strong></p>
        <p><strong>📧 contact@ismadrive.fr</strong></p>
        <p>WhatsApp disponible 24h/24</p>
        <button onclick="this.closest('.modal').style.display='none'">Fermer</button>
      </div>
    \`;
  }
});
</script>`;

// Ajouter le script avant la fermeture du body
indexContent = indexContent.replace('</body>', staticScript + '</body>');

fs.writeFileSync(indexPath, indexContent);

// Supprimer admin.html (pas utile en statique)
const adminPath = path.join(buildDir, 'admin.html');
if (fs.existsSync(adminPath)) fs.unlinkSync(adminPath);

console.log('✅ Version statique créée dans /build-static/');
console.log('🚀 Upload ce dossier sur Hostinger (public_html/)');
console.log('⚠️  N\'oublie pas de configurer les infos de contact !');