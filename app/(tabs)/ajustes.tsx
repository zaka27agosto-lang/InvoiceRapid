import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert, Modal, ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View
} from "react-native";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { cambiarIdioma } from "../../utils/i18n";
import {
    DatosEmpresa,
    FormatoFecha,
    getDatosEmpresa, getFormatoFecha, getMoneda, getPlantillaPDF,
    Moneda, MONEDAS,
    PlantillaPDF,
    PLANTILLAS_PDF,
    setDatosEmpresa, setFormatoFecha, setMoneda, setPlantillaPDF
} from "../../utils/settings";

export default function Ajustes() {
  const { t, i18n } = useTranslation();
  const { isPremium, offerings, comprar, restaurar, activarPremiumTest, desactivarPremiumTest, aumentarLimiteFacturas } = useSubscription();
  const params = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);
  const [mostrarPaywall, setMostrarPaywall] = useState(false);
  const [mostrarDatos, setMostrarDatos] = useState(false);
  const [mostrarMoneda, setMostrarMoneda] = useState(false);
  const [mostrarPlantilla, setMostrarPlantilla] = useState(false);
  const [comprando, setComprando] = useState(false);
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

  const idiomaActual = i18n.language;

  return (
    <View style={styles.wrapper}>
      <ScrollView ref={scrollViewRef} style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.titulo}>{t('ajustes_titulo')}</Text>

        {/* Banner premium */}
        {!isPremium ? (
          <TouchableOpacity style={styles.premiumBanner} onPress={() => setMostrarPaywall(true)}>
            <View style={styles.premiumBannerLeft}>
              <Text style={styles.premiumBannerTitulo}>✨ {t('unlock_premium')}</Text>
              <Text style={styles.premiumBannerSub}>{t('pdf_sin_marca')} · {t('logo_personalizado')} · {t('sin_anuncios')}</Text>
            </View>
            <View style={styles.premiumBannerBtn}>
              <Ionicons name="chevron-forward" size={18} color="#6C47FF" />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[styles.premiumBanner, { backgroundColor: '#1a1a2e' }]}>
            <View style={styles.premiumBannerLeft}>
              <Text style={styles.premiumBannerTitulo}>✨ {t('plan_premium')}</Text>
              <Text style={styles.premiumBannerSub}>Todas las funciones desbloqueadas</Text>
            </View>
            <Ionicons name="checkmark-circle" size={28} color="#26de81" />
          </View>
        )}

        {/* Idioma */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>{t('idioma')}</Text>
          <View style={styles.idiomaOpciones}>
            {(['es', 'en'] as const).map(lang => (
              <TouchableOpacity
                key={lang}
                style={[styles.idiomaBtn, idiomaActual === lang && styles.idiomaBtnActivo]}
                onPress={() => cambiarIdioma(lang)}
              >
                <Text style={styles.idiomaFlag}>{lang === 'es' ? '🇪🇸' : '🇬🇧'}</Text>
                <Text style={[styles.idiomaBtnTexto, idiomaActual === lang && styles.idiomaBtnTextoActivo]}>
                  {lang === 'es' ? t('espanol') : t('ingles')}
                </Text>
                {idiomaActual === lang && <Ionicons name="checkmark" size={16} color="#6C47FF" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Configuración */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>{t('configuracion')}</Text>

          {/* Moneda */}
          <TouchableOpacity style={styles.opcionBoton} onPress={() => setMostrarMoneda(true)}>
            <Ionicons name="cash-outline" size={20} color="#6C47FF" />
            <Text style={styles.opcionTexto}>{t('moneda')}</Text>
            <Text style={styles.opcionValor}>{monedaActual.simbolo} {monedaActual.codigo}</Text>
            <Ionicons name="chevron-forward" size={16} color="#ccc" />
          </TouchableOpacity>

          {/* Mis datos */}
          <TouchableOpacity style={styles.opcionBoton} onPress={() => setMostrarDatos(true)}>
            <Ionicons name="business-outline" size={20} color="#6C47FF" />
            <View style={{ flexDirection: 'row', flex: 1 }}>
              <Text style={styles.opcionTexto}>{t('mis_datos')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#ccc" />
          </TouchableOpacity>

          {/* Formato de fecha */}
          <TouchableOpacity style={styles.opcionBoton} onPress={() => {
            const nuevoFormato = formatoFechaActual === 'DD/MM/YYYY' ? 'YYYY-MM-DD' : 'DD/MM/YYYY';
            setFormatoFecha(nuevoFormato);
            setFormatoFechaActual(nuevoFormato);
            Alert.alert('✅', t('formato_fecha_actualizado'));
          }}>
            <Ionicons name="calendar-outline" size={20} color="#6C47FF" />
            <View style={{ flexDirection: 'row', flex: 1 }}>
              <Text style={styles.opcionTexto}>{t('formato_fecha')}</Text>
              <Text style={styles.opcionValor}>{formatoFechaActual}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#ccc" />
          </TouchableOpacity>

          {/* Plantilla PDF (solo premium) */}
          {isPremium && (
            <TouchableOpacity style={styles.opcionBoton} onPress={() => setMostrarPlantilla(true)}>
              <Ionicons name="document-text-outline" size={20} color="#6C47FF" />
              <Text style={styles.opcionTexto}>Plantilla PDF</Text>
              <Text style={styles.opcionValor}>{PLANTILLAS_PDF.find(p => p.id === plantillaActual)?.nombre || 'Estándar'}</Text>
              <Ionicons name="chevron-forward" size={16} color="#ccc" />
            </TouchableOpacity>
          )}

          <View style={styles.opcion}>
            <Ionicons name="notifications-outline" size={20} color="#6C47FF" />
            <Text style={styles.opcionTexto}>{t('notificaciones')}</Text>
          </View>
        </View>

        {/* Suscripción */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>{t('suscripcion')}</Text>
          <View style={styles.opcion}>
            <Ionicons name="star-outline" size={20} color="#6C47FF" />
            <Text style={styles.opcionTexto}>{t('plan_actual')}</Text>
            <Text style={[styles.opcionValor, isPremium && { color: '#6C47FF' }]}>
              {isPremium ? t('plan_premium') : t('plan_gratis')}
            </Text>
          </View>
          {!isPremium && (
            <TouchableOpacity style={styles.opcionBoton} onPress={() => setMostrarPaywall(true)}>
              <Ionicons name="rocket-outline" size={20} color="#6C47FF" />
              <Text style={styles.opcionTexto}>{t('unlock_premium')}</Text>
              <Ionicons name="chevron-forward" size={16} color="#ccc" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.opcionBoton} onPress={handleRestaurar}>
            <Ionicons name="refresh-outline" size={20} color="#6C47FF" />
            <Text style={styles.opcionTexto}>{t('restaurar_compra')}</Text>
            <Ionicons name="chevron-forward" size={16} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Cuenta */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>{t('cuenta')}</Text>
          <View style={styles.opcion}>
            <Ionicons name="person-outline" size={20} color="#6C47FF" />
            <Text style={styles.opcionTexto}>{t('mi_perfil')}</Text>
          </View>
          <View style={styles.opcion}>
            <Ionicons name="information-circle-outline" size={20} color="#6C47FF" />
            <Text style={styles.opcionTexto}>{t('version')}</Text>
            <Text style={styles.opcionValor}>1.0.0</Text>
          </View>
        </View>

        {/* Modo desarrollo */}
        <View style={[styles.seccion, { borderWidth: 1.5, borderColor: '#FF9F43', borderStyle: 'dashed' }]}>
          <Text style={[styles.seccionTitulo, { color: '#FF9F43' }]}>🛠 Modo desarrollo</Text>
          <TouchableOpacity style={styles.opcionBoton} onPress={activarPremiumTest}>
            <Ionicons name="flash-outline" size={20} color="#FF9F43" />
            <Text style={[styles.opcionTexto, { color: '#FF9F43' }]}>Activar Premium (test)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.opcionBoton} onPress={desactivarPremiumTest}>
            <Ionicons name="flash-off-outline" size={20} color="#FF4757" />
            <Text style={[styles.opcionTexto, { color: '#FF4757' }]}>Desactivar Premium (test)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.opcionBoton} onPress={() => {
            aumentarLimiteFacturas();
            Alert.alert('✅', t('limite_aumentado'));
          }}>
            <Ionicons name="add-circle-outline" size={20} color="#FF9F43" />
            <Text style={[styles.opcionTexto, { color: '#FF9F43' }]}>Aumentar 1 factura (test)</Text>
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
              style={[styles.switchBtn, datos.incluirEnFactura && styles.switchBtnActivo]}
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

      {/* Paywall Modal */}
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
  monedaSimbolo: { fontSize: 20, fontWeight: '700', color: '#6C47FF', width: 40 },
  monedaNombre: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  monedaCodigo: { fontSize: 12, color: '#888' },
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