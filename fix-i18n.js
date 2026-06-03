const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'utils', 'i18n.ts');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  {
    // Spanish
    from: "    limite_desc: 'Has usado todas tus facturas gratuitas. Hazte Premium para facturas ilimitadas.',",
    to: "    limite_desc: 'Has usado todas tus facturas gratuitas. Hazte Premium para facturas ilimitadas.',\n    se_renueva_en: 'Se renueva en {{dias}} d\\u00eda(s).',"
  },
  {
    // English
    from: "    limite_desc: 'You have used all your free invoices. Go Premium for unlimited invoices.',",
    to: "    limite_desc: 'You have used all your free invoices. Go Premium for unlimited invoices.',\n    se_renueva_en: 'Renews in {{dias}} day(s).',"
  },
  {
    // French
    from: "    limite_desc: 'Vous avez utilis\\u00e9 toutes vos factures gratuites. Passez Premium pour des factures illimit\\u00e9es.',",
    to: "    limite_desc: 'Vous avez utilis\\u00e9 toutes vos factures gratuites. Passez Premium pour des factures illimit\\u00e9es.',\n    se_renueva_en: 'Se renouvelle dans {{dias}} jour(s).',"
  },
  {
    // German
    from: "    limite_desc: 'Sie haben alle kostenlosen Rechnungen genutzt. Werden Sie Premium f\\u00fcr unbegrenzte Rechnungen.',",
    to: "    limite_desc: 'Sie haben alle kostenlosen Rechnungen genutzt. Werden Sie Premium f\\u00fcr unbegrenzte Rechnungen.',\n    se_renueva_en: 'Erneuert sich in {{dias}} Tag(en).',"
  },
  {
    // Italian
    from: "    limite_desc: 'Hai usato tutte le fatture gratuite. Passa a Premium per fatture illimitate.',",
    to: "    limite_desc: 'Hai usato tutte le fatture gratuite. Passa a Premium per fatture illimitate.',\n    se_renueva_en: 'Si rinnova tra {{dias}} giorno(i).',"
  }
];

let replacedCount = 0;
for (const { from, to } of replacements) {
  // Use the actual string from the file, not the escaped version
  const actualFrom = from;
  if (content.includes(actualFrom)) {
    content = content.replace(actualFrom, to);
    replacedCount++;
    console.log('✅ Replaced:', actualFrom.substring(0, 60) + '...');
  } else {
    // Try finding the literal text
    // The file has actual characters, not escaped ones
    console.log('❌ Not found, trying literal match...');
    // French
    if (actualFrom.includes('utilis\\u00e9')) {
      const literalFrom = actualFrom.replace(/\\u00e9/g, '\u00e9');
      if (content.includes(literalFrom)) {
        content = content.replace(literalFrom, to.replace(/\\u00e9/g, '\u00e9'));
        replacedCount++;
        console.log('✅ Replaced with literal:', literalFrom.substring(0, 60) + '...');
      }
    }
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n✅ Done. ${replacedCount}/${replacements.length} replacements made.`);
