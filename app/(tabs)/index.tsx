import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { FormatoFecha, getFormatoFecha } from "../../utils/settings";
import { checkInvoiceLimitAsync } from "../../utils/subscription";
import { getFacturas } from "../db/facturas";

export default function Inicio() {
  const [facturas, setFacturas] = useState<any[]>([]);
  const [limiteInfo, setLimiteInfo] = useState<{ canCreate: boolean; currentCount: number; limit: number }>({ canCreate: true, currentCount: 0, limit: 15 });
  const [esPrimeraVez, setEsPrimeraVez] = useState(true);
  const [formatoFecha, setFormatoFecha] = useState<FormatoFecha>('DD/MM/YYYY');
  const router = useRouter();
  const { t } = useTranslation();
  const { isPremium } = useSubscription();

  const formatearFechaSync = (fecha: string | Date) => {
    const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
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

  useFocusEffect(useCallback(() => {
    setFacturas(getFacturas() as any[]);
    checkInvoiceLimitAsync().then(setLimiteInfo);
    getFormatoFecha().then(setFormatoFecha);
    
    // Cargar estado de primera vez
    AsyncStorage.getItem('ha_creado_primera_factura').then((value: string | null) => {
      setEsPrimeraVez(value !== 'true');
    });
  }, []));

  const restantes = Math.max(0, limiteInfo.limit - limiteInfo.currentCount);
  const porcentajeUsado = Math.min(limiteInfo.currentCount / limiteInfo.limit, 1);

  const stats = {
    porCobrar: facturas.filter(f => f.estado === 'pendiente').reduce((acc, f) => acc + (f.total || 0), 0),
    impagadas: facturas.filter(f => f.estado === 'impagada').reduce((acc, f) => acc + (f.total || 0), 0),
    noEnviadas: facturas.filter(f => f.estado === 'no_enviada').reduce((acc, f) => acc + (f.total || 0), 0),
    pagadas: facturas.filter(f => f.estado === 'pagada').reduce((acc, f) => acc + (f.total || 0), 0),
  };

  const tarjetas = [
    { label: t('por_cobrar'), valor: stats.porCobrar.toFixed(2) + " €", count: facturas.filter(f => f.estado === 'pendiente').length, icono: "time-outline", color: "#6C47FF", filtro: "pendiente" },
    { label: t('impagadas'), valor: stats.impagadas.toFixed(2) + " €", count: facturas.filter(f => f.estado === 'impagada').length, icono: "alert-circle-outline", color: "#FF4757", filtro: "impagada" },
    { label: t('no_enviadas'), valor: stats.noEnviadas.toFixed(2) + " €", count: facturas.filter(f => f.estado === 'no_enviada').length, icono: "paper-plane-outline", color: "#FF9F43", filtro: "no_enviada" },
    { label: t('pagadas'), valor: stats.pagadas.toFixed(2) + " €", count: facturas.filter(f => f.estado === 'pagada').length, icono: "checkmark-circle-outline", color: "#26de81", filtro: "pagada" },
  ];

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/(tabs)/ajustes")}>
            <Ionicons name="settings-outline" size={22} color="#6C47FF" />
          </TouchableOpacity>
          <View style={styles.logoWrap}>
            <Text style={styles.logoZKR}>InvoiceRapid</Text>
            {isPremium && <Text style={styles.logoPro}> Pro</Text>}
          </View>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="help-circle-outline" size={22} color="#6C47FF" />
          </TouchableOpacity>
        </View>

        {esPrimeraVez && facturas.length === 0 ? (
          <View style={styles.banner}>
            <View style={styles.bannerTexto}>
              <Text style={styles.bannerTitulo}>{t('crea_primera_factura')}</Text>
              <Text style={styles.bannerSub}>{t('rapido_profesional')}</Text>
              <TouchableOpacity style={styles.bannerBoton} onPress={() => router.push("/(tabs)/nueva-factura")}>
                <Text style={styles.bannerBotonTexto}>{t('empezar')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.bannerDeco}>
              <Ionicons name="document-text-outline" size={80} color="rgba(255,255,255,0.15)" />
            </View>
          </View>
        ) : null}

        {!isPremium && (
          <View style={styles.contadorWrapper}>
            {restantes === 0 ? (
              <TouchableOpacity style={styles.contadorLimite} onPress={() => router.push("/(tabs)/ajustes")}>
                <Ionicons name="lock-closed" size={18} color="#fff" />
                <Text style={styles.contadorLimiteTexto}>{t('limite_alcanzado')} {t('limite_desc')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.contadorCard}>
                <View style={styles.contadorTop}>
                  <Text style={styles.contadorTexto}>
                    <Text style={styles.contadorNum}>{restantes}</Text> {t('facturas_restantes')}
                  </Text>
                  <Text style={styles.contadorTotal}>{limiteInfo.currentCount}/{limiteInfo.limit}</Text>
                </View>
                <View style={styles.contadorBarra}>
                  <View style={[styles.contadorBarraRelleno, {
                    width: `${porcentajeUsado * 100}%` as any,
                    backgroundColor: restantes <= 3 ? '#FF4757' : restantes <= 7 ? '#FF9F43' : '#6C47FF'
                  }]} />
                </View>
                {restantes <= 5 && (
                  <TouchableOpacity onPress={() => router.push("/(tabs)/ajustes")}>
                    <Text style={styles.contadorPremiumLink}>{t('hazte_premium')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        <View style={styles.seccionHeader}>
          <Text style={styles.seccionTitulo}>{t('resumen')}</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/informes")}>
            <Text style={styles.verTodo}>{t('ver_informes')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          {tarjetas.map((tarjeta, i) => (
            <TouchableOpacity key={i} style={styles.tarjeta} onPress={() => router.push(`/(tabs)/documentos?filtro=${tarjeta.filtro}` as any)}>
              <View style={[styles.tarjetaIcono, { backgroundColor: tarjeta.color + "18" }]}>
                <Ionicons name={tarjeta.icono as any} size={20} color={tarjeta.color} />
              </View>
              <Text style={styles.tarjetaValor}>{tarjeta.valor}</Text>
              <Text style={styles.tarjetaLabel}>{tarjeta.label}</Text>
              {tarjeta.count > 0 && (
                <View style={[styles.badge, { backgroundColor: tarjeta.color }]}>
                  <Text style={styles.badgeTexto}>{tarjeta.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.seccionHeader}>
          <Text style={styles.seccionTitulo}>{t('actividad_reciente')}</Text>
          {facturas.length > 0 && (
            <TouchableOpacity onPress={() => router.push("/(tabs)/documentos")}>
              <Text style={styles.verTodo}>{t('ver_todas')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {facturas.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={40} color="#ddd" />
            <Text style={styles.emptyTexto}>{t('sin_facturas')}</Text>
            <Text style={styles.emptySub}>{t('facturas_apareceran')}</Text>
          </View>
        ) : (
          <View style={styles.listaFacturas}>
            <FlatList
              data={facturas.slice(0, 5)}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.facturaMiniCard} onPress={() => router.push(`/(tabs)/documentos?facturaId=${item.id}` as any)}>
                  <View style={[styles.estadoBarra, {
                    backgroundColor: item.estado === "pagada" ? "#26de81" : item.estado === "impagada" ? "#FF4757" : "#FF9F43"
                  }]} />
                  <View style={styles.facturaMiniInfo}>
                    <Text style={styles.facturaMiniNumero}>#{item.numero}</Text>
                    <Text style={styles.facturaMiniCliente}>{item.cliente_nombre}</Text>
                    <Text style={styles.facturaMiniFecha}>{item.fecha ? formatearFechaSync(item.fecha) : ''}</Text>
                  </View>
                  <View style={styles.facturaMiniRight}>
                    <Text style={styles.facturaMiniTotal}>{Number(item.total).toFixed(2)}€</Text>
                    <View style={[styles.estadoMiniPill, {
                      backgroundColor: item.estado === "pagada" ? "#26de8120" : item.estado === "impagada" ? "#FF475720" : "#FF9F4320"
                    }]}>
                      <Text style={[styles.estadoMiniTexto, {
                        color: item.estado === "pagada" ? "#26de81" : item.estado === "impagada" ? "#FF4757" : "#FF9F43"
                      }]}>
                        {item.estado === "pagada" ? t('pagada') : item.estado === "impagada" ? t('impagada') : t('no_enviadas')}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push("/(tabs)/nueva-factura")}>
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={styles.fabTexto}>{t('nueva_factura')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F8F7FF" },
  container: { flex: 1, paddingTop: 55 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 20 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#EEE9FF", justifyContent: "center", alignItems: "center" },
  logoWrap: { flexDirection: "row", alignItems: "baseline" },
  logoZKR: { fontSize: 20, fontWeight: "800", color: "#6C47FF" },
  logoPro: { fontSize: 20, fontWeight: "800", color: "#D4AF37" },
  logoSub: { fontSize: 16, fontWeight: "500", color: "#1a1a1a" },
  banner: { marginHorizontal: 20, marginBottom: 20, borderRadius: 20, backgroundColor: "#6C47FF", padding: 24, flexDirection: "row", overflow: "hidden" },
  bannerTexto: { flex: 1 },
  bannerTitulo: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 6, lineHeight: 30 },
  bannerSub: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginBottom: 18 },
  bannerBoton: { backgroundColor: "#fff", alignSelf: "flex-start", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  bannerBotonTexto: { color: "#6C47FF", fontWeight: "700", fontSize: 14 },
  bannerDeco: { justifyContent: "center", alignItems: "center", opacity: 0.5 },
  contadorWrapper: { marginHorizontal: 20, marginBottom: 20 },
  contadorCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16 },
  contadorTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  contadorTexto: { fontSize: 14, color: "#555", fontWeight: "500" },
  contadorNum: { fontSize: 22, fontWeight: "900", color: "#6C47FF" },
  contadorTotal: { fontSize: 13, color: "#aaa", fontWeight: "600" },
  contadorBarra: { height: 6, backgroundColor: "#f0f0f0", borderRadius: 3, overflow: "hidden" },
  contadorBarraRelleno: { height: "100%" as any, borderRadius: 3 },
  contadorPremiumLink: { fontSize: 13, color: "#6C47FF", fontWeight: "700", marginTop: 10, textAlign: "center" },
  contadorLimite: { backgroundColor: "#FF4757", borderRadius: 16, padding: 16, flexDirection: "row", gap: 10, alignItems: "center" },
  contadorLimiteTexto: { color: "#fff", fontSize: 13, fontWeight: "600", flex: 1, lineHeight: 18 },
  seccionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 14 },
  seccionTitulo: { fontSize: 17, fontWeight: "700", color: "#1a1a1a" },
  verTodo: { fontSize: 14, color: "#6C47FF", fontWeight: "500" },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 12, marginBottom: 28 },
  tarjeta: { backgroundColor: "#fff", borderRadius: 16, padding: 16, width: "46%", marginHorizontal: "1%" },
  tarjetaIcono: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  tarjetaValor: { fontSize: 20, fontWeight: "800", color: "#1a1a1a", marginBottom: 4 },
  tarjetaLabel: { fontSize: 12, color: "#888", fontWeight: "500" },
  badge: { position: "absolute", top: 12, right: 12, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTexto: { fontSize: 11, color: "#fff", fontWeight: "700" },
  emptyState: { alignItems: "center", paddingVertical: 30, marginHorizontal: 20, backgroundColor: "#fff", borderRadius: 16 },
  emptyTexto: { fontSize: 16, fontWeight: "600", color: "#aaa", marginTop: 12 },
  emptySub: { fontSize: 13, color: "#ccc", marginTop: 4 },
  fab: { position: "absolute", bottom: 30, right: 20, backgroundColor: "#6C47FF", borderRadius: 30, paddingHorizontal: 22, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 8, shadowColor: "#6C47FF", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  fabTexto: { color: "#fff", fontWeight: "700", fontSize: 15 },
  listaFacturas: { marginHorizontal: 20 },
  facturaMiniCard: { backgroundColor: "#fff", borderRadius: 12, marginBottom: 4, flexDirection: "row", overflow: "hidden", borderWidth: 1, borderColor: "#f0f0f0" },
  estadoBarra: { width: 3 },
  facturaMiniInfo: { flex: 1, padding: 10 },
  facturaMiniNumero: { fontSize: 13, fontWeight: "700", color: "#1a1a1a" },
  facturaMiniCliente: { fontSize: 11, color: "#888", marginTop: 2 },
  facturaMiniFecha: { fontSize: 10, color: "#bbb", marginTop: 4 },
  facturaMiniRight: { padding: 10, alignItems: "flex-end", justifyContent: "space-between" },
  facturaMiniTotal: { fontSize: 13, fontWeight: "800", color: "#1a1a1a" },
  estadoMiniPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
  estadoMiniTexto: { fontSize: 9, fontWeight: "600" },
});