import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert, Modal, ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View
} from "react-native";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
    DatosEmpresa,
    FormatoFecha,
    getDatosEmpresa, getFormatoFecha, getMoneda, getPlantillaPDF,
    Moneda, MONEDAS,
    PlantillaPDF,
    PLANTILLAS_PDF,
    setDatosEmpresa, setFormatoFecha, setMoneda, setPlantillaPDF
} from "../../utils/settings";
import { PrimaryColor, primaryColors } from "../../utils/themes";

export default function Ajustes() {
  const { t, i18n } = useTranslation();
  const { isPremium, offerings, comprar, restaurar, activarPremiumTest, desactivarPremiumTest, aumentarLimiteFacturas } = useSubscription();
  const { currentTheme, primaryColor, mode, setPrimaryColor, setMode } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);
  const [mostrarPaywall, setMostrarPaywall] = useState(false);
  const [mostrarDatos, setMostrarDatos] = useState(false);
  const [mostrarMoneda, setMostrarMoneda] = useState(false);
  const [mostrarPlantilla, setMostrarPlantilla] = useState(false);
  const [mostrarTemas, setMostrarTemas] = useState(false);
  const [mostrarIdiomas, setMostrarIdiomas] = useState(false);
  const [comprando, setComprando] = useState(false);
  const [notificacionesSuscripcion, setNotificacionesSuscripcion] = useState(true);
  const [monedaActual, setMonedaActual] = useState<Moneda>(MONEDAS[0]);
  const [plantillaActual, setPlantillaActual] = useState<PlantillaPDF>('default');
  const [formatoFechaActual, setFormatoFechaActual] = useState<FormatoFecha>('DD/MM/YYYY');
  const [datos, setDatos] = useState<DatosEmpresa>({
    nombre: '', nif: '', direccion: '', telefono: '', email: '', incluirEnFactura: true
  });

  useFocusEffect(() => {
    scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  });

  useEffect(() => {
    getMoneda().then(setMonedaActual);
    getDatosEmpresa().then(setDatos);
    getPlantillaPDF().then(setPlantillaActual);
    getFormatoFecha().then(setFormatoFechaActual);
    AsyncStorage.getItem('notificaciones_suscripcion').then(value => {
      setNotificacionesSuscripcion(value !== 'false');
    });
    if (params.paywall === 'true') {
      setMostrarPaywall(true);
    }
  }, [params.paywall]); 

  async function handleComprar(pkg: any) {
    console.log('🎯 handleComprar llamado con paquete:', pkg);
    setComprando(true);
    const result = await comprar(pkg);
    console.log('📊 Resultado de comprar:', result);
    setComprando(false);
    if (result.success) {
      setMostrarPaywall(false);
      Alert.alert('✨ ' + t('bienvenida_premium'), t('acceso_premium'));
    } else if (!result.cancelled) {
      Alert.alert(t('error'), result.error || 'Error al procesar la compra');
    }
  }

  async function handleRestaurar() {
    const result = await restaurar();
    if (result.isPremium) {
      Alert.alert('✅', t('compra_restaurada'));
    } else {
      Alert.alert('Info', t('no_compras_previas'));
    }
  }

  async function handleGuardarDatos() {
    await setDatosEmpresa(datos);
    Alert.alert('✅', t('datos_guardados'));
    setMostrarDatos(false);
  }

  async function handleSeleccionarMoneda(moneda: Moneda) {
    await setMoneda(moneda);
    setMonedaActual(moneda);
    setMostrarMoneda(false);
  }

  async function handleSeleccionarPlantilla(plantilla: PlantillaPDF) {
    await setPlantillaPDF(plantilla);
    setPlantillaActual(plantilla);
    setMostrarPlantilla(false);
  }

  async function toggleNotificacionesSuscripcion() {
    const nuevoValor = !notificacionesSuscripcion;
    setNotificacionesSuscripcion(nuevoValor);
    await AsyncStorage.setItem('notificaciones_suscripcion', nuevoValor ? 'true' : 'false');
    Alert.alert('✅', nuevoValor ? t('notificaciones_activadas') : t('notificaciones_desactivadas'));
  }

  async function handleExportData() {
    try {
      const exportData = {
        datosEmpresa: datos,
        moneda: monedaActual,
        plantilla: plantillaActual,
        formatoFecha: formatoFechaActual,
        exportDate: new Date().toISOString(),
      };
      // TODO: Implementar la exportación de datos
      Alert.alert('✅', t('datos_exportados'));
    } catch (error) {
      Alert.alert(t('error'), t('error_exportar_datos'));
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      t('borrar_cuenta'),
      t('confirmar_borrar_cuenta'),
      [
        { text: t('cancelar'), style: 'cancel' },
        { 
          text: t('borrar'), 
          style: 'destructive',
          onPress: async () => {
            Alert.alert('⚠️', t('funcionalidad_proximamente'));
          }
        }
      ]
    );
  }

  async function handleChangeConsent() {
    Alert.alert('⚠️', t('funcionalidad_proximamente'));
  }

  const idiomaActual = i18n.language;

  const idiomas = [
    { code: 'es', nombre: 'Español' },
    { code: 'en', nombre: 'English' },
    { code: 'fr', nombre: 'Français' },
    { code: 'de', nombre: 'Deutsch' },
    { code: 'it', nombre: 'Italiano' },
    { code: 'pt', nombre: 'Português' },
    { code: 'ar', nombre: 'العربية' },
  ];

  const idiomaSeleccionado = idiomas.find(i => i.code === idiomaActual)?.nombre || idiomaActual;

  return (
    <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
      <ScrollView ref={scrollViewRef} style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.titulo, { color: currentTheme.colors.text }]}>{t('ajustes_titulo')}</Text>

        {/* Banner premium */}
        {!isPremium ? (
          <TouchableOpacity style={[styles.premiumBanner, { backgroundColor: currentTheme.colors.primary }]} onPress={() => setMostrarPaywall(true)}>
            <View style={styles.premiumBannerLeft}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="diamond-outline" size={20} color="#fff" />
                <Text style={styles.premiumBannerTitulo}>{t('unlock_premium')}</Text>
              </View>
              <Text style={styles.premiumBannerSub}>{t('facturas_ilimitadas')} · {t('pdf_sin_marca')} · {t('sin_anuncios')}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[styles.premiumBanner, { backgroundColor: currentTheme.colors.card }]}>
            <View style={styles.premiumBannerLeft}>
              <Text style={[styles.premiumBannerTitulo, { color: currentTheme.colors.text }]}>{t('plan_premium')}</Text>
              <Text style={[styles.premiumBannerSub, { color: currentTheme.colors.textSecondary }]}>{t('funciones_desbloqueadas')}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={28} color="#26de81" />
          </View>
        )}

        {/* Idioma */}
        <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('idioma')}</Text>
          <TouchableOpacity style={styles.opcionBoton} onPress={() => setMostrarIdiomas(true)}>
            <Ionicons name="language-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('idioma')}</Text>
            <Text style={[styles.opcionValor, { color: currentTheme.colors.textSecondary }]}>{idiomaSeleccionado}</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Configuración */}
        <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('configuracion')}</Text>

          {/* Moneda */}
          <TouchableOpacity style={styles.opcionBoton} onPress={() => setMostrarMoneda(true)}>
            <Ionicons name="cash-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('moneda')}</Text>
            <Text style={[styles.opcionValor, { color: currentTheme.colors.textSecondary }]}>{monedaActual.simbolo} {monedaActual.codigo}</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>

          {/* Mis datos */}
          <TouchableOpacity style={styles.opcionBoton} onPress={() => setMostrarDatos(true)}>
            <Ionicons name="business-outline" size={20} color={currentTheme.colors.primary} />
            <View style={{ flexDirection: 'row', flex: 1 }}>
              <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('mis_datos')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>

          {/* Formato de fecha */}
          <TouchableOpacity style={styles.opcionBoton} onPress={() => {
            const nuevoFormato = formatoFechaActual === 'DD/MM/YYYY' ? 'YYYY-MM-DD' : 'DD/MM/YYYY';
            setFormatoFecha(nuevoFormato);
            setFormatoFechaActual(nuevoFormato);
            Alert.alert('✅', t('formato_fecha_actualizado'));
          }}>
            <Ionicons name="calendar-outline" size={20} color={currentTheme.colors.primary} />
            <View style={{ flexDirection: 'row', flex: 1 }}>
              <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('formato_fecha')}</Text>
              <Text style={[styles.opcionValor, { color: currentTheme.colors.textSecondary }]}>{formatoFechaActual}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>

          {/* Plantilla PDF (solo premium) */}
          {isPremium && (
            <TouchableOpacity style={styles.opcionBoton} onPress={() => setMostrarPlantilla(true)}>
              <Ionicons name="document-text-outline" size={20} color={currentTheme.colors.primary} />
              <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('plantilla_pdf')}</Text>
              <Text style={[styles.opcionValor, { color: currentTheme.colors.textSecondary }]}>{PLANTILLAS_PDF.find(p => p.id === plantillaActual)?.nombre || t('estandar')}</Text>
              <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Tema (solo premium) */}
          {isPremium && (
            <TouchableOpacity style={styles.opcionBoton} onPress={() => setMostrarTemas(true)}>
              <Ionicons name="color-palette-outline" size={20} color={currentTheme.colors.primary} />
              <View style={{ flexDirection: 'row', flex: 1 }}>
                <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('tema')}</Text>
                <Text style={[styles.opcionValor, { color: currentTheme.colors.textSecondary }]}>{t(primaryColor)} - {t(mode)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.opcionBoton, { paddingVertical: 16 }]} onPress={toggleNotificacionesSuscripcion}>
            <Ionicons name="notifications-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text, flex: 1, lineHeight: 20 }]} numberOfLines={2}>{t('notificaciones_suscripcion')}</Text>
            <View style={[styles.switchBtn, notificacionesSuscripcion && { backgroundColor: currentTheme.colors.primary }]}>
              <View style={[styles.switchCircle, notificacionesSuscripcion && styles.switchCircleActivo]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Suscripción */}
        <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>Suscripción</Text>
          <View style={styles.opcion}>
            <Ionicons name="star-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>Plan actual</Text>
            <Text style={[styles.opcionValor, isPremium && { color: currentTheme.colors.primary }, { color: currentTheme.colors.textSecondary }]}>
              {isPremium ? 'Premium' : 'Gratis'}
            </Text>
          </View>
          <TouchableOpacity style={styles.opcionBoton} onPress={() => setMostrarPaywall(true)}>
            <Ionicons name="card-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>Gestionar suscripción</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.opcionBoton} onPress={handleRestaurar}>
            <Ionicons name="refresh-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>Restaurar compras</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Cuenta */}
        <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('cuenta')}</Text>
          <TouchableOpacity style={styles.opcionBoton} onPress={() => router.push('/auth/profile')}>
            <Ionicons name="person-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>Mi perfil</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.opcion}>
            <Ionicons name="information-circle-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>Versión</Text>
            <Text style={[styles.opcionValor, { color: currentTheme.colors.textSecondary }]}>1.0.0</Text>
          </View>
        </View>

        {/* Privacidad y Datos */}
        <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>Privacidad y Datos</Text>
          
          <TouchableOpacity style={styles.opcionBoton} onPress={handleExportData}>
            <Ionicons name="download-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>Exportar datos</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.opcionBoton} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={20} color="#FF4757" />
            <Text style={[styles.opcionTexto, { color: '#FF4757' }]}>Borrar cuenta</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.opcionBoton} onPress={handleChangeConsent}>
            <Ionicons name="shield-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>Consentimiento de anuncios</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Modo desarrollo */}
        <View style={[styles.seccion, { borderWidth: 1.5, borderColor: '#FF9F43', borderStyle: 'dashed', backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.seccionTitulo, { color: '#FF9F43' }]}>🛠 {t('modo_desarrollo')}</Text>
          <TouchableOpacity style={styles.opcionBoton} onPress={activarPremiumTest}>
            <Ionicons name="flash-outline" size={20} color="#FF9F43" />
            <Text style={[styles.opcionTexto, { color: '#FF9F43' }]}>{t('activar_premium_test')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.opcionBoton} onPress={async () => {
            await desactivarPremiumTest();
            await setPrimaryColor('blue');
          }}>
            <Ionicons name="flash-off-outline" size={20} color="#FF4757" />
            <Text style={[styles.opcionTexto, { color: '#FF4757' }]}>{t('desactivar_premium_test')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.opcionBoton} onPress={() => {
            aumentarLimiteFacturas();
            Alert.alert('✅', t('limite_aumentado'));
          }}>
            <Ionicons name="add-circle-outline" size={20} color="#FF9F43" />
            <Text style={[styles.opcionTexto, { color: '#FF9F43' }]}>{t('aumentar_factura_test')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modal Mis Datos */}
      <Modal visible={mostrarDatos} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalWrapper}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMostrarDatos(false)}>
              <Ionicons name="close" size={26} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.modalTitulo}>{t('mis_datos_titulo')}</Text>
            <TouchableOpacity onPress={handleGuardarDatos}>
              <Text style={styles.modalGuardar}>{t('guardar')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            {[
              { key: 'nombre', label: t('nombre_empresa'), placeholder: 'Autónomo / Mi Empresa S.L.' },
              { key: 'nif', label: t('nif'), placeholder: 'B12345678' },
              { key: 'direccion', label: t('dir_fiscal'), placeholder: 'Calle Mayor 1, Madrid' },
              { key: 'telefono', label: t('telefono_empresa'), placeholder: '+34 600 000 000' },
              { key: 'email', label: t('email_empresa'), placeholder: 'contacto@empresa.com' },
            ].map(campo => (
              <View key={campo.key} style={styles.campoWrapper}>
                <Text style={styles.campoLabel}>{campo.label}</Text>
                <TextInput
                  style={styles.campoInput}
                  placeholder={campo.placeholder}
                  placeholderTextColor="#bbb"
                  value={(datos as any)[campo.key]}
                  onChangeText={v => setDatos((prev: DatosEmpresa) => ({ ...prev, [campo.key]: v }))}
                />
              </View>
            ))}
            <View style={styles.switchFila}>
              <Text style={styles.switchLabel}>{t('incluir_en_factura')}</Text>
              <TouchableOpacity
                style={[styles.switchBtn, datos.incluirEnFactura && { backgroundColor: currentTheme.colors.primary }]}
                onPress={() => setDatos((prev: DatosEmpresa) => ({ ...prev, incluirEnFactura: !prev.incluirEnFactura }))}
              >
                <View style={[styles.switchCircle, datos.incluirEnFactura && styles.switchCircleActivo]} />
              </TouchableOpacity>
            </View>
            <View style={{ height: 60 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Moneda */}
      <Modal visible={mostrarMoneda} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalWrapper}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMostrarMoneda(false)}>
              <Ionicons name="close" size={26} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.modalTitulo}>{t('moneda')}</Text>
            <View style={{ width: 40 }} />
          </View>
          {MONEDAS.map((m: Moneda) => (
            <TouchableOpacity
              key={m.codigo}
              style={styles.monedaItem}
              onPress={() => handleSeleccionarMoneda(m)}
            >
              <Text style={styles.monedaSimbolo}>{m.simbolo}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.monedaNombre}>{m.nombre}</Text>
                <Text style={styles.monedaCodigo}>{m.codigo}</Text>
              </View>
              {monedaActual.codigo === m.codigo && (
                <Ionicons name="checkmark-circle" size={22} color="#6C47FF" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* Modal Plantilla PDF */}
      <Modal visible={mostrarPlantilla} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalWrapper}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMostrarPlantilla(false)}>
              <Ionicons name="close" size={26} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.modalTitulo}>Plantilla PDF</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={{ padding: 20 }}>
            {PLANTILLAS_PDF.map((plantilla) => (
              <TouchableOpacity
                key={plantilla.id}
                style={[
                  styles.plantillaItem,
                  plantillaActual === plantilla.id && styles.plantillaItemActivo
                ]}
                onPress={() => handleSeleccionarPlantilla(plantilla.id)}
              >
                <View style={styles.plantillaIcono}>
                  <Ionicons name="document-text-outline" size={24} color={plantillaActual === plantilla.id ? "#6C47FF" : "#999"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.plantillaNombre, plantillaActual === plantilla.id && styles.plantillaNombreActivo]}>
                    {plantilla.nombre}
                  </Text>
                  <Text style={styles.plantillaDescripcion}>{plantilla.descripcion}</Text>
                </View>
                {plantillaActual === plantilla.id && (
                  <Ionicons name="checkmark-circle" size={22} color="#6C47FF" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Temas */}
      <Modal visible={mostrarTemas} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalWrapper}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMostrarTemas(false)}>
              <Ionicons name="close" size={26} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.modalTitulo}>Tema</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={{ padding: 20 }}>
            {/* Toggle Modo Oscuro/Claro */}
            <View style={{ marginBottom: 24, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#888', marginBottom: 12 }}>{t('modo')}</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={[
                    { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#e8e8e8', backgroundColor: '#fafafa', alignItems: 'center' },
                    mode === 'light' && { borderColor: currentTheme.colors.primary, backgroundColor: currentTheme.colors.primaryLight }
                  ]}
                  onPress={async () => {
                    await setMode('light');
                  }}
                >
                  <Ionicons name="sunny-outline" size={20} color={mode === 'light' ? currentTheme.colors.primary : '#999'} />
                  <Text style={[{ fontSize: 15, fontWeight: '600', marginTop: 4 }, mode === 'light' && { color: currentTheme.colors.primary }]}>
                    {t('light')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#e8e8e8', backgroundColor: '#fafafa', alignItems: 'center' },
                    mode === 'dark' && { borderColor: currentTheme.colors.primary, backgroundColor: currentTheme.colors.primaryLight }
                  ]}
                  onPress={async () => {
                    await setMode('dark');
                  }}
                >
                  <Ionicons name="moon-outline" size={20} color={mode === 'dark' ? currentTheme.colors.primary : '#999'} />
                  <Text style={[{ fontSize: 15, fontWeight: '600', marginTop: 4 }, mode === 'dark' && { color: currentTheme.colors.primary }]}>
                    {t('dark')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Selección de Color */}
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#888', marginBottom: 12, paddingHorizontal: 4 }}>{t('color_principal')}</Text>
            {(Object.keys(primaryColors) as PrimaryColor[]).map((colorName) => (
              <TouchableOpacity
                key={colorName}
                style={[
                  styles.plantillaItem,
                  primaryColor === colorName && styles.plantillaItemActivo
                ]}
                onPress={async () => {
                  await setPrimaryColor(colorName);
                }}
              >
                <View style={[styles.plantillaIcono, { backgroundColor: primaryColors[colorName].color + '20' }]}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: primaryColors[colorName].color }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.plantillaNombre, primaryColor === colorName && styles.plantillaNombreActivo]}>
                    {t(colorName)}
                  </Text>
                </View>
                {primaryColor === colorName && (
                  <Ionicons name="checkmark-circle" size={22} color={currentTheme.colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Idiomas */}
      <Modal visible={mostrarIdiomas} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalWrapper}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMostrarIdiomas(false)}>
              <Ionicons name="close" size={26} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.modalTitulo}>{t('idioma')}</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={{ padding: 20 }}>
            {idiomas.map((idioma) => (
              <TouchableOpacity
                key={idioma.code}
                style={[
                  styles.monedaItem,
                  idiomaActual === idioma.code && styles.monedaItemActivo
                ]}
                onPress={async () => {
                  await i18n.changeLanguage(idioma.code as any);
                  await AsyncStorage.setItem('idioma', idioma.code);
                  setMostrarIdiomas(false);
                }}
              >
                <Text style={styles.idiomaNombre}>{idioma.nombre}</Text>
                {idiomaActual === idioma.code && (
                  <Ionicons name="checkmark-circle" size={22} color="#6C47FF" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Paywall */}
      <Modal visible={mostrarPaywall} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.paywallWrapper}>
          <View style={styles.paywallHeader}>
            <TouchableOpacity onPress={() => setMostrarPaywall(false)}>
              <Ionicons name="close" size={26} color="#1a1a1a" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.paywallTop}>
              <View style={styles.paywallIcono}>
                <Ionicons name="rocket" size={36} color="#6C47FF" />
              </View>
              <Text style={styles.paywallTitulo}>{t('premium_titulo')}</Text>
              <Text style={styles.paywallSub}>{t('premium_sub')}</Text>
            </View>

            {[
              { icon: 'infinite-outline', texto: t('facturas_ilimitadas') },
              { icon: 'document-text-outline', texto: t('pdf_sin_marca') },
              { icon: 'image-outline', texto: t('logo_personalizado') },
              { icon: 'color-palette-outline', texto: t('plantillas_premium') },
              { icon: 'ban-outline', texto: t('sin_anuncios') },
            ].map((f, i) => (
              <View key={i} style={styles.feature}>
                <View style={styles.featureIcono}>
                  <Ionicons name={f.icon as any} size={20} color="#6C47FF" />
                </View>
                <Text style={styles.featureTexto}>{f.texto}</Text>
                <Ionicons name="checkmark" size={18} color="#26de81" />
              </View>
            ))}

            <View style={styles.planesContainer}>
              {offerings?.availablePackages?.map((pkg: any, i: number) => {
                const isAnual = pkg.packageType === 'ANNUAL';
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.planCard, isAnual && styles.planCardDestacado]}
                    onPress={() => handleComprar(pkg)}
                    disabled={comprando}
                  >
                    {isAnual && (
                      <View style={styles.planBadge}>
                        <Text style={styles.planBadgeTexto}>{t('recomendado')}</Text>
                      </View>
                    )}
                    <Text style={styles.planNombre}>{pkg.product.title}</Text>
                    <Text style={styles.planPrecio}>{pkg.product.priceString}</Text>
                    <Text style={styles.planDesc}>{pkg.product.description}</Text>
                  </TouchableOpacity>
                );
              })}
              {(!offerings || offerings.availablePackages?.length === 0) && (
                <View style={styles.paywallNoDisponible}>
                  <Ionicons name="construct-outline" size={32} color="#ccc" />
                  <Text style={styles.paywallNoDisponibleTexto}>
                    Compras no disponibles en modo desarrollo.{'\n'}Usa los botones de test en Ajustes.
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.botonDesbloquear} onPress={() => offerings?.availablePackages?.[0] && handleComprar(offerings.availablePackages[0])}>
              <Text style={styles.botonDesbloquearTexto}>{t('desbloquear')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.restaurarBtn} onPress={handleRestaurar}>
              <Text style={styles.restaurarTexto}>{t('restaurar')}</Text>
            </TouchableOpacity>
            <Text style={styles.legalTexto}>{t('cancelar_anytime')}</Text>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F8F7FF' },
  scroll: { flex: 1, paddingTop: 55, paddingHorizontal: 16 },
  titulo: { fontSize: 26, fontWeight: '800', color: '#1a1a1a', marginBottom: 20, paddingHorizontal: 4 },
  premiumBanner: { backgroundColor: '#6C47FF', borderRadius: 16, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  premiumBannerLeft: { flex: 1 },
  premiumBannerTitulo: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 4 },
  premiumBannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  premiumBannerBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  seccion: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16 },
  seccionTitulo: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  opcionBoton: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  opcionTexto: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  opcionValor: { fontSize: 14, color: '#888', fontWeight: '600', marginLeft: 16 },
  idiomaOpciones: { gap: 10 },
  idiomaBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#e8e8e8', backgroundColor: '#fafafa' },
  idiomaBtnActivo: { borderColor: '#6C47FF', backgroundColor: '#EEE9FF' },
  idiomaFlag: { fontSize: 22 },
  idiomaBtnTexto: { flex: 1, fontSize: 15, color: '#888', fontWeight: '600' },
  idiomaBtnTextoActivo: { color: '#6C47FF' },
  modalWrapper: { flex: 1, backgroundColor: '#fff', paddingTop: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitulo: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  modalGuardar: { fontSize: 16, fontWeight: '700', color: '#6C47FF' },
  campoWrapper: { marginBottom: 16 },
  campoLabel: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  campoInput: { borderWidth: 1.5, borderColor: '#e8e8e8', borderRadius: 12, padding: 14, fontSize: 15, color: '#1a1a1a', backgroundColor: '#fafafa' },
  switchFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0', marginTop: 8 },
  switchLabel: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  monedaItem: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  monedaItemActivo: { backgroundColor: '#F8F7FF' },
  monedaSimbolo: { fontSize: 20, fontWeight: '700', color: '#6C47FF', width: 40 },
  monedaNombre: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  monedaCodigo: { fontSize: 12, color: '#888' },
  idiomaNombre: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  paywallWrapper: { flex: 1, backgroundColor: '#fff', paddingTop: 20 },
  paywallHeader: { paddingHorizontal: 20, marginBottom: 10 },
  paywallTop: { alignItems: 'center', paddingHorizontal: 30, paddingVertical: 24 },
  paywallIcono: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#EEE9FF', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  paywallTitulo: { fontSize: 24, fontWeight: '900', color: '#1a1a1a', textAlign: 'center', marginBottom: 8 },
  paywallSub: { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 10 },
  featureIcono: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEE9FF', justifyContent: 'center', alignItems: 'center' },
  featureTexto: { flex: 1, fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  planesContainer: { padding: 16, gap: 12 },
  planCard: { borderWidth: 1.5, borderColor: '#e8e8e8', borderRadius: 16, padding: 18, backgroundColor: '#fafafa' },
  planCardDestacado: { borderColor: '#6C47FF', backgroundColor: '#EEE9FF' },
  planBadge: { backgroundColor: '#6C47FF', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 10 },
  planBadgeTexto: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  planNombre: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  planPrecio: { fontSize: 22, fontWeight: '900', color: '#6C47FF', marginBottom: 4 },
  planDesc: { fontSize: 13, color: '#888' },
  botonDesbloquear: { backgroundColor: '#6C47FF', marginHorizontal: 16, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 8, shadowColor: '#6C47FF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12 },
  botonDesbloquearTexto: { color: '#fff', fontWeight: '800', fontSize: 17 },
  paywallNoDisponible: { alignItems: 'center', padding: 30, gap: 12 },
  paywallNoDisponibleTexto: { fontSize: 14, color: '#aaa', textAlign: 'center', lineHeight: 22 },
  restaurarBtn: { alignItems: 'center', paddingVertical: 16 },
  restaurarTexto: { fontSize: 14, color: '#6C47FF', fontWeight: '600' },
  legalTexto: { textAlign: 'center', fontSize: 12, color: '#ccc', paddingBottom: 10 },
  switchBtn: { width: 50, height: 28, borderRadius: 14, backgroundColor: '#e0e0e0', justifyContent: 'center', padding: 3 },
  switchBtnActivo: { backgroundColor: '#6C47FF' },
  switchCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  switchCircleActivo: { alignSelf: 'flex-end' },
  plantillaItem: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  plantillaItemActivo: { backgroundColor: '#F8F7FF' },
  plantillaIcono: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#fafafa', justifyContent: 'center', alignItems: 'center' },
  plantillaNombre: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  plantillaNombreActivo: { color: '#6C47FF' },
  plantillaDescripcion: { fontSize: 12, color: '#888', marginTop: 2 },
});