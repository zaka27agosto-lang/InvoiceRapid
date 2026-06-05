const fs = require('fs');
let content = fs.readFileSync('utils/i18n.ts', 'utf8');
// Fix line 2301: change double-single-quote to backslash escape
content = content.replace(
  "per l''eliminazione. Se cambi idea, accedi entro 30 giorni per ripristinarlo.",
  "per l'\\'eliminazione. Se cambi idea, accedi entro 30 giorni per ripristinarlo."
);
fs.writeFileSync('utils/i18n.ts', content, 'utf8');
console.log('Fixed');
