const fs = require('fs');
let content = fs.readFileSync('utils/i18n.ts', 'utf8');

const oldBlock = [
  "    consentimiento_anuncios: 'Consenso pubblicità',",
  "    consentimiento_actualizado: 'Preferenze pubblicitarie aggiornate',",
  "    error_consentimiento: 'Errore nell\\'apertura delle opzioni sulla privacy',",
  "    consentimiento_no_disponible: 'Il modulo di consenso non è disponibile nella tua regione.',",
  "    resetear_contador: 'Azzera contatore mensile',",
].join('\n');

const newBlock = [
  "    consentimiento_anuncios: 'Consenso pubblicità',",
  "    consentimiento_actualizado: 'Preferenze pubblicitarie aggiornate',",
  "    error_consentimiento: 'Errore nell\\'apertura delle opzioni sulla privacy',",
  "    consentimiento_no_disponible: 'Il modulo di consenso non è disponibile nella tua regione.',",
  "    consent_dialog_titulo: 'Privacy pubblicitaria',",
  "    consent_dialog_desc: 'Questa app usa annunci per rimanere gratuita. Scegli come visualizzare gli annunci:',",
  "    consent_dialog_personalizados: 'Annunci personalizzati',",
  "    consent_dialog_personalizados_desc: 'Più pertinenti. Google usa la tua attività per mostrarti annunci su misura.',",
  "    consent_dialog_no_personalizados: 'Solo annunci non personalizzati',",
  "    consent_dialog_no_personalizados_desc: 'Annunci generici basati sul contenuto dell\\'app. Nessuna cronologia raccolta.',",
  "    consent_dialog_recordatorio: 'Puoi modificare questa scelta in Impostazioni > Privacy in qualsiasi momento.',",
  "    resetear_contador: 'Azzera contatore mensile',",
].join('\n');

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync('utils/i18n.ts', content, 'utf8');
  console.log('SUCCESS: Italian keys added');
} else {
  console.log('FAILED: exact block not found');
  // Find the lines around "Consenso pubblicità"
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Consenso pubblicità')) {
      for (let j = 0; j < 6; j++) {
        if (i + j < lines.length) {
          console.log(`Line ${i+j}: ${JSON.stringify(lines[i+j])}`);
        }
      }
      break;
    }
  }
}
