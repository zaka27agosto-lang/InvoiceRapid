import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from "../../contexts/ThemeContext";
import { useModernAlert } from "../../components/ModernAlert";
import SwipeNavigation from "../../components/SwipeNavigation";
import { getMoneda } from "../../utils/settings";
import { getFacturas } from "../db/facturas";
import { useSync } from "../../hooks/useSync";

type Periodo = '6m' | '1a' | '2024' | '2023';

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export default function Informes() {
  const { t } = useTranslation();
  const modernAlert = useModernAlert();
  const { currentTheme } = useTheme();
  const { lastSync } = useSync();
  const router = useRouter();
  const [facturas, setFacturas] = useState<any[]>([]);
  const [simboloMoneda, setSimboloMoneda] = useState('€');
  const [periodo, setPeriodo] = useState<Periodo>('6m');
  const [exportando, setExportando] = useState(false);

  const tabOrder = ['/(tabs)/index', '/(tabs)/documentos', '/(tabs)/clientes', '/(tabs)/productos', '/(tabs)/informes', '/(tabs)/ajustes'];

  const navigateToNextTab = () => {
    const ci = tabOrder.indexOf('/(tabs)/informes');
    if (ci < tabOrder.length - 1) router.push(tabOrder[ci + 1] as any);
  };

  const navigateToPreviousTab = () => {
    const ci = tabOrder.indexOf('/(tabs)/informes');
    if (ci > 0) router.push(tabOrder[ci - 1] as any);
  };

  function cargarDatos() {
    setFacturas(getFacturas());
    getMoneda().then(m => { setSimboloMoneda(m.simbolo); });
  }

  useFocusEffect(useCallback(() => { cargarDatos(); }, []));

  const lastSyncRef = useRef(lastSync);
  useEffect(() => {
    if (lastSync && lastSync !== lastSyncRef.current) { lastSyncRef.current = lastSync; cargarDatos(); }
    else lastSyncRef.current = lastSync;
  }, [lastSync]);

  const datosPeriodo = useMemo(() => {
    const ahora = new Date();
    const ma = ahora.getMonth(), aa = ahora.getFullYear();
    let meses: { label: string; ano: number; mes: number; total: number; count: number }[] = [];
    if (periodo === '6m') {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(aa, ma - i, 1);
        meses.push({ label: MESES_CORTOS[d.getMonth()], ano: d.getFullYear(), mes: d.getMonth(), total: 0, count: 0 });
      }
    } else if (periodo === '1a') {
      for (let i = 0; i <= ma; i++) meses.push({ label: MESES_CORTOS[i], ano: aa, mes: i, total: 0, count: 0 });
    } else {
      const a = parseInt(periodo);
      for (let i = 0; i < 12; i++) meses.push({ label: MESES_CORTOS[i], ano: a, mes: i, total: 0, count: 0 });
    }
    let tp = 0, tf = 0;
    facturas.forEach(f => {
      const d = new Date(f.fecha);
      const idx = meses.findIndex(m => m.ano === d.getFullYear() && m.mes === d.getMonth());
      if (idx >= 0) { meses[idx].total += f.total || 0; meses[idx].count += 1; tp += f.total || 0; tf++; }
    });
    return { meses, totalPeriodo: tp, totalFacturas: tf, maxValor: Math.max(...meses.map(m => m.total), 1) };
  }, [facturas, periodo]);

  const kpisMes = useMemo(() => {
    const a = new Date();
    const ma = a.getMonth(), aa = a.getFullYear();
    const fm = facturas.filter(f => { const d = new Date(f.fecha); return d.getMonth() === ma && d.getFullYear() === aa; });
    return {
      totalMes: fm.reduce((ac, f) => ac + (f.total || 0), 0),
      pendiente: facturas.filter(f => f.estado !== 'pagada').reduce((ac, f) => ac + (f.total || 0), 0),
      pagadas: facturas.filter(f => f.estado === 'pagada').reduce((ac, f) => ac + (f.total || 0), 0),
      countMes: fm.length,
    };
  }, [facturas]);

  const datosEstados = useMemo(() => [
    { label: t('pagadas'), total: facturas.filter(f => f.estado === 'pagada').reduce((a, f) => a + f.total, 0), count: facturas.filter(f => f.estado === 'pagada').length, color: '#26de81' },
    { label: t('pendiente'), total: facturas.filter(f => f.estado !== 'pagada' && f.estado !== 'impagada').reduce((a, f) => a + f.total, 0), count: facturas.filter(f => f.estado !== 'pagada' && f.estado !== 'impagada').length, color: '#FF9F43' },
    { label: t('impagadas'), total: facturas.filter(f => f.estado === 'impagada').reduce((a, f) => a + f.total, 0), count: facturas.filter(f => f.estado === 'impagada').length, color: '#FF4757' },
  ], [facturas, t]);

  const topClientes = useMemo(() => {
    const pc: Record<string, number> = {};
    facturas.forEach(f => { const n = f.cliente_nombre || t('sin_cliente'); pc[n] = (pc[n] || 0) + (f.total || 0); });
    return Object.entries(pc).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [facturas, t]);

  const ultimasFacturas = useMemo(() =>
    [...facturas].sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime()).slice(0, 5)
  , [facturas]);

  function statusColor(e: string) {
    switch (e) { case 'pagada': return '#26de81'; case 'impagada': return '#FF4757'; case 'no_enviada': return '#aab2bd'; default: return currentTheme.colors.primary; }
  }
  function statusLabel(e: string) {
    const L: Record<string, string> = { pendiente: t('por_cobrar'), pagada: t('pagada'), impagada: t('impagada'), no_enviada: t('no_enviada') };
    return L[e] || e;
  }

  const PERIODOS: { key: Periodo; label: string }[] = [
    { key: '6m', label: '6 ' + t('meses_corto') }, { key: '1a', label: t('este_ano') }, { key: '2024', label: '2024' }, { key: '2023', label: '2023' },
  ];
  const CH = 180;

  async function exportarCSV() {
    setExportando(true);
    try {
      const fa = getFacturas();
      const h = [t('factura'), t('numero_factura'), t('cliente'), t('fecha_creacion'), t('subtotal'), 'IVA%', t('iva'), 'IRPF%', t('irpf'), t('total'), t('estado'), t('metodo_pago')];
      const rows = fa.map((f: any) => [t('factura'), f.numero, '"' + (f.cliente_nombre || '').replace(/"/g, '""') + '"', new Date(f.fecha).toLocaleDateString('es-ES'), (f.subtotal || 0).toFixed(2), f.iva_porcentaje || 0, (f.iva_importe || 0).toFixed(2), f.irpf_porcentaje || 0, (f.irpf_importe || 0).toFixed(2), (f.total || 0).toFixed(2), f.estado || '', f.metodo_pago || '']);
      const csv = [h.join(','), ...rows.map(r => r.join(','))].join('\n');
      const uri = FileSystem.documentDirectory + 'InvoiceRapid_export_' + Date.now() + '.csv';
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'InvoiceRapid Export - ' + new Date().toLocaleDateString('es-ES') });
      else await Share.share({ message: csv });
    } catch { modernAlert.showError(t('error'), t('error_exportar_csv')) }
    finally { setExportando(false); }
  }

  return (
    <SwipeNavigation onSwipeLeft={navigateToNextTab} onSwipeRight={navigateToPreviousTab}>
      <View style={[styles.wrap, { backgroundColor: currentTheme.colors.background }]}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

          <View style={styles.headRow}>
            <Text style={[styles.titulo, { color: currentTheme.colors.text }]}>{t('informes_titulo')}</Text>
            <TouchableOpacity style={[styles.expBtn, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.primary }]} onPress={exportarCSV} disabled={exportando}>
              <Ionicons name="download-outline" size={17} color={currentTheme.colors.primary} />
              <Text style={[styles.expBtnText, { color: currentTheme.colors.primary }]}>{exportando ? '...' : t('exportar_csv')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.perScroll} contentContainerStyle={styles.perContent}>
            {PERIODOS.map(p => (
              <TouchableOpacity key={p.key} style={[styles.perChip, {
                backgroundColor: periodo === p.key ? currentTheme.colors.primary : currentTheme.colors.card,
                borderColor: periodo === p.key ? currentTheme.colors.primary : (currentTheme.colors.border || '#e8e8e8'),
              }]} onPress={() => setPeriodo(p.key)}>
                <Text style={[styles.perChipText, { color: periodo === p.key ? '#fff' : currentTheme.colors.textSecondary }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.kpiRow}>
            <TouchableOpacity style={[styles.kpiCard, { backgroundColor: currentTheme.colors.primary }]} activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/(tabs)/documentos', params: { tipo: 'facturas', filtroMes: 'actual' } } as any)}>
              <Ionicons name="trending-up" size={20} color="rgba(255,255,255,0.85)" />
              <Text style={styles.kpiVal}>{kpisMes.totalMes.toFixed(2)} {simboloMoneda}</Text>
              <Text style={styles.kpiLbl}>{t('ingresos_mes')}</Text>
              <Text style={styles.kpiCnt}>{kpisMes.countMes} {t('facturas').toLowerCase()}</Text>
            </TouchableOpacity>
            <View style={[styles.kpiCard, styles.kpiOut]}>
              <Ionicons name="time-outline" size={20} color="#FF9F43" />
              <Text style={[styles.kpiValD, { color: '#FF9F43' }]}>{kpisMes.pendiente.toFixed(2)} {simboloMoneda}</Text>
              <Text style={styles.kpiLblD}>{t('pendiente_cobro')}</Text>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, styles.kpiOut]}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#26de81" />
              <Text style={[styles.kpiValD, { color: '#26de81' }]}>{kpisMes.pagadas.toFixed(2)} {simboloMoneda}</Text>
              <Text style={styles.kpiLblD}>{t('pagadas')}</Text>
            </View>
            <View style={[styles.kpiCard, styles.kpiOut]}>
              <Ionicons name="stats-chart-outline" size={20} color={currentTheme.colors.primary} />
              <Text style={[styles.kpiValD, { color: currentTheme.colors.primary }]}>{datosPeriodo.totalPeriodo.toFixed(2)} {simboloMoneda}</Text>
              <Text style={styles.kpiLblD}>{t('total_periodo')}</Text>
              <Text style={styles.kpiCntD}>{datosPeriodo.totalFacturas} {t('facturas').toLowerCase()}</Text>
            </View>
          </View>

          <View style={[styles.sec, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.secTit, { color: currentTheme.colors.text }]}>{t('evolucion_mensual')}</Text>
            {datosPeriodo.totalFacturas === 0 ? (
              <View style={styles.emptyChart}>
                <Ionicons name="bar-chart-outline" size={48} color={currentTheme.colors.textSecondary + '35'} />
                <Text style={[styles.emptyTxt, { color: currentTheme.colors.textSecondary }]}>{t('sin_datos_periodo')}</Text>
              </View>
            ) : (
              <View style={styles.chartOuter}>
                <View style={styles.ejeY}>
                  {[4, 3, 2, 1, 0].map(i => {
                    const val = datosPeriodo.maxValor * i / 4;
                    return <Text key={i} style={styles.ejeYLabel}>{val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(val >= 100 ? 0 : 0)}</Text>;
                  })}
                </View>
                <View style={styles.barArea}>
                  {[0, 1, 2, 3, 4].map(i => <View key={i} style={[styles.gline, { borderBottomColor: (currentTheme.colors.border || '#e8e8e8') + '50' }]} />)}
                  <View style={styles.barRow}>
                    {datosPeriodo.meses.map((mes, i) => {
                      const h = mes.total > 0 ? Math.max((mes.total / datosPeriodo.maxValor) * CH, 3) : 0;
                      const esActual = periodo === '6m' && i === datosPeriodo.meses.length - 1;
                      const vt = mes.total > 0 ? (Number.isInteger(mes.total) ? mes.total.toFixed(0) : mes.total.toFixed(2)) : '';
                      return (
                        <View key={i} style={styles.bCol}>
                          <Text style={[styles.bVal, { color: esActual ? currentTheme.colors.primary : currentTheme.colors.textSecondary }]}>{vt}</Text>
                          <View style={[styles.bTrack, { height: CH }]}>
                            <View style={[styles.bFill, { height: h, backgroundColor: esActual ? currentTheme.colors.primary : currentTheme.colors.primary + '30', borderTopLeftRadius: 5, borderTopRightRadius: 5 }]} />
                          </View>
                          <Text style={styles.bMon}>{mes.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}
          </View>

          {facturas.length > 0 && (
            <View style={[styles.sec, { backgroundColor: currentTheme.colors.card }]}>
              <Text style={[styles.secTit, { color: currentTheme.colors.text }]}>{t('por_estado')}</Text>
              {datosEstados.map((e, i) => {
                const total = facturas.reduce((a, f) => a + (f.total || 0), 0);
                const pct = total > 0 ? (e.total / total) * 100 : 0;
                return (
                  <View key={i} style={styles.estRow}>
                    <View style={[styles.estDot, { backgroundColor: e.color }]} />
                    <Text style={[styles.estName, { color: currentTheme.colors.text }]}>{e.label}</Text>
                    <View style={styles.estBarBg}>
                      <View style={[styles.estBarFill, { width: pct + '%' as any, backgroundColor: e.color + '30', borderColor: e.color }]} />
                    </View>
                    <Text style={[styles.estAmt, { color: currentTheme.colors.text }]}>{e.total.toFixed(2)}{simboloMoneda}</Text>
                    <View style={[styles.estCnt, { backgroundColor: e.color + '18' }]}>
                      <Text style={[styles.estCntTxt, { color: e.color }]}>{e.count}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {topClientes.length > 0 && (
            <View style={[styles.sec, { backgroundColor: currentTheme.colors.card }]}>
              <Text style={[styles.secTit, { color: currentTheme.colors.text }]}>{t('top_clientes')}</Text>
              {topClientes.map(([nombre, total], i) => (
                <View key={i} style={styles.cliRow}>
                  <View style={[styles.cliRank, { backgroundColor: currentTheme.colors.primary + '12' }]}>
                    <Text style={[styles.cliRankNum, { color: currentTheme.colors.primary }]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.cliName, { color: currentTheme.colors.text }]} numberOfLines={1}>{nombre}</Text>
                  <Text style={[styles.cliAmt, { color: currentTheme.colors.text }]}>{total.toFixed(2)} {simboloMoneda}</Text>
                </View>
              ))}
            </View>
          )}

          {ultimasFacturas.length > 0 && (
            <View style={[styles.sec, { backgroundColor: currentTheme.colors.card }]}>
              <View style={styles.secHeadRow}>
                <Text style={[styles.secTit, { color: currentTheme.colors.text, marginBottom: 0 }]}>{t('ultimas_facturas')}</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/documentos' as any)}>
                  <Text style={[styles.verTodas, { color: currentTheme.colors.primary }]}>{t('ver_todas')}</Text>
                </TouchableOpacity>
              </View>
              {ultimasFacturas.map((f, i) => (
                <View key={i} style={[styles.recRow, i < ultimasFacturas.length - 1 && styles.recRowBor]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recNum, { color: currentTheme.colors.text }]} numberOfLines={1}>{f.numero}</Text>
                    <Text style={[styles.recCli, { color: currentTheme.colors.textSecondary }]} numberOfLines={1}>{f.cliente_nombre || t('sin_cliente')}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <Text style={[styles.recTot, { color: currentTheme.colors.text }]}>{Number(f.total || 0).toFixed(2)}{simboloMoneda}</Text>
                    <View style={[styles.recBadge, { backgroundColor: statusColor(f.estado) + '18' }]}>
                      <Text style={[styles.recBadgeTxt, { color: statusColor(f.estado) }]}>{statusLabel(f.estado)}</Text>
                    </View>
                  </View>
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
  wrap: { flex: 1 },
  scroll: { flex: 1, paddingTop: 55 },

  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 },
  titulo: { fontSize: 26, fontWeight: '800' },
  expBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 7, borderWidth: 1.5 },
  expBtnText: { fontSize: 13, fontWeight: '700' },

  perScroll: { marginBottom: 14 },
  perContent: { paddingHorizontal: 16 },
  perChip: { borderRadius: 10, paddingHorizontal: 15, paddingVertical: 7, borderWidth: 1.5, marginRight: 8 },
  perChipText: { fontSize: 13, fontWeight: '700' },

  kpiRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  kpiCard: { flex: 1, borderRadius: 16, padding: 16, gap: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  kpiOut: { borderWidth: 1.5 },
  kpiVal: { fontSize: 19, fontWeight: '800', color: '#fff' },
  kpiLbl: { fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiCnt: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  kpiValD: { fontSize: 19, fontWeight: '800' },
  kpiLblD: { fontSize: 10, color: '#999', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiCntD: { fontSize: 10, color: '#bbb', fontWeight: '500' },

  sec: { borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 18 },
  secTit: { fontSize: 15, fontWeight: '700', marginBottom: 16 },
  secHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  verTodas: { fontSize: 13, fontWeight: '600' },

  chartOuter: { flexDirection: 'row', height: 202 },
  ejeY: { width: 40, justifyContent: 'space-between', paddingBottom: 24, paddingTop: 2 },
  ejeYLabel: { fontSize: 9, fontWeight: '600', color: '#999', textAlign: 'right', paddingRight: 4 },
  barArea: { flex: 1, position: 'relative' },
  gline: { position: 'absolute', left: 0, right: 0, borderBottomWidth: 1 },
  barRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-evenly', paddingBottom: 24, paddingTop: 2 },
  bCol: { alignItems: 'center', flex: 1, gap: 2 },
  bVal: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
  bTrack: { width: '55%', justifyContent: 'flex-end' },
  bFill: { width: '100%' },
  bMon: { fontSize: 10, fontWeight: '600', color: '#999' },

  emptyChart: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyTxt: { fontSize: 14 },

  estRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  estDot: { width: 8, height: 8, borderRadius: 4 },
  estName: { fontSize: 12, fontWeight: '600', width: 72 },
  estBarBg: { flex: 1, height: 7, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  estBarFill: { height: '100%', borderRadius: 4, borderWidth: 1 },
  estAmt: { fontSize: 12, fontWeight: '700', width: 56, textAlign: 'right' },
  estCnt: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, minWidth: 24, alignItems: 'center' },
  estCntTxt: { fontSize: 10, fontWeight: '700' },

  cliRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cliRank: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  cliRankNum: { fontSize: 12, fontWeight: '800' },
  cliName: { flex: 1, fontSize: 14, fontWeight: '500' },
  cliAmt: { fontSize: 14, fontWeight: '700' },

  recRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9 },
  recRowBor: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  recNum: { fontSize: 14, fontWeight: '700' },
  recCli: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  recTot: { fontSize: 14, fontWeight: '700' },
  recBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  recBadgeTxt: { fontSize: 10, fontWeight: '700' },
});
