import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { convertirDeEurosParaMostrar } from "../../utils/currency";
import { getMoneda } from "../../utils/settings";
import { getFacturas } from "../db/facturas";

const { width } = Dimensions.get('window');

export default function Informes() {
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
  const [facturas, setFacturas] = useState<any[]>([]);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<'mes' | 'trimestre' | 'año'>('mes');
  const [simboloMoneda, setSimboloMoneda] = useState('€');
  const [codigoMoneda, setCodigoMoneda] = useState('EUR');
  const [totalMesConvertido, setTotalMesConvertido] = useState(0);
  const [totalGeneralConvertido, setTotalGeneralConvertido] = useState(0);
  const [pendienteCobroConvertido, setPendienteCobroConvertido] = useState(0);
  const [totalPagadasConvertido, setTotalPagadasConvertido] = useState(0);
  const [ultimos6Convertidos, setUltimos6Convertidos] = useState<any[]>([]);
  const [topClientesConvertidos, setTopClientesConvertidos] = useState<any[]>([]);

  useFocusEffect(useCallback(() => {
    const facturasData = getFacturas() as any[];
    setFacturas(facturasData);
    getMoneda().then(m => {
      setSimboloMoneda(m.simbolo);
      setCodigoMoneda(m.codigo);
      
      // Calcular totales en euros
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
      
      // Convertir totales a la moneda seleccionada
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
      
      // Convertir ultimos 6 meses
      const ultimos6 = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(añoActual, mesActual - (5 - i), 1);
        const mes = d.getMonth();
        const año = d.getFullYear();
        const total = facturasData
          .filter(f => { const fd = new Date(f.fecha); return fd.getMonth() === mes && fd.getFullYear() === año; })
          .reduce((acc, f) => acc + (f.total || 0), 0);
        return {
          label: d.toLocaleDateString('es-ES', { month: 'short' }),
          total,
        };
      });
      
      Promise.all(
        ultimos6.map(mes => convertirDeEurosParaMostrar(mes.total, m.codigo))
      ).then(totalesConvertidos => {
        const ultimos6ConTotalesConvertidos = ultimos6.map((mes, i) => ({
          ...mes,
          total: totalesConvertidos[i],
        }));
        setUltimos6Convertidos(ultimos6ConTotalesConvertidos);
      });
      
      // Convertir top clientes
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
  }, []));

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

  // Top clientes
  const porCliente: Record<string, number> = {};
  facturas.forEach(f => {
    const nombre = f.cliente_nombre || t('sin_cliente');
    porCliente[nombre] = (porCliente[nombre] || 0) + (f.total || 0);
  });
  const topClientes = Object.entries(porCliente)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Evolución últimos 6 meses
  const ultimos6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(añoActual, mesActual - (5 - i), 1);
    const mes = d.getMonth();
    const año = d.getFullYear();
    const total = facturas
      .filter(f => { const fd = new Date(f.fecha); return fd.getMonth() === mes && fd.getFullYear() === año; })
      .reduce((acc, f) => acc + (f.total || 0), 0);
    return {
      label: d.toLocaleDateString('es-ES', { month: 'short' }),
      total,
    };
  });

  const maxValor = Math.max(...ultimos6.map(m => m.total), 1);

  const estados = [
    { label: t('pagadas'), valor: totalPagadasConvertido, count: facturas.filter(f => f.estado === 'pagada').length, color: '#26de81' },
    { label: t('pendiente'), valor: pendienteCobroConvertido, count: facturas.filter(f => f.estado !== 'pagada' && f.estado !== 'impagada').length, color: '#FF9F43' },
    { label: t('impagadas'), valor: facturas.filter(f => f.estado === 'impagada').reduce((a, f) => a + f.total, 0), count: facturas.filter(f => f.estado === 'impagada').length, color: '#FF4757' },
  ];

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerTop}>
          <Text style={styles.titulo}>{t('informes_titulo')}</Text>
        </View>

        {/* KPIs */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { backgroundColor: currentTheme.colors.primary }]}>
            <Ionicons name="trending-up-outline" size={22} color="rgba(255,255,255,0.8)" />
            <Text style={styles.kpiValor}>{totalMesConvertido.toFixed(2)} {simboloMoneda}</Text>
            <Text style={styles.kpiLabel}>{t('ingresos_mes')}</Text>
          </View>
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

        {/* Gráfico de barras */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>{t('evolucion')}</Text>
          {facturas.length === 0 ? (
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
  seccionTitulo: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 18 },
  grafico: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160 },
  barraCol: { flex: 1, alignItems: 'center', gap: 6 },
  barraValor: { fontSize: 9, color: '#6C47FF', fontWeight: '700', textAlign: 'center' },
  barraWrapper: { height: 120, justifyContent: 'flex-end', width: '70%' },
  barra: { borderRadius: 6, width: '100%' },
  barraLabel: { fontSize: 11, color: '#888', fontWeight: '500' },
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
  clienteRankNum: { fontSize: 13, fontWeight: '800', color: '#6C47FF' },
  clienteNombre: { flex: 1, fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
  clienteTotal: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
});