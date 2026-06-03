const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const isFactura = fileName.includes('nueva-factura');
  const guardarName = isFactura ? 'guardarFactura' : 'guardarAlbaran';

  // 1. Add getDiasRestantesMes helper before the guardar function
  // Find the exact text that precedes guardarFactura/guardarAlbaran
  const helperCode = `
  function getDiasRestantesMes(): number {
    const hoy = new Date();
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    return Math.ceil((ultimoDia.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  }

  async function ${guardarName}() {`;

  // Match the existing guardar function declaration
  const guardarRegex = new RegExp(`async function ${guardarName}\\(\\) {`);
  content = content.replace(guardarRegex, (match) => {
    return helperCode;
  });

  console.log('  - Added getDiasRestantesMes helper');

  // 2. Replace limit_desc Alert calls to include days remaining
  // Pattern: Alert.alert(t('limite_alcanzado'), t('limite_desc'), buttons);
  content = content.replace(
    "Alert.alert(t('limite_alcanzado'), t('limite_desc'), buttons);",
    "const diasRest = getDiasRestantesMes();\n      const mensajeLimite = t('limite_desc') + '\\n\\n' + t('se_renueva_en', { dias: diasRest });\n      Alert.alert(t('limite_alcanzado'), mensajeLimite, buttons);"
  );
  console.log('  - Updated main limit alert');

  // 3. Replace other Alert.alert(t('limite_alcanzado'), t('limite_desc'), [ pattern - for non-buttons ones
  // This handles the export PDF and edit mode checks
  // But only replace the FIRST occurrence (the one inside handleExportarPDF or edit mode check)
  // The buttons one was already replaced above
  content = content.replace(
    "const diasRest = getDiasRestantesMes();\n      const mensajeLimite = t('limite_desc') + '\\n\\n' + t('se_renueva_en', { dias: diasRest });\n      Alert.alert(t('limite_alcanzado'), mensajeLimite, [",
    "const diasRest2 = getDiasRestantesMes();\n      const mensajeLimite2 = t('limite_desc') + '\\n\\n' + t('se_renueva_en', { dias: diasRest2 });\n      Alert.alert(t('limite_alcanzado'), mensajeLimite2, ["
  );

  // Replace remaining t('limite_desc') with array that weren't caught
  // Use a different approach - replace every remaining Alert.alert(t('limite_alcanzado'), t('limite_desc'), [
  // But exclude the ones already fixed by checking if they have mensajeLimite or mensajeLimite2
  // Actually let me just use a different pattern
  const remainingPattern = "Alert.alert(t('limite_alcanzado'), t('limite_desc'), [";
  content = content.replace(
    remainingPattern,
    "const diasRest3 = getDiasRestantesMes();\n      const mensajeLimite3 = t('limite_desc') + '\\n\\n' + t('se_renueva_en', { dias: diasRest3 });\n      Alert.alert(t('limite_alcanzado'), mensajeLimite3, ["
  );

  // 4. Add limit indicator UI - after the header row closing View, before the ScrollView opening
  // Pattern: find the scrollView opening after the header
  const limitUI = `          </View>

          {!isPremium && (
            <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
              {limiteInfo.canCreate ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: currentTheme.colors.card, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: currentTheme.colors.border || '#f0f0f0' }}>
                  <Ionicons name="document-text-outline" size={14} color={currentTheme.colors.textSecondary} />
                  <Text style={{ fontSize: 12, color: currentTheme.colors.textSecondary, fontWeight: '500' }}>
                    {limiteInfo.currentCount} {t('de')} {limiteInfo.limit} {t('facturas_restantes')}
                  </Text>
                  <View style={{ flex: 1, height: 4, backgroundColor: (currentTheme.colors.border || '#e8e8e8'), borderRadius: 2, marginHorizontal: 4, maxWidth: 60 }}>
                    <View style={{ width: (limiteInfo.currentCount / limiteInfo.limit) * 100 + '%', height: 4, backgroundColor: '#FF9F43', borderRadius: 2 }} />
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF3E0', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#FFB74D' }}>
                  <Ionicons name="alert-circle-outline" size={14} color="#FF4757" />
                  <Text style={{ fontSize: 12, color: '#FF4757', fontWeight: '600' }}>
                    {t('limite_alcanzado')} {'\\u00b7'} {t('se_renueva_en', { dias: getDiasRestantesMes() })}
                  </Text>
                </View>
              )}
            </View>
          )}

          <ScrollView`;

  // Replace the ScrollView opening with our limit indicator + ScrollView
  // But we need to be careful - the ScrollView might be written differently in each file
  // Find: from header closing to scrollview
  // In both files, the pattern is: after </View> that closes the header, then <ScrollView
  // But we need to find the right </View> - the one that closes screenHeaderRow
  
  content = content.replace(
    limitUI.trim(), // Check if already applied
    limitUI.trim()
  );

  // If not applied (the replace above didn't change anything), find the insertion point
  // The pattern is the header row's closing </View> followed by the ScrollView
  // In both files this looks like:
  //           </View>
  //
  //           <ScrollView
  
  // Wait, I set the replacement to itself which does nothing. Let me use a different approach.
  // Let me find the actual pattern.

  console.log('  - Limit indicator: checking for insertion point...');
  
  // Check if the limit indicator was already inserted by looking for the specific text
  if (!content.includes("// L\\u00edmite mensual")) {
    // Find the first occurrence of the ScrollView opening after the header
    // The header ends with the screenHeaderRow View closing
    
    // Now let me find the exact sequence around the scrollview
    // The files have: header row, then scrollview with ref and style
    // We want to insert after the header row </View> and before <ScrollView
    
    // Looking at both files, the pattern varies slightly. Let me look for what comes right before <ScrollView
    // After screenHeaderRow, in nueva-factura it's: blank line then <ScrollView
    // In nuevo-albaran it's the same pattern

    // Let me just find the first <ScrollView and insert before it
    // Actually, we need to insert AFTER the header row </View> and BEFORE the first child of the ScrollView
    
    // Simpler approach: insert right after the screenHeaderRow's closing View
    // The pattern is: the header row has `</View>` then some blank lines then the ScrollView
    
    // Let me try a more direct pattern
    content = content.replace(
      `          </View>\n\n          <ScrollView`,
      `          </View>\n\n          {/* L\\u00edmite mensual */}\n          {!isPremium && (\n            <View style={{ marginHorizontal: 16, marginBottom: 8 }}>\n              {limiteInfo.canCreate ? (\n                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: currentTheme.colors.card, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: currentTheme.colors.border || '#f0f0f0' }}>\n                  <Ionicons name="document-text-outline" size={14} color={currentTheme.colors.textSecondary} />\n                  <Text style={{ fontSize: 12, color: currentTheme.colors.textSecondary, fontWeight: '500' }}>\n                    {limiteInfo.currentCount} {t('de')} {limiteInfo.limit} {t('facturas_restantes')}\n                  </Text>\n                  <View style={{ flex: 1, height: 4, backgroundColor: (currentTheme.colors.border || '#e8e8e8'), borderRadius: 2, marginHorizontal: 4, maxWidth: 60 }}>\n                    <View style={{ width: (limiteInfo.currentCount / limiteInfo.limit) * 100 + '%', height: 4, backgroundColor: '#FF9F43', borderRadius: 2 }} />\n                  </View>\n                </View>\n              ) : (\n                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF3E0', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#FFB74D' }}>\n                  <Ionicons name="alert-circle-outline" size={14} color="#FF4757" />\n                  <Text style={{ fontSize: 12, color: '#FF4757', fontWeight: '600' }}>\n                    {t('limite_alcanzado')} {'\\u00b7'} {t('se_renueva_en', { dias: getDiasRestantesMes() })}\n                  </Text>\n                </View>\n              )}\n            </View>\n          )}\n\n          <ScrollView`
    );
    console.log('  - Added limit indicator UI');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ ${fileName} - saved`);
}

console.log('=== Fixing nueva-factura.tsx ===');
fixFile(path.join(__dirname, 'app', '(tabs)', 'nueva-factura.tsx'));

console.log('\n=== Fixing nuevo-albaran.tsx ===');
fixFile(path.join(__dirname, 'app', '(tabs)', 'nuevo-albaran.tsx'));

console.log('\n🎉 Done!');
