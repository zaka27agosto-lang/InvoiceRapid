import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useTheme } from "../../contexts/ThemeContext";
import SwipeNavigation from "../../components/SwipeNavigation";
import { convertirDeEurosParaMostrar } from "../../utils/currency";
import { FormatoFecha, getFormatoFecha, getMoneda } from "../../utils/settings";
import { checkInvoiceLimitAsync, getRemainingRewardedAds } from "../../utils/subscription";
import { getFacturas } from "../db/facturas";
import { getAlbaranes } from "../db/albaranes";
import { useSync } from "../../hooks/useSync";

export default function Inicio() {
  const { lastSync } = useSync();
  const [modo, setModo] = useState<'facturas' | 'albaranes'>('facturas');
  const [facturas, setFacturas] = useState<any[]>([]);
  const [facturasConvertidas, setFacturasConvertidas] = useState<any[]>([]);
  const [albaranes, setAlbaranes] = useState<any[]>([]);
  const [albaranesConvertidos, setAlbaranesConvertidos] = useState<any[]>([]);
  const [limiteInfo, setLimiteInfo] = useState<{ canCreate: boolean; currentCount: number; limit: number }>({ canCreate: true, currentCount: 0, limit: 5 });
  const [remainingRewardedAds, setRemainingRewardedAds] = useState(0);
  const [esPrimeraVez, setEsPrimeraVez] = useState(false);
  const [formatoFecha, setFormatoFecha] = useState<FormatoFecha>('DD/MM/YYYY');
  const [simboloMoneda, setSimboloMoneda] = useState('€');
  const [, setCodigoMoneda] = useState('EUR');
  const [statsConvertidos, setStatsConvertidos] = useState({ porCobrar: 0, impagadas: 0, noEnviadas: 0, pagadas: 0 });
  const [albaranesStatsConvertidos, setAlbaranesStatsConvertidos] = useState({ pendiente: 0, entregado: 0 });
  const router = useRouter();
  const { t } = useTranslation();
  const { isPremium } = useSubscription();
  const { currentTheme } = useTheme();
  // Definir el orden de las tabs para navegación
  const tabOrder = ['/(tabs)/index', '/(tabs)/documentos', '/(tabs)/clientes', '/(tabs)/productos', '/(tabs)/informes', '/(tabs)/ajustes'];

  const navigateToNextTab = () => {
    const currentIndex = tabOrder.indexOf('/(tabs)/index');
    if (currentIndex < tabOrder.length - 1) {
      const nextTab = tabOrder[currentIndex + 1];
      router.push(nextTab as any);
    }
  };

  const navigateToPreviousTab = () => {
    const currentIndex = tabOrder.indexOf('/(tabs)/index');
    if (currentIndex > 0) {
      const prevTab = tabOrder[currentIndex - 1];
      router.push(prevTab as any);
    }
  };

  const formatearFechaSync = (fecha: string | Date) => {
    let date: Date;
    if (typeof fecha === 'string') {
      const parts = fecha.split('/');
      if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
        date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      } else {
        date = new Date(fecha);
      }
    } else {
      date = fecha;
    }
    if (isNaN(date.getTime())) return String(fecha);
    if (formatoFecha === 'DD/MM/YYYY') {
      const dia = String(date.getDate()).padStart(2, '0');
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const año = date.getFullYear();
      return `${dia}/${mes}/${año}`;
    } else {
      const año = date.getFullYear();
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const dia = String(date.getDate()).padStart(2, '0');
      return `${año}-${mes}-${dia}`;
    }
  };

  function getDiasRestantesMes(): number {
    const hoy = new Date();
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    return Math.ceil((ultimoDia.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  }

  function cargarDatos() {
    const facturasData = getFacturas();
    const albaranesData = getAlbaranes();
    setFacturas(facturasData);
    setAlbaranes(albaranesData);
    checkInvoiceLimitAsync(isPremium).then(setLimiteInfo);
    getFormatoFecha().then(setFormatoFecha);
    // Cargar estado de primera vez
    AsyncStorage.getItem('ha_creado_primera_factura').then((value: string | null) => {
      setEsPrimeraVez(value !== 'true');
    });

    // Cargar rewarded ads restantes hoy
    getRemainingRewardedAds().then(setRemainingRewardedAds);

    // Obtener moneda UNA SOLA VEZ y hacer todas las conversiones con ella
    getMoneda().then(m => {
      setSimboloMoneda(m.simbolo);
      setCodigoMoneda(m.codigo);
      
      // Convertir facturas
      const facturasConTotalesConvertidos = Promise.all(
        facturasData.map(async factura => ({
          ...factura,
          totalConvertido: await convertirDeEurosParaMostrar(factura.total || 0, m.codigo),
        }))
      );
      facturasConTotalesConvertidos.then(setFacturasConvertidas);

      // Convertir albaranes
      const albaranesConTotalesConvertidos = Promise.all(
        albaranesData.map(async albaran => ({
          ...albaran,
          totalConvertido: await convertirDeEurosParaMostrar(albaran.total || 0, m.codigo),
        }))
      );
      albaranesConTotalesConvertidos.then(setAlbaranesConvertidos);

      // Calcular stats directamente de los datos frescos (no del state antiguo)
      const freshStats = {
        porCobrar: facturasData.filter((f: any) => f.estado === 'pendiente').reduce((acc: number, f: any) => acc + (f.total || 0), 0),
        impagadas: facturasData.filter((f: any) => f.estado === 'impagada').reduce((acc: number, f: any) => acc + (f.total || 0), 0),
        noEnviadas: facturasData.filter((f: any) => f.estado === 'no_enviada').reduce((acc: number, f: any) => acc + (f.total || 0), 0),
        pagadas: facturasData.filter((f: any) => f.estado === 'pagada').reduce((acc: number, f: any) => acc + (f.total || 0), 0),
      };
      const freshAlbaranesStats = {
        pendiente: albaranesData.filter((a: any) => a.estado === 'pendiente').reduce((acc: number, a: any) => acc + (a.total || 0), 0),
        entregado: albaranesData.filter((a: any) => a.estado === 'entregado').reduce((acc: number, a: any) => acc + (a.total || 0), 0),
      };

      // Convertir cada estadística de facturas
      Promise.all([
        convertirDeEurosParaMostrar(freshStats.porCobrar, m.codigo),
        convertirDeEurosParaMostrar(freshStats.impagadas, m.codigo),
        convertirDeEurosParaMostrar(freshStats.noEnviadas, m.codigo),
        convertirDeEurosParaMostrar(freshStats.pagadas, m.codigo),
      ]).then(([porCobrar, impagadas, noEnviadas, pagadas]) => {
        setStatsConvertidos({ porCobrar, impagadas, noEnviadas, pagadas });
      });

      // Convertir cada estadística de albaranes
      Promise.all([
        convertirDeEurosParaMostrar(freshAlbaranesStats.pendiente, m.codigo),
        convertirDeEurosParaMostrar(freshAlbaranesStats.entregado, m.codigo),
      ]).then(([pendiente, entregado]) => {
        setAlbaranesStatsConvertidos({ pendiente, entregado });
      });
    });
  }

  useFocusEffect(useCallback(() => {
    cargarDatos();
  }, [isPremium]));

  // Re-cargar datos cuando la sincronización completa (lastSync cambia)
  const lastSyncRef = useRef(lastSync);
  useEffect(() => {
    if (lastSync && lastSync !== lastSyncRef.current) {
      lastSyncRef.current = lastSync;
      cargarDatos();
    } else {
      lastSyncRef.current = lastSync;
    }
  }, [lastSync]);

  const restantes = Math.max(0, limiteInfo.limit - limiteInfo.currentCount);
  const porcentajeUsado = Math.min(limiteInfo.currentCount / limiteInfo.limit, 1);

  const esFacturas = modo === 'facturas';

  const tarjetasFacturas = [
    { label: t('por_cobrar'), valor: statsConvertidos.porCobrar.toFixed(2) + " " + simboloMoneda, count: facturas.filter(f => f.estado === 'pendiente').length, icono: "time-outline", color: currentTheme.colors.primary, filtro: "pendiente" },
    { label: t('impagadas'), valor: statsConvertidos.impagadas.toFixed(2) + " " + simboloMoneda, count: facturas.filter(f => f.estado === 'impagada').length, icono: "alert-circle-outline", color: "#FF4757", filtro: "impagada" },
    { label: t('no_enviada'), valor: statsConvertidos.noEnviadas.toFixed(2) + " " + simboloMoneda, count: facturas.filter(f => f.estado === 'no_enviada').length, icono: "paper-plane-outline", color: "#FF9F43", filtro: "no_enviada" },
    { label: t('pagadas'), valor: statsConvertidos.pagadas.toFixed(2) + " " + simboloMoneda, count: facturas.filter(f => f.estado === 'pagada').length, icono: "checkmark-circle-outline", color: "#26de81", filtro: "pagada" },
  ];

  const tarjetasAlbaranes = [
    { label: t('pendiente'), valor: albaranesStatsConvertidos.pendiente.toFixed(2) + " " + simboloMoneda, count: albaranes.filter(a => a.estado === 'pendiente').length, icono: "time-outline", color: currentTheme.colors.primary, filtro: "pendiente" },
    { label: t('entregado'), valor: albaranesStatsConvertidos.entregado.toFixed(2) + " " + simboloMoneda, count: albaranes.filter(a => a.estado === 'entregado').length, icono: "checkmark-circle-outline", color: "#26de81", filtro: "entregado" },
  ];

  const tarjetas = esFacturas ? tarjetasFacturas : tarjetasAlbaranes;
  const datosConvertidos = esFacturas ? facturasConvertidas : albaranesConvertidos;
  const datosRaw = esFacturas ? facturas : albaranes;
  const tituloActividad = esFacturas ? t('facturas_recientes') : t('albaranes_recientes');
  const emptyIcono = esFacturas ? 'document-outline' : 'clipboard-outline';
  const emptyTexto = esFacturas ? t('sin_facturas') : t('sin_albaranes');
  const emptySub = esFacturas ? t('facturas_apareceran') : t('albaranes_apareceran');
  const btnCrearTexto = esFacturas ? t('nueva_factura') : t('nuevo_albaran');
  const btnCrearRuta = esFacturas ? '/(tabs)/nueva-factura' : ('/(tabs)/nuevo-albaran' as any);
  const btnToggleTexto = esFacturas ? t('albaranes') : t('facturas');

  const datosRecientes = datosConvertidos
    .sort((a: any, b: any) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime())
    .slice(0, 8);

  const hayDatos = datosRaw.length > 0;

  return (
    <SwipeNavigation onSwipeLeft={navigateToNextTab} onSwipeRight={navigateToPreviousTab}>
      <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: currentTheme.colors.primaryLight }]} onPress={() => router.push("/(tabs)/ajustes")}>
            <Ionicons name="settings-outline" size={22} color={currentTheme.colors.primary} />
          </TouchableOpacity>
          <View style={styles.logoWrap}>
            <Text style={[styles.logoZKR, { color: currentTheme.colors.primary }]}>InvoiceRapid</Text>
            {isPremium && <Text style={styles.logoPro}> Pro</Text>}
          </View>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: currentTheme.colors.primaryLight }]} onPress={() => router.push('/legal')}>
            <Ionicons name="help-circle-outline" size={22} color={currentTheme.colors.primary} />
          </TouchableOpacity>
        </View>

        {esPrimeraVez && facturas.length === 0 && albaranes.length === 0 ? (
          <View style={[styles.banner, { backgroundColor: currentTheme.colors.primary }]}>
            <View style={styles.bannerTexto}>
              <Text style={styles.bannerTitulo}>{esFacturas ? t('crea_primera_factura') : t('crea_primer_albaran')}</Text>
              <Text style={styles.bannerSub}>{t('rapido_profesional')}</Text>
              <TouchableOpacity style={styles.bannerBoton} onPress={() => router.push(btnCrearRuta as any)}>
                <Text style={[styles.bannerBotonTexto, { color: currentTheme.colors.primary }]}>{t('empezar')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.bannerDeco}>
              <Ionicons name={esFacturas ? 'document-text-outline' : 'clipboard-outline'} size={80} color="rgba(255,255,255,0.15)" />
            </View>
          </View>
        ) : null}

        {!isPremium && (
          <View style={styles.contadorWrapper}>
            {restantes === 0 ? (
              <View style={[styles.contadorCard, { backgroundColor: currentTheme.colors.card }]}>
                <View style={styles.contadorTop}>
                  <Text style={[styles.contadorTexto, { color: currentTheme.colors.textSecondary }]}>
                    <Text style={[styles.contadorNum, { color: '#FF4757' }]}>{limiteInfo.currentCount}</Text> {t('de')} <Text style={[styles.contadorNum, { color: '#FF4757' }]}>{limiteInfo.limit}</Text> {t('usadas_este_mes')}
                  </Text>                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#FF4757' }}>{t('completo')}</Text>
                        <Text style={{ fontSize: 11, color: '#FF4757', marginTop: 2 }}>{t('se_renueva_en', { dias: getDiasRestantesMes() })}</Text>
                      </View>
                </View>
                <View style={styles.contadorBarra}>
                  <View style={[styles.contadorBarraRelleno, { width: '100%', backgroundColor: '#FF4757' }]} />
                </View>
                <TouchableOpacity style={styles.contadorLimiteBtn} onPress={() => router.push("/(tabs)/ajustes")}>
                  <Ionicons name="lock-closed" size={16} color="#FF4757" />
                  <Text style={styles.contadorLimiteBtnTexto}>{t('limite_alcanzado')}</Text>
                </TouchableOpacity>
                {remainingRewardedAds > 0 && (
                  <TouchableOpacity 
                    style={[styles.rewardedRow, { backgroundColor: currentTheme.colors.primary + '12', borderColor: currentTheme.colors.primary + '30' }]} 
                    onPress={() => router.push('/(tabs)/nueva-factura')}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.rewardedRowIcon, { backgroundColor: currentTheme.colors.primary + '22' }]}>
                      <Ionicons name="play-circle" size={26} color={currentTheme.colors.primary} />
                    </View>
                    <View style={styles.rewardedRowTextContainer}>
                      <Text style={[styles.rewardedRowTitle, { color: currentTheme.colors.primary }]}>
                        {t('ver_anuncio')}
                      </Text>
                      <Text style={[styles.rewardedRowSub, { color: currentTheme.colors.primary + '99' }]}>
                        {remainingRewardedAds} {t('hoy')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={currentTheme.colors.primary + '80'} />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={[styles.contadorCard, { backgroundColor: currentTheme.colors.card }]}>
                <View style={styles.contadorTop}>
                  <Text style={[styles.contadorTexto, { color: currentTheme.colors.textSecondary }]}>
                    <Text style={[styles.contadorNum, { color: currentTheme.colors.primary }]}>{limiteInfo.currentCount}</Text> {t('de')} <Text style={[styles.contadorNum, { color: currentTheme.colors.primary }]}>{limiteInfo.limit}</Text> {t('usadas_este_mes')}
                  </Text>
                  <Text style={[styles.contadorRestantes, { color: restantes <= 3 ? '#FF4757' : '#888' }]}>{restantes} {t('restantes')}</Text>
                </View>
                <View style={styles.contadorBarra}>
                  <View style={[styles.contadorBarraRelleno, {
                    width: `${porcentajeUsado * 100}%` as any,
                    backgroundColor: restantes <= 3 ? '#FF4757' : restantes <= 7 ? '#FF9F43' : currentTheme.colors.primary
                  }]} />
                </View>
              </View>
            )}
          </View>
        )}

        {!isPremium && (
          <TouchableOpacity style={[styles.premiumBanner, { backgroundColor: currentTheme.colors.primary, marginHorizontal: 16 }]} onPress={() => router.push("/(tabs)/ajustes")}>
            <View style={styles.premiumBannerLeft}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="diamond-outline" size={20} color="#fff" />
                <Text style={styles.premiumBannerTitulo}>{t('unlock_premium')}</Text>
              </View>
              <Text style={styles.premiumBannerSub}>{t('facturas_ilimitadas')} · {t('pdf_sin_marca')} · {t('sin_anuncios')}</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.seccionHeader}>
          <Text style={[styles.seccionTitulo, { color: currentTheme.colors.text }]}>{t('resumen')}</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/informes")}>
            <Text style={[styles.verTodo, { color: currentTheme.colors.primary }]}>{t('ver_informes')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          {tarjetas.map((tarjeta, i) => (
            <TouchableOpacity key={i} style={[styles.tarjeta, { backgroundColor: currentTheme.colors.card }]} onPress={() => router.push(`/(tabs)/documentos?filtro=${tarjeta.filtro}` as any)}>
              <View style={[styles.tarjetaIcono, { backgroundColor: tarjeta.color + "18" }]}>
                <Ionicons name={tarjeta.icono as any} size={20} color={tarjeta.color} />
              </View>
              <Text style={[styles.tarjetaValor, { color: currentTheme.colors.text }]}>{tarjeta.valor}</Text>
              <Text style={[styles.tarjetaLabel, { color: currentTheme.colors.textSecondary }]}>{tarjeta.label}</Text>
              {tarjeta.count > 0 && (
                <View style={[styles.badge, { backgroundColor: tarjeta.color }]}>
                  <Text style={styles.badgeTexto}>{tarjeta.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.seccionHeader}>
          <Text style={[styles.seccionTitulo, { color: currentTheme.colors.text }]}>{tituloActividad}</Text>
          {hayDatos && (
            <TouchableOpacity onPress={() => router.push("/(tabs)/documentos")}>
              <Text style={[styles.verTodo, { color: currentTheme.colors.primary }]}>{t('ver_todas')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {datosRaw.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name={emptyIcono as any} size={60} color={currentTheme.colors.textSecondary} />
            <Text style={[styles.emptyTexto, { color: currentTheme.colors.textSecondary }]}>{emptyTexto}</Text>
            <Text style={[styles.emptySub, { color: currentTheme.colors.textSecondary }]}>{emptySub}</Text>
          </View>
        ) : (
          <View style={styles.listaFacturas}>
            <FlatList
              data={datosRecientes}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const estado = item.estado || (esFacturas ? 'pendiente' : 'pendiente');
                const estadoColor = esFacturas
                  ? (estado === 'pagada' ? '#26de81' : estado === 'impagada' ? '#FF4757' : '#FF9F43')
                  : (estado === 'entregado' ? '#26de81' : currentTheme.colors.primary);
                const estadoLabel = esFacturas
                  ? (estado === 'pagada' ? t('pagada') : estado === 'impagada' ? t('impagada') : t('no_enviada'))
                  : (estado === 'entregado' ? t('entregado') : t('pendiente'));
                return (
                <TouchableOpacity style={[styles.facturaMiniCard, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.border }]} 
                  onPress={() => router.push(`/(tabs)/documentos?facturaId=${item.id}&tipo=${esFacturas ? 'facturas' : 'albaranes'}` as any)}>
                  <View style={[styles.estadoBarra, { backgroundColor: estadoColor }]} />
                  <View style={styles.facturaMiniInfo}>
                    <Text style={[styles.facturaMiniNumero, { color: currentTheme.colors.text }]}>{item.numero}</Text>
                    <Text style={[styles.facturaMiniCliente, { color: currentTheme.colors.textSecondary }]}>{item.cliente_nombre}</Text>
                    <Text style={[styles.facturaMiniFecha, { color: currentTheme.colors.textSecondary }]}>{item.fecha ? formatearFechaSync(item.fecha) : ''}</Text>
                  </View>
                  <View style={styles.facturaMiniRight}>
                    <Text style={[styles.facturaMiniTotal, { color: currentTheme.colors.text }]}>{Number(item.totalConvertido || item.total).toFixed(2)}{simboloMoneda}</Text>
                    <View style={styles.estadoMiniRow}>
                      <View style={[styles.estadoMiniPill, { backgroundColor: estadoColor + '20' }]}>
                        <Text style={[styles.estadoMiniTexto, { color: estadoColor }]}>{estadoLabel}</Text>
                      </View>
                      {item.sync_status === 'synced' ? (
                        <Ionicons name="cloud-done-outline" size={12} color="#26de81" />
                      ) : (
                        <Ionicons name="cloud-upload-outline" size={12} color="#FF9F43" />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              )}}
            />
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.fabContainer}>
        <TouchableOpacity style={[styles.fab, { backgroundColor: currentTheme.colors.primary, shadowColor: currentTheme.colors.primary }]} onPress={() => router.push(btnCrearRuta as any)}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.fabTexto}>{btnCrearTexto}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fabToggle, { backgroundColor: '#FF9F43', shadowColor: '#FF9F43' }]} onPress={() => setModo(esFacturas ? 'albaranes' : 'facturas')}>
          <Ionicons name={esFacturas ? 'clipboard-outline' : 'document-text-outline'} size={18} color="#fff" />
          <Text style={styles.fabToggleTexto}>{btnToggleTexto}</Text>
        </TouchableOpacity>
      </View>
      </View>
    </SwipeNavigation>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F8F7FF" },
  container: { flex: 1, paddingTop: 55 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 20 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#EEE9FF", justifyContent: "center", alignItems: "center" },
  logoWrap: { flexDirection: "row", alignItems: "baseline" },
  logoZKR: { fontSize: 20, fontWeight: "800" },
  logoPro: { fontSize: 20, fontWeight: "800", color: "#D4AF37" },
  banner: { marginHorizontal: 20, marginBottom: 20, borderRadius: 20, padding: 24, flexDirection: "row", overflow: "hidden" },
  bannerTexto: { flex: 1 },
  bannerTitulo: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 6, lineHeight: 30 },
  bannerSub: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginBottom: 18 },
  bannerBoton: { backgroundColor: "#fff", alignSelf: "flex-start", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  bannerBotonTexto: { fontWeight: "700", fontSize: 14 },
  bannerDeco: { justifyContent: "center", alignItems: "center", opacity: 0.5 },
  contadorWrapper: { marginHorizontal: 20, marginBottom: 20 },
  contadorCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16 },
  contadorTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  contadorTexto: { fontSize: 14, color: "#555", fontWeight: "500" },
  contadorNum: { fontSize: 22, fontWeight: "900" },
  contadorBarra: { height: 6, backgroundColor: "#f0f0f0", borderRadius: 3, overflow: "hidden" },
  contadorBarraRelleno: { height: "100%" as any, borderRadius: 3 },
  contadorLimiteBtn: { backgroundColor: "#FFF0F0", borderRadius: 10, padding: 12, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 12 },
  contadorLimiteBtnTexto: { color: "#FF4757", fontSize: 13, fontWeight: "700" },
  contadorRestantes: { fontSize: 13, fontWeight: "600" },
  rewardedRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  rewardedRowIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  rewardedRowTextContainer: { flex: 1 },
  rewardedRowTitle: { fontSize: 14, fontWeight: "700" },
  rewardedRowSub: { fontSize: 12, fontWeight: "500", marginTop: 1 },
  premiumBanner: { borderRadius: 16, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  premiumBannerLeft: { flex: 1 },
  premiumBannerTitulo: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 4 },
  premiumBannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  seccionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 14 },
  seccionTitulo: { fontSize: 17, fontWeight: "700", color: "#1a1a1a" },
  verTodo: { fontSize: 14, fontWeight: "500" },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 12, marginBottom: 28 },
  tarjeta: { backgroundColor: "#fff", borderRadius: 16, padding: 16, width: "46%", marginHorizontal: "1%" },
  tarjetaIcono: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  tarjetaValor: { fontSize: 20, fontWeight: "800", color: "#1a1a1a", marginBottom: 4 },
  tarjetaLabel: { fontSize: 12, color: "#888", fontWeight: "500" },
  badge: { position: "absolute", top: 12, right: 12, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTexto: { fontSize: 11, color: "#fff", fontWeight: "700" },
  emptyState: { alignItems: "center", paddingVertical: 30, marginHorizontal: 20 },
  emptyTexto: { fontSize: 16, fontWeight: "600", color: "#aaa", marginTop: 12 },
  emptySub: { fontSize: 13, color: "#ccc", marginTop: 4 },
  fab: { borderRadius: 30, paddingHorizontal: 22, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  fabContainer: { position: "absolute", bottom: 24, left: 20, right: 20, flexDirection: "column", gap: 10 },
  fabToggle: { borderRadius: 30, paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  fabToggleTexto: { color: "#fff", fontWeight: "700", fontSize: 14 },
  fabTexto: { color: "#fff", fontWeight: "700", fontSize: 15 },
  listaFacturas: { marginHorizontal: 20 },
  facturaMiniCard: { backgroundColor: "#fff", borderRadius: 14, marginBottom: 10, flexDirection: "row", overflow: "hidden", borderWidth: 1, borderColor: "#f0f0f0", minHeight: 80 },
  estadoBarra: { width: 5 },
  facturaMiniInfo: { flex: 1, padding: 16 },
  facturaMiniNumero: { fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
  facturaMiniCliente: { fontSize: 15, color: "#888", marginTop: 4 },
  facturaMiniFecha: { fontSize: 13, color: "#bbb", marginTop: 8 },
  facturaMiniRight: { padding: 16, alignItems: "flex-end", justifyContent: "space-between" },
  facturaMiniTotal: { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },
  estadoMiniPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, marginTop: 8 },
  estadoMiniTexto: { fontSize: 12, fontWeight: "600" },
  estadoMiniRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
});