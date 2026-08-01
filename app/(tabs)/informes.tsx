import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from "../../contexts/ThemeContext";
import SwipeNavigation from "../../components/SwipeNavigation";
import { convertirDeEurosParaMostrar } from "../../utils/currency";
import { getMoneda } from "../../utils/settings";
import { getFacturas } from "../db/facturas";
import { useSync } from "../../hooks/useSync";

/**
 * Formatea un número quitando ceros decimales innecesarios.
 * 12.50 → "12.5", 25 → "25", 37.50 → "37.5"
 */
function formatClean(val: number): string {
  if (val === 0) return '0';
  return val.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Calcula un máximo "bonito" para el eje Y del gráfico.
 * Garantiza que los 5 ticks del eje Y (0, step, 2*step, 3*step, 4*step)
 * sean números enteros que acaben en 0: 10, 20, 50, 100, 200, 500, 1000...
 */
function niceChartMax(rawMax: number): number {
  if (rawMax <= 0) return 10;
  // Step ideal = max / 4, redondeado a un número bonito que acabe en 0
  const roughStep = rawMax / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / magnitude;

  let niceStep: number;
  if (residual <= 1) niceStep = magnitude;           // 1, 10, 100, 1000...
  else if (residual <= 2) niceStep = 2 * magnitude;  // 2, 20, 200, 2000...
  else if (residual <= 5) niceStep = 5 * magnitude;  // 5, 50, 500, 5000...
  else niceStep = 10 * magnitude;                     // 10, 100, 1000, 10000...

  return niceStep * 4;
}

export default function Informes() {
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
  const { lastSync } = useSync();
  const router = useRouter();
  const [facturas, setFacturas] = useState<any[]>([]);
  const [simboloMoneda, setSimboloMoneda] = useState('€');
  const [, setCodigoMoneda] = useState('EUR');
  const [totalMesConvertido, setTotalMesConvertido] = useState(0);
  const [totalGeneralConvertido, setTotalGeneralConvertido] = useState(0);
  const [pendienteCobroConvertido, setPendienteCobroConvertido] = useState(0);
  const [totalPagadasConvertido, setTotalPagadasConvertido] = useState(0);
  const [ultimos6Convertidos, setUltimos6Convertidos] = useState<any[]>([]);
  const [topClientesConvertidos, setTopClientesConvertidos] = useState<any[]>([]);
  const [exportando, setExportando] = useState(false);
  const [maxValorConvertido, setMaxValorConvertido] = useState(1);

  const tabOrder = ['/(tabs)/index', '/(tabs)/documentos', '/(tabs)/clientes', '/(tabs)/productos', '/(tabs)/informes', '/(tabs)/ajustes'];

  const navigateToNextTab = () => {
    const currentIndex = tabOrder.indexOf('/(tabs)/informes');
    if (currentIndex < tabOrder.length - 1) {
      router.push(tabOrder[currentIndex + 1] as any);
    }
  };

  const navigateToPreviousTab = () => {
    const currentIndex = tabOrder.indexOf('/(tabs)/informes');
    if (currentIndex > 0) {
      router.push(tabOrder[currentIndex - 1] as any);
    }
  };

  function cargarDatos() {
    const facturasData = getFacturas();
    setFacturas(facturasData);

    getMoneda().then(m => {
      setSimboloMoneda(m.simbolo);
      setCodigoMoneda(m.codigo);
      
      const ahora = new Date();
      const mesActual = ahora.getMonth();
      const añoActual = ahora.getFullYear();
      
      const facturasMes = facturasData.filter(f => {
        const d = new Date(f.fecha);
        return d.getMonth() === mesActual && d.getFullYear() === añoActual;
      });
      
      const totalMes = facturasMes.reduce((acc, f) => acc + (f.total || 0), 0);
      const totalGeneral = facturasData.reduce((acc, f) => acc + (f.total || 0), 0);
      const pendienteCobro = facturasData.filter(f => f.estado !== 'pagada').reduce((acc, f) => acc + (f.total || 0), 0);
      const totalPagadas = facturasData.filter(f => f.estado === 'pagada').reduce((acc, f) => acc + (f.total || 0), 0);
      
      Promise.all([
        convertirDeEurosParaMostrar(totalMes, m.codigo),
        convertirDeEurosParaMostrar(totalGeneral, m.codigo),
        convertirDeEurosParaMostrar(pendienteCobro, m.codigo),
        convertirDeEurosParaMostrar(totalPagadas, m.codigo),
      ]).then(([mes, general, pendiente, pagadas]) => {
        setTotalMesConvertido(mes);
        setTotalGeneralConvertido(general);
        setPendienteCobroConvertido(pendiente);
        setTotalPagadasConvertido(pagadas);
      });
      
      // Calcular ultimos 6 meses (solo facturas)
      const ultimos6 = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(añoActual, mesActual - (5 - i), 1);
        const mes = d.getMonth();
        const año = d.getFullYear();
        const totalFacturas = facturasData
          .filter(f => { const fd = new Date(f.fecha); return fd.getMonth() === mes && fd.getFullYear() === año; })
          .reduce((acc, f) => acc + (f.total || 0), 0);
        return { label: d.toLocaleDateString('es-ES', { month: 'short' }), total: totalFacturas };
      });
      
      Promise.all(
        ultimos6.map(mes => convertirDeEurosParaMostrar(mes.total, m.codigo))
      ).then(totalesConvertidos => {
        const ultimos6ConTotalesConvertidos = ultimos6.map((mes, i) => ({
          label: mes.label,
          total: totalesConvertidos[i],
        }));
        setUltimos6Convertidos(ultimos6ConTotalesConvertidos);
        setMaxValorConvertido(Math.max(...ultimos6ConTotalesConvertidos.map((m: any) => m.total || 0), 1));
      });
      
      // Convertir top clientes (solo facturas)
      const porCliente: Record<string, number> = {};
      facturasData.forEach(f => {
        const nombre = f.cliente_nombre || t('sin_cliente');
        porCliente[nombre] = (porCliente[nombre] || 0) + (f.total || 0);
      });
      const topClientes = Object.entries(porCliente)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      Promise.all(
        topClientes.map(([_, total]) => convertirDeEurosParaMostrar(total, m.codigo))
      ).then(totalesConvertidos => {
        const topClientesConTotalesConvertidos = topClientes.map(([nombre, _], i) => [
          nombre,
          totalesConvertidos[i],
        ]);
        setTopClientesConvertidos(topClientesConTotalesConvertidos);
      });
    });
  }

  useFocusEffect(useCallback(() => {
    cargarDatos();
  }, []));

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



  const ahora = new Date();
  const mesActual = ahora.getMonth();
  const añoActual = ahora.getFullYear();

  const facturasMes = facturas.filter(f => {
    const d = new Date(f.fecha);
    return d.getMonth() === mesActual && d.getFullYear() === añoActual;
  });

  const totalMes = facturasMes.reduce((acc, f) => acc + (f.total || 0), 0);
  const totalGeneral = facturas.reduce((acc, f) => acc + (f.total || 0), 0);
  const pendienteCobro = facturas.filter(f => f.estado !== 'pagada').reduce((acc, f) => acc + (f.total || 0), 0);
  const totalPagadas = facturas.filter(f => f.estado === 'pagada').reduce((acc, f) => acc + (f.total || 0), 0);

  // Top clientes (solo facturas)
  const porCliente: Record<string, number> = {};
  facturas.forEach(f => {
    const nombre = f.cliente_nombre || t('sin_cliente');
    porCliente[nombre] = (porCliente[nombre] || 0) + (f.total || 0);
  });
  const topClientes = Object.entries(porCliente)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Evolución últimos 6 meses (solo facturas)
  const ultimos6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(añoActual, mesActual - (5 - i), 1);
    const mes = d.getMonth();
    const año = d.getFullYear();
    const totalFacturas = facturas
      .filter(f => { const fd = new Date(f.fecha); return fd.getMonth() === mes && fd.getFullYear() === año; })
      .reduce((acc, f) => acc + (f.total || 0), 0);
    return { label: d.toLocaleDateString('es-ES', { month: 'short' }), total: totalFacturas };
  });

  const maxValor = Math.max(...ultimos6.map(m => m.total), 1);
  // Para las barras usamos el maxValor en moneda convertida (proporciones correctas)
  const maxValorGrafico = maxValorConvertido > 0 ? maxValorConvertido : maxValor;

  async function exportarCSV() {
    setExportando(true);
    try {
      const facturasAll = getFacturas();
      
      const headers = [t('factura'), t('numero_factura'), t('cliente'), t('fecha_creacion'), t('subtotal'), 'IVA%', t('iva'), 'IRPF%', t('irpf'), t('total'), t('estado'), t('metodo_pago')];
      const facturasRows = facturasAll.map((f: any) => [
        t('factura'), f.numero,
        `"${(f.cliente_nombre || '').replace(/"/g, '""')}"`,
        new Date(f.fecha).toLocaleDateString('es-ES'),
        (f.subtotal || 0).toFixed(2), f.iva_porcentaje || 0, (f.iva_importe || 0).toFixed(2),
        f.irpf_porcentaje || 0, (f.irpf_importe || 0).toFixed(2), (f.total || 0).toFixed(2),
        f.estado || '', f.metodo_pago || ''
      ]);
      
      const csvContent = [headers.join(','), ...facturasRows.map(r => r.join(','))].join('\n');
      const fileUri = `${FileSystem.documentDirectory}InvoiceRapid_export_${Date.now()}.csv`;
      
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: `InvoiceRapid Export - ${new Date().toLocaleDateString('es-ES')}` });
      } else {
        await Share.share({ message: csvContent });
      }
    } catch (err) {
      Alert.alert(t('error'), t('error_exportar_csv'));
    } finally {
      setExportando(false);
    }
  }

  const estados = [
    { label: t('pagadas'), valor: totalPagadasConvertido, count: facturas.filter(f => f.estado === 'pagada').length, color: '#26de81' },
    { label: t('pendiente'), valor: pendienteCobroConvertido, count: facturas.filter(f => f.estado !== 'pagada' && f.estado !== 'impagada').length, color: '#FF9F43' },
    { label: t('impagadas'), valor: facturas.filter(f => f.estado === 'impagada').reduce((a, f) => a + f.total, 0), count: facturas.filter(f => f.estado === 'impagada').length, color: '#FF4757' },
  ];

  return (
    <SwipeNavigation onSwipeLeft={navigateToNextTab} onSwipeRight={navigateToPreviousTab}>
    <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.headerTop}>
            <Text style={styles.titulo}>{t('informes_titulo')}</Text>
          </View>          {/* Botón exportar CSV */}
          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.primary }]}
            onPress={exportarCSV}
            disabled={exportando}
          >
            <Ionicons name="download-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.exportBtnTexto, { color: currentTheme.colors.primary }]}>
              {exportando ? t('exportando') : t('exportar_csv')}
            </Text>
          </TouchableOpacity>

        {/* KPIs */}
        <View style={styles.kpiGrid}>
          <TouchableOpacity
            style={[styles.kpiCard, { backgroundColor: currentTheme.colors.primary }]}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/(tabs)/documentos', params: { tipo: 'facturas', filtroMes: 'actual' } } as any)}
          >
            <Ionicons name="trending-up-outline" size={22} color="rgba(255,255,255,0.8)" />
            <Text style={styles.kpiValor}>{totalMesConvertido.toFixed(2)} {simboloMoneda}</Text>
            <Text style={styles.kpiLabel}>{t('ingresos_mes')}</Text>
          </TouchableOpacity>
          <View style={[styles.kpiCard, { backgroundColor: '#1a1a2e' }]}>
            <Ionicons name="stats-chart-outline" size={22} color="rgba(255,255,255,0.8)" />
            <Text style={styles.kpiValor}>{totalGeneralConvertido.toFixed(2)} {simboloMoneda}</Text>
            <Text style={styles.kpiLabel}>{t('total_facturado')}</Text>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, styles.kpiCardLight]}>
            <Ionicons name="time-outline" size={22} color="#FF9F43" />
            <Text style={[styles.kpiValor, { color: '#FF9F43' }]}>{pendienteCobroConvertido.toFixed(2)} {simboloMoneda}</Text>
            <Text style={[styles.kpiLabel, { color: '#888' }]}>{t('pendiente_cobro')}</Text>
          </View>
          <View style={[styles.kpiCard, styles.kpiCardLight]}>
            <Ionicons name="checkmark-circle-outline" size={22} color="#26de81" />
            <Text style={[styles.kpiValor, { color: '#26de81' }]}>{totalPagadasConvertido.toFixed(2)} {simboloMoneda}</Text>
            <Text style={[styles.kpiLabel, { color: '#888' }]}>{t('pagadas')}</Text>
          </View>
        </View>

        {/* Gráfico de evolución */}
        <View style={styles.seccion}>
          <View style={styles.seccionHeader}>
            <Text style={styles.seccionTitulo}>{t('evolucion')}</Text>
          </View>
          {facturas.length === 0 ? (
            <View style={styles.emptyGrafico}>
              <Ionicons name="bar-chart-outline" size={40} color="#e0e0e0" />
              <Text style={styles.emptyTexto}>{t('sin_datos')}</Text>
            </View>
          ) : (
            <View style={styles.graficoContainer}>
              {/* Eje Y */}
              <View style={styles.ejeY}>
                {(() => {
                  const niceMax = niceChartMax(maxValorGrafico);
                  const step = niceMax / 4;
                  return [4, 3, 2, 1, 0].map(i => {
                    const val = i * step;
                    const formatted = formatClean(val);
                    return (
                      <Text key={i} style={styles.ejeYLabel}>
                        {maxValorGrafico > 0 ? formatted : '0'}
                      </Text>
                    );
                  });
                })()}
              </View>
              {/* Barras */}
              <View style={styles.barrasContainer}>
                <View style={styles.lineasGuia}>
                  {[0, 25, 50, 75, 100].map(pct => (
                    <View key={pct} style={[styles.lineaGuia, { borderBottomColor: currentTheme.colors.border + '60' }]} />
                  ))}
                </View>
                {ultimos6Convertidos.map((mes, i) => {
                  const niceMax = niceChartMax(maxValorGrafico);
                  const alturaPct = niceMax > 0 ? (mes.total / niceMax) * 100 : 0;
                  // Mostrar valor exacto (sin decimales si es entero, con 2 decimales si no)
                  const valorTexto = mes.total > 0 ? formatClean(mes.total) : '';
                  return (
                    <View key={i} style={styles.barraCol}>
                      <View style={styles.barraWrapper}>
                        <Text style={[styles.barraValor, { color: currentTheme.colors.primary }]}>
                          {valorTexto}
                        </Text>
                        <View
                          style={[
                            styles.barra,
                            {
                              height: `${Math.max(alturaPct, mes.total > 0 ? 2 : 0)}%` as any,
                              backgroundColor: i === 5 ? currentTheme.colors.primary : currentTheme.colors.primary + '40',
                              borderTopLeftRadius: 6,
                              borderTopRightRadius: 6,
                            }
                          ]}
                        />
                      </View>
                      <Text style={styles.barraLabel}>{mes.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Gráfico de barras (antiguo, reemplazado) */}
        {/* Comentado: el nuevo gráfico está arriba
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>{t('evolucion')}</Text>
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>{t('evolucion')}</Text>
          {facturasFiltradas.length === 0 && albaranesFiltrados.length === 0 ? (
            <View style={styles.emptyGrafico}>
              <Ionicons name="bar-chart-outline" size={40} color="#e0e0e0" />
              <Text style={styles.emptyTexto}>{t('sin_datos')}</Text>
            </View>
          ) : (
            <View style={styles.grafico}>
              {ultimos6Convertidos.map((mes, i) => (
                <View key={i} style={styles.barraCol}>
                  <Text style={styles.barraValor}>
                    {mes.total > 0 ? `${mes.total.toFixed(2)}${simboloMoneda}` : ''}
                  </Text>
                  <View style={styles.barraWrapper}>
                    <View
                      style={[
                        styles.barra,
                        {
                          height: Math.max((mes.total / Math.max(...ultimos6Convertidos.map(m => m.total), 1)) * 120, mes.total > 0 ? 4 : 0),
                          backgroundColor: i === 5 ? currentTheme.colors.primary : currentTheme.colors.primary + '40',
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.barraLabel}>{mes.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Por estado */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>{t('por_estado')}</Text>
          {estados.map((e, i) => (
            <View key={i} style={styles.estadoFila}>
              <View style={[styles.estadoDot, { backgroundColor: e.color }]} />
              <Text style={styles.estadoLabel}>{e.label}</Text>
              <View style={styles.estadoBarWrapper}>
                <View style={[styles.estadoBar, {
                  width: totalGeneral > 0 ? `${(e.valor / totalGeneral) * 100}%` : '0%',
                  backgroundColor: e.color + '40',
                  borderColor: e.color,
                }]} />
              </View>
              <Text style={styles.estadoValor}>{e.valor.toFixed(2)}{simboloMoneda}</Text>
              <View style={[styles.estadoBadge, { backgroundColor: e.color + '20' }]}>
                <Text style={[styles.estadoBadgeTexto, { color: e.color }]}>{e.count}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Top clientes */}
        {topClientesConvertidos.length > 0 && (
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>{t('top_clientes')}</Text>
            {topClientesConvertidos.map(([nombre, total], i) => (
              <View key={i} style={styles.clienteFila}>
                <View style={styles.clienteRank}>
                  <Text style={styles.clienteRankNum}>{i + 1}</Text>
                </View>
                <Text style={styles.clienteNombre} numberOfLines={1}>{nombre}</Text>
                <Text style={styles.clienteTotal}>{total.toFixed(2)} {simboloMoneda}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
        </ScrollView>
    </View>
    </SwipeNavigation>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F8F7FF' },
  scroll: { flex: 1, paddingTop: 55 },
  headerTop: { paddingHorizontal: 20, marginBottom: 20 },
  titulo: { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  kpiGrid: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  kpiCard: { flex: 1, borderRadius: 16, padding: 18, gap: 8 },
  kpiCardLight: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0f0f0' },
  kpiValor: { fontSize: 20, fontWeight: '800', color: '#fff' },
  kpiLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  seccion: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, marginBottom: 16, padding: 18 },
  seccionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seccionTitulo: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 18 },
  leyendaContainer: { flexDirection: 'row', gap: 12 },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  leyendaDot: { width: 10, height: 10, borderRadius: 5 },
  leyendaTexto: { fontSize: 11, color: '#888', fontWeight: '500' },
  grafico: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160 },
  barraCol: { flex: 1, alignItems: 'center', gap: 6 },
  barraValor: { fontSize: 9, color: '#007AFF', fontWeight: '700', textAlign: 'center', position: 'absolute', top: -16, left: 0, right: 0 },
  barraWrapper: { flex: 1, justifyContent: 'flex-end', width: '70%', position: 'relative' },
  barra: { borderRadius: 6, width: '100%' },
  barraLabel: { fontSize: 11, color: '#888', fontWeight: '500' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginBottom: 16, borderRadius: 12, paddingVertical: 14, borderWidth: 1.5 },
  exportBtnTexto: { fontSize: 14, fontWeight: '700' },
  filtroTipoContainer: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, gap: 8 },
  filtroTipoBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  filtroTipoTexto: { fontSize: 13, fontWeight: '700' },
  graficoContainer: { flexDirection: 'row', height: 180 },
  ejeY: { width: 50, justifyContent: 'space-between', paddingRight: 8, paddingBottom: 24 },
  ejeYLabel: { fontSize: 10, color: '#888', fontWeight: '500', textAlign: 'right' },
  barrasContainer: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative' },
  lineasGuia: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 24, justifyContent: 'space-between' },
  lineaGuia: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  emptyGrafico: { alignItems: 'center', paddingVertical: 30, gap: 10 },
  emptyTexto: { color: '#ccc', fontSize: 14 },
  estadoFila: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  estadoDot: { width: 10, height: 10, borderRadius: 5 },
  estadoLabel: { fontSize: 13, color: '#555', fontWeight: '500', width: 70 },
  estadoBarWrapper: { flex: 1, height: 8, backgroundColor: '#f5f5f5', borderRadius: 4, overflow: 'hidden' },
  estadoBar: { height: '100%', borderRadius: 4, borderWidth: 1 },
  estadoValor: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', width: 60, textAlign: 'right' },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  estadoBadgeTexto: { fontSize: 11, fontWeight: '700' },
  clienteFila: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  clienteRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEE9FF', justifyContent: 'center', alignItems: 'center' },
  clienteRankNum: { fontSize: 13, fontWeight: '800', color: '#007AFF' },
  clienteNombre: { flex: 1, fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
  clienteTotal: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
});