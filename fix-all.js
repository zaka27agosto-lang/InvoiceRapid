const fs = require('fs');
const path = require('path');

// ──── Tarea 1: ajustes.tsx ────
let ajustes = fs.readFileSync(path.join(__dirname, 'app', '(tabs)', 'ajustes.tsx'), 'utf8');

// 1. Add Pdf import
ajustes = ajustes.replace(
  "import { generarPDFPreview } from \"../../utils/pdf\";\r\nimport * as Sharing from \"expo-sharing\";\r\nimport * as Print from \"expo-print\";",
  "import { generarPDFPreview } from \"../../utils/pdf\";\r\nimport Pdf from 'react-native-pdf';\r\nimport * as Sharing from \"expo-sharing\";\r\nimport * as Print from \"expo-print\";"
);

// 2. Add previewUri and mostrarPreviewPdf state after existing state declarations
ajustes = ajustes.replace(
  "  const [planSeleccionado, setPlanSeleccionado] = useState<any>(null);",
  "  const [planSeleccionado, setPlanSeleccionado] = useState<any>(null);\r\n  const [previewUri, setPreviewUri] = useState<string | null>(null);\r\n  const [mostrarPreviewPdf, setMostrarPreviewPdf] = useState(false);"
);

// 3. Replace handlePreviewPlantilla function
ajustes = ajustes.replace(
  `  async function handlePreviewPlantilla(plantilla: PlantillaPDF) {
    try {
      const facturaPreview = {
        id: 0,
        numero: 'PREVIEW-001',
        cliente_id: 0,
        cliente_nombre: 'Cliente Ejemplo',
        subtotal: 850,
        descuento: 0,
        iva_porcentaje: 21,
        iva_importe: 178.5,
        irpf_porcentaje: 0,
        irpf_importe: 0,
        total: 1028.5,
        notas: '',
        metodo_pago: 'efectivo',
        fecha_vencimiento: '',
        fecha: new Date().toISOString(),
        estado: 'pendiente',
        cliente_email: 'cliente@email.com',
        cliente_direccion: 'Calle Ejemplo 123',
      };
      const itemsPreview = [
        { descripcion: 'Servicio de consultoría', cantidad: '10', unidad: 'h', precio_unitario: '50', descuento: '0', subtotal: 500 },
        { descripcion: 'Desarrollo web', cantidad: '1', unidad: 'ud', precio_unitario: '350', descuento: '0', subtotal: 350 },
      ];
      const uri = await generarPDFPreview(facturaPreview, itemsPreview, true, plantilla, '\\u20ac', currentTheme.colors.primary);
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: \\`Vista previa - Plantilla \\${plantilla}\\`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch {
      Alert.alert(t('error'), t('no_se_pudo_generar_pdf'));
    }
  }`,
  `  async function handlePreviewPlantilla(plantilla: PlantillaPDF) {
    try {
      const facturaPreview = {
        id: 0,
        numero: 'PREVIEW-001',
        cliente_id: 0,
        cliente_nombre: 'Cliente Ejemplo',
        subtotal: 850,
        descuento: 0,
        iva_porcentaje: 21,
        iva_importe: 178.5,
        irpf_porcentaje: 0,
        irpf_importe: 0,
        total: 1028.5,
        notas: '',
        metodo_pago: 'efectivo',
        fecha_vencimiento: '',
        fecha: new Date().toISOString(),
        estado: 'pendiente',
        cliente_email: 'cliente@email.com',
        cliente_direccion: 'Calle Ejemplo 123',
      };
      const itemsPreview = [
        { descripcion: 'Servicio de consultoría', cantidad: '10', unidad: 'h', precio_unitario: '50', descuento: '0', subtotal: 500 },
        { descripcion: 'Desarrollo web', cantidad: '1', unidad: 'ud', precio_unitario: '350', descuento: '0', subtotal: 350 },
      ];
      const uri = await generarPDFPreview(facturaPreview, itemsPreview, true, plantilla, '\\u20ac', currentTheme.colors.primary);
      if (uri) {
        setPreviewUri(uri);
        setMostrarPreviewPdf(true);
      }
    } catch {
      Alert.alert(t('error'), t('no_se_pudo_generar_pdf'));
    }
  }`
);

// 4. Add Modal for PDF preview before `<AuthModal`
ajustes = ajustes.replace(
  `      <AuthModal`,
  `      {/* Modal Vista previa PDF */}
        <Modal visible={mostrarPreviewPdf} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMostrarPreviewPdf(false)}>
          <View style={[styles.previewWrapper, { backgroundColor: currentTheme.colors.background }]}>
            <View style={[styles.previewHeader, { backgroundColor: currentTheme.colors.card, borderBottomColor: currentTheme.colors.border || '#f0f0f0' }]}>
              <TouchableOpacity style={styles.previewCloseBtn} onPress={() => { setMostrarPreviewPdf(false); setPreviewUri(null); }}>
                <Ionicons name="close" size={22} color={currentTheme.colors.text} />
              </TouchableOpacity>
              <Text style={[styles.previewTitle, { color: currentTheme.colors.text }]}>{t('vista_previa')}</Text>
              <View style={{ width: 36 }} />
            </View>
            {previewUri ? (
              <Pdf source={{ uri: previewUri }} style={{ flex: 1 }} />
            ) : (
              <View style={styles.previewLoading}><Text style={{ color: currentTheme.colors.textSecondary }}>{t('cargando')}...</Text></View>
            )}
          </View>
        </Modal>

      <AuthModal`
);

// 5. Add preview styles to styles
ajustes = ajustes.replace(
  "  plantillaDescripcion: { fontSize: 12, color: '#888', marginTop: 2 },\n});",
  "  plantillaDescripcion: { fontSize: 12, color: '#888', marginTop: 2 },\n  previewWrapper: { flex: 1, paddingTop: 20 },\n  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },\n  previewCloseBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },\n  previewTitle: { fontSize: 18, fontWeight: '800' },\n  previewLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },\n});"
);

console.log('✅ ajustes.tsx - handlePreviewPlantilla fixed with react-native-pdf');

// ──── Helper for Tareas 2 & 3 ────
function fixFacturaAlbaran(content, fileName) {
  // Add helper function before guardarFactura/guardarAlbaran
  const guardarFunc = fileName.includes('nueva-factura') ? 'guardarFactura' : 'guardarAlbaran';
  
  // 1. Add getDiasRestantes helper before the guardar function
  const helperFunc = `
  function getDiasRestantesMes(): number {
    const hoy = new Date();
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    return Math.ceil((ultimoDia.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  }

  async function ${guardarFunc}() {`;
  
  // Find the function declaration
  const funcStart = `async function ${guardarFunc}() {`;
  content = content.replace(funcStart, helperFunc);

  // 2. Replace Alert.alert(t('limite_alcanzado'), t('limite_desc'), buttons) with days remaining
  // Main limit alert with buttons (the one that shows ver_anuncio + unlock_premium)
  content = content.replace(
    `Alert.alert(t('limite_alcanzado'), t('limite_desc'), buttons);`,
    `const diasRest = getDiasRestantesMes();
      const mensajeLimite = t('limite_desc') + '\\n\\n' + t('se_renueva_en', { dias: diasRest });
      Alert.alert(t('limite_alcanzado'), mensajeLimite, buttons);`
  );

  // 3. Replace Alert.alert(t('limite_alcanzado'), t('limite_desc'), [...]) for handleExportarPDF
  // and edit mode check - these don't have the 'buttons' variable
  content = content.replace(
    "Alert.alert(t('limite_alcanzado'), t('limite_desc'), [",
    "const diasRest2 = getDiasRestantesMes();\n      const mensajeLimite2 = t('limite_desc') + '\\n\\n' + t('se_renueva_en', { dias: diasRest2 });\n      Alert.alert(t('limite_alcanzado'), mensajeLimite2, ["
  );

  console.log(`✅ ${fileName} - days remaining added`);

  // 4. Add limit indicator UI - after header row, before ScrollView
  // Find the header row ending and the ScrollView opening
  content = content.replace(
    `          </View>
          {/* Vista previa PDF */}
          <Modal visible={mostrarPreviewPdf}`,
    `          </View>
          {/* Indicador de límite mensual */}
          {!isPremium && limiteInfo && (
            <View style={{ marginHorizontal: 16, marginBottom: 8, marginTop: 2 }}>
              {limiteInfo.canCreate ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: currentTheme.colors.card, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: currentTheme.colors.border || '#f0f0f0' }}>
                  <Ionicons name="document-text-outline" size={14} color={currentTheme.colors.textSecondary} />
                  <Text style={{ fontSize: 12, color: currentTheme.colors.textSecondary, fontWeight: '500' }}>
                    {limiteInfo.currentCount} {t('de')} {limiteInfo.limit} {t('facturas_restantes')}
                  </Text>
                  <View style={{ flex: 1, height: 4, backgroundColor: currentTheme.colors.border || '#e8e8e8', borderRadius: 2, marginHorizontal: 4, maxWidth: 60 }}>
                    <View style={{ width: (limiteInfo.currentCount / limiteInfo.limit) * 100 + '%', height: 4, backgroundColor: '#FF9F43', borderRadius: 2 }} />
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF3E0', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#FFB74D' }}>
                  <Ionicons name="alert-circle-outline" size={14} color="#FF4757" />
                  <Text style={{ fontSize: 12, color: '#FF4757', fontWeight: '600' }}>
                    {t('limite_alcanzado')} · {t('se_renueva_en', { dias: getDiasRestantesMes() })}
                  </Text>
                </View>
              )}
            </View>
          )}
          {/* Vista previa PDF */}
          <Modal visible={mostrarPreviewPdf}`
  );

  console.log(`✅ ${fileName} - limit indicator added`);
  return content;
}

// ──── Tareas 2 & 3: nueva-factura.tsx ────
let nuevaFactura = fs.readFileSync(path.join(__dirname, 'app', '(tabs)', 'nueva-factura.tsx'), 'utf8');
nuevaFactura = fixFacturaAlbaran(nuevaFactura, 'nueva-factura.tsx');
fs.writeFileSync(path.join(__dirname, 'app', '(tabs)', 'nueva-factura.tsx'), nuevaFactura, 'utf8');

// ──── Tareas 2 & 3: nuevo-albaran.tsx ────
let nuevoAlbaran = fs.readFileSync(path.join(__dirname, 'app', '(tabs)', 'nuevo-albaran.tsx'), 'utf8');
nuevoAlbaran = fixFacturaAlbaran(nuevoAlbaran, 'nuevo-albaran.tsx');
fs.writeFileSync(path.join(__dirname, 'app', '(tabs)', 'nuevo-albaran.tsx'), nuevoAlbaran, 'utf8');

// Write ajustes
fs.writeFileSync(path.join(__dirname, 'app', '(tabs)', 'ajustes.tsx'), ajustes, 'utf8');

console.log('\n🎉 All changes applied successfully!');
