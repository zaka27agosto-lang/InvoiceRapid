import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    FlatList,
    Keyboard,
    Modal,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from "react-native";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useTheme } from "../../contexts/ThemeContext";
import { generarYCompartirPDF } from "../../utils/pdf";
import { FormatoFecha, getFormatoFecha, getMoneda, getPlantillaPDF } from "../../utils/settings";
import { deleteFactura, getFacturaItems, getFacturas, updateEstadoFactura } from "../db/facturas";

const ESTADOS = ['todas', 'no_enviada', 'pendiente', 'pagada', 'impagada'];

export default function Documentos() {
  const { t } = useTranslation();
  const { currentTheme } = useTheme();

  const ESTADOS_LABELS: Record<string, string> = {
    'pendiente': t('por_cobrar'),
    'pagada': t('pagada'),
    'impagada': t('impagada'),
    'no_enviada': t('no_enviada'),
    'todas': t('todas'),
  };

  const { filtro: filtroParam, facturaId: facturaIdParam } = useLocalSearchParams<{ filtro?: string; facturaId?: string }>();
  const [facturas, setFacturas] = useState<any[]>([]);
  const [filtrosSeleccionados, setFiltrosSeleccionados] = useState<string[]>([filtroParam || 'todas']);
  const [busqueda, setBusqueda] = useState('');
  const [facturaDetalle, setFacturaDetalle] = useState<any>(null);
  const [itemsDetalle, setItemsDetalle] = useState<any[]>([]);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [mostrarPaywall, setMostrarPaywall] = useState(false);
  const [comprando, setComprando] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const [mostrarFiltro, setMostrarFiltro] = useState(false);
  const [mostrarDatePicker, setMostrarDatePicker] = useState(false);
  const [mostrarFiltroImporte, setMostrarFiltroImporte] = useState(false);
  const [importeMinimo, setImporteMinimo] = useState('');
  const [importeMaximo, setImporteMaximo] = useState('');
  const [formatoFecha, setFormatoFecha] = useState<FormatoFecha>('DD/MM/YYYY');
  const [simboloMoneda, setSimboloMoneda] = useState('€');
  const hoy = new Date();
  const [diaSeleccionado, setDiaSeleccionado] = useState(hoy.getDate());
  const [mesSeleccionado, setMesSeleccionado] = useState(hoy.getMonth() + 1);
  const [añoSeleccionado, setAñoSeleccionado] = useState(hoy.getFullYear());
  const router = useRouter();
  const { isPremium, offerings, comprar, restaurar } = useSubscription();

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

  async function handleComprar(pkg: any) {
    setComprando(true);
    const result = await comprar(pkg);
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

  useFocusEffect(useCallback(() => {
    cargarFacturas();
    getFormatoFecha().then(setFormatoFecha);
    getMoneda().then(m => setSimboloMoneda(m.simbolo));
    
    // Resetear filtro a 'todas' cuando no hay parámetro
    if (!filtroParam) {
      setFiltrosSeleccionados(['todas']);
    } else if (filtroParam) {
      setFiltrosSeleccionados([filtroParam]);
    }
    
    // Si hay facturaId, abrir el detalle automáticamente solo una vez
    if (facturaIdParam && !mostrarDetalle) {
      const factura = getFacturas().find((f: any) => f.id === parseInt(facturaIdParam));
      if (factura) {
        abrirDetalle(factura);
        // Limpiar el parámetro para que no se vuelva a abrir
        router.setParams({ facturaId: undefined });
      }
    }
  }, [filtroParam, facturaIdParam, mostrarDetalle]));

  function cargarFacturas() {
    setFacturas(getFacturas() as any[]);
  }

  function abrirDetalle(factura: any) {
    const items = getFacturaItems(factura.id) as any[];
    setFacturaDetalle(factura);
    setItemsDetalle(items);
    setMostrarDetalle(true);
  }

  async function handleExportarPDF() {
    if (!facturaDetalle) return;
    setGenerandoPDF(true);
    try {
      const plantilla = await getPlantillaPDF();
      const itemsConCalculos = itemsDetalle.map((item: any) => ({
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        unidad: item.unidad,
        precio_unitario: item.precio_unitario,
        descuento: item.descuento,
        subtotal: item.subtotal,
      }));
      await generarYCompartirPDF(facturaDetalle, itemsConCalculos, isPremium, plantilla);
    } catch (e) {
      Alert.alert(t('error'), t('no_se_pudo_generar_pdf'));
    } finally {
      setGenerandoPDF(false);
    }
  }

  async function handleCompartirConPDF() {
    if (!facturaDetalle) return;
    setGenerandoPDF(true);
    try {
      const plantilla = await getPlantillaPDF();
      await generarYCompartirPDF(facturaDetalle, itemsDetalle, isPremium, plantilla, simboloMoneda);
    } catch (e) {
      try {
        await Share.share({
          message: `Factura ${facturaDetalle.numero} — ${Number(facturaDetalle.total).toFixed(2)}${simboloMoneda}\nGenerada con InvoiceRapid Pro.`,
        });
      } catch {
        Alert.alert(t('error'), t('no_se_pudo_compartir'));
      }
    } finally {
      setGenerandoPDF(false);
    }
  }

  function handleCambiarEstado(estado: string) {
    if (!facturaDetalle) return;
    Alert.alert(t('cambiar_estado'), `¿Marcar esta factura como "${estadoLabel(estado)}"?`, [
      { text: t('cancelar'), style: "cancel" },
      { text: t('confirmar'), onPress: () => { updateEstadoFactura(facturaDetalle.id, estado); setFacturaDetalle({ ...facturaDetalle, estado }); cargarFacturas(); } }
    ]);
  }

  function handleEliminar() {
    Alert.alert(t('eliminar_factura'), t('confirmar_eliminar_factura'),[
      { text: t('cancelar'), style: "cancel" },
      { text: t('eliminar'), style: "destructive", onPress: () => { deleteFactura(facturaDetalle.id); setMostrarDetalle(false); cargarFacturas(); } }
    ]);
  }

  function estadoLabel(estado: string) {
    return ESTADOS_LABELS[estado] || estado;
  }

  function estadoColor(estado: string) {
    switch (estado) {
      case 'pagada': return '#26de81';
      case 'impagada': return '#FF4757';
      case 'no_enviada': return '#FF9F43';
      default: return '#6C47FF';
    }
  }

  const facturasFiltradas = (() => {
    let filtradas = facturas;
    
    // Si 'todas' está seleccionado, mostrar todas
    // Si no, filtrar por los estados seleccionados
    if (!filtrosSeleccionados.includes('todas')) {
      filtradas = facturas.filter(f => filtrosSeleccionados.includes(f.estado));
    }
    
    if (busqueda) {
      filtradas = filtradas.filter(f => {
        const fechaFormateada = f.fecha ? formatearFechaSync(f.fecha) : '';
        return (
          f.numero.toLowerCase() === busqueda.toLowerCase() ||
          f.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          fechaFormateada === busqueda
        );
      });
    }

    // Filtrar por importe mínimo
    if (importeMinimo) {
      const min = parseFloat(importeMinimo);
      filtradas = filtradas.filter(f => f.total >= min);
    }

    // Filtrar por importe máximo
    if (importeMaximo) {
      const max = parseFloat(importeMaximo);
      filtradas = filtradas.filter(f => f.total <= max);
    }

    return filtradas;
  })();

  const generarDiasCalendario = () => {
    const firstDay = new Date(añoSeleccionado, mesSeleccionado - 1, 1).getDay();
    const daysInMonth = new Date(añoSeleccionado, mesSeleccionado, 0).getDate();
    const emptyDays = firstDay === 0 ? 6 : firstDay - 1;
    const days = [];
    for (let i = 0; i < emptyDays; i++) {
      days.push(<View key={`empty-${i}`} style={styles.datePickerDayEmpty} />);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(
        <TouchableOpacity
          key={i}
          style={[styles.datePickerDay, diaSeleccionado === i && styles.datePickerDayActivo]}
          onPress={() => setDiaSeleccionado(i)}
        >
          <Text style={[styles.datePickerDayText, diaSeleccionado === i && styles.datePickerDayTextActivo]}>{i}</Text>
        </TouchableOpacity>
      );
    }
    return days;
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <Text style={[styles.titulo, { color: currentTheme.colors.text }]}>{t('documentos')}</Text>
          <View style={[styles.busquedaContainer, { backgroundColor: currentTheme.colors.card }]}>
            <Ionicons name="search" size={18} color={currentTheme.colors.textSecondary} style={styles.busquedaIcono} />
            <TextInput
              style={[styles.busquedaInput, { color: currentTheme.colors.text }]}
              placeholder="Buscar factura o cliente"
              placeholderTextColor={currentTheme.colors.textSecondary}
              value={busqueda}
              onChangeText={setBusqueda}
            />
            {busqueda.length > 0 && (
              <TouchableOpacity onPress={() => setBusqueda('')}>
                <Ionicons name="close-circle" size={18} color={currentTheme.colors.textSecondary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setMostrarDatePicker(true)} style={styles.fechaBtn}>
              <Ionicons name="calendar-outline" size={18} color={currentTheme.colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.filtroDropdownContainer, { backgroundColor: currentTheme.colors.card }]}>
            <TouchableOpacity style={styles.filtroDropdownBtn} onPress={() => setMostrarFiltro(!mostrarFiltro)}>
              <Text style={[styles.filtroDropdownLabel, { color: currentTheme.colors.textSecondary }]}>Filtro:</Text>
              <Text style={[styles.filtroDropdownValue, { color: currentTheme.colors.text }]}>
                {filtrosSeleccionados.includes('todas') ? 'Todas' : filtrosSeleccionados.map(e => estadoLabel(e)).join(', ')}
              </Text>
              <Ionicons name="chevron-down" size={20} color={currentTheme.colors.textSecondary} />
            </TouchableOpacity>
            {mostrarFiltro && (
              <View style={[styles.filtroDropdownMenu, { backgroundColor: currentTheme.colors.card }]}>
                {ESTADOS.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.filtroDropdownItem, filtrosSeleccionados.includes(e) && { backgroundColor: currentTheme.colors.primaryLight }]}
                    onPress={() => {
                      if (e === 'todas') {
                        setFiltrosSeleccionados(['todas']);
                        setMostrarFiltro(false);
                      } else {
                        if (filtrosSeleccionados.includes('todas')) {
                          setFiltrosSeleccionados([e]);
                        } else {
                          setFiltrosSeleccionados(
                            filtrosSeleccionados.includes(e)
                              ? filtrosSeleccionados.filter(f => f !== e)
                              : [...filtrosSeleccionados, e]
                          );
                          if (filtrosSeleccionados.length === 1 && filtrosSeleccionados.includes(e)) {
                            setFiltrosSeleccionados(['todas']);
                          }
                        }
                      }
                    }}
                  >
                    <Text style={[styles.filtroDropdownItemText, { color: currentTheme.colors.text }, filtrosSeleccionados.includes(e) && { color: currentTheme.colors.primary }]}>
                      {estadoLabel(e)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={[styles.filtroImporteContainer, { backgroundColor: currentTheme.colors.card }]}>
            <TouchableOpacity style={styles.filtroImporteBtn} onPress={() => setMostrarFiltroImporte(!mostrarFiltroImporte)}>
              <Ionicons name="cash-outline" size={18} color={currentTheme.colors.primary} />
              <Text style={[styles.filtroImporteLabel, { color: currentTheme.colors.text }]}>
                {importeMinimo || importeMaximo ? `Importe: ${importeMinimo || '0'} - ${importeMaximo || '∞'}` : 'Filtrar por importe'}
              </Text>
              {(importeMinimo || importeMaximo) && (
                <TouchableOpacity onPress={() => { setImporteMinimo(''); setImporteMaximo(''); }}>
                  <Ionicons name="close-circle" size={18} color={currentTheme.colors.textSecondary} />
                </TouchableOpacity>
              )}
              <Ionicons name="chevron-down" size={20} color={currentTheme.colors.textSecondary} />
            </TouchableOpacity>
            {mostrarFiltroImporte && (
              <View style={[styles.filtroImporteMenu, { backgroundColor: currentTheme.colors.card }]}>
                <View style={styles.filtroImporteRow}>
                  <Text style={[styles.filtroImporteInputLabel, { color: currentTheme.colors.textSecondary }]}>Mínimo:</Text>
                  <TextInput
                    style={[styles.filtroImporteInput, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.background }]}
                    placeholder="0"
                    placeholderTextColor={currentTheme.colors.textSecondary}
                    value={importeMinimo}
                    onChangeText={setImporteMinimo}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.filtroImporteRow}>
                  <Text style={[styles.filtroImporteInputLabel, { color: currentTheme.colors.textSecondary }]}>Máximo:</Text>
                  <TextInput
                    style={[styles.filtroImporteInput, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.background }]}
                    placeholder="Sin límite"
                    placeholderTextColor={currentTheme.colors.textSecondary}
                    value={importeMaximo}
                    onChangeText={setImporteMaximo}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}
          </View>

        {facturasFiltradas.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: currentTheme.colors.card }]}>
            <Ionicons name="document-text-outline" size={60} color={currentTheme.colors.textSecondary} />
            <Text style={[styles.emptyTexto, { color: currentTheme.colors.textSecondary }]}>{t('no_facturas')}</Text>
            <Text style={[styles.emptySub, { color: currentTheme.colors.textSecondary }]}>
              {filtrosSeleccionados.includes('todas') ? t('pulsa_crear') : t('no_facturas')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={facturasFiltradas}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={[styles.facturaCard, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.border }]} onPress={() => abrirDetalle(item)}>
                <View style={[styles.estadoBarra, { backgroundColor: estadoColor(item.estado) }]} />
                <View style={styles.facturaInfo}>
                  <Text style={[styles.facturaNumero, { color: currentTheme.colors.text }]}>{item.numero}</Text>
                  <Text style={[styles.facturaCliente, { color: currentTheme.colors.textSecondary }]}>{item.cliente_nombre}</Text>
                  <Text style={[styles.facturaFecha, { color: currentTheme.colors.textSecondary }]}>{item.fecha ? formatearFechaSync(item.fecha) : ''}</Text>
                </View>
                <View style={styles.facturaRight}>
                  <Text style={[styles.facturaTotal, { color: currentTheme.colors.text }]}>{Number(item.total).toFixed(2)}{simboloMoneda}</Text>
                  <View style={[styles.estadoPill, { backgroundColor: estadoColor(item.estado) + '20' }]}>
                    <Text style={[styles.estadoTexto, { color: estadoColor(item.estado) }]}>{estadoLabel(item.estado)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
      </TouchableWithoutFeedback>

      <TouchableOpacity style={[styles.fab, { backgroundColor: currentTheme.colors.primary, shadowColor: currentTheme.colors.primary }]} onPress={() => router.push("/(tabs)/nueva-factura")}>
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={styles.fabTexto}>{t('nueva_factura')}</Text>
      </TouchableOpacity>

      <Modal visible={mostrarDetalle} animationType="slide" presentationStyle="pageSheet">
        {facturaDetalle && (
          <View style={[styles.detalleWrapper, { backgroundColor: currentTheme.colors.background }]}>
            <View style={[styles.detalleHeader, { backgroundColor: currentTheme.colors.card }]}>
              <TouchableOpacity style={styles.detalleCloseBtn} onPress={() => setMostrarDetalle(false)}>
                <Ionicons name="close" size={22} color={currentTheme.colors.text} />
              </TouchableOpacity>
              <Text style={[styles.detalleTitulo, { color: currentTheme.colors.text }]}>{facturaDetalle.numero}</Text>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleEliminar}>
                <Ionicons name="trash-outline" size={20} color="#FF4757" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.detalleScroll} showsVerticalScrollIndicator={false}>
              <View style={[styles.estadoBannerDetalle, { backgroundColor: estadoColor(facturaDetalle.estado) + '15' }]}>
                <View style={[styles.estadoDot, { backgroundColor: estadoColor(facturaDetalle.estado) }]} />
                <Text style={[styles.estadoBannerTexto, { color: estadoColor(facturaDetalle.estado) }]}>{estadoLabel(facturaDetalle.estado)}</Text>
              </View>
              <View style={[styles.detalleSeccion, { backgroundColor: currentTheme.colors.card }]}>
                <Text style={[styles.detalleSeccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('cliente')}</Text>
                <Text style={[styles.detalleClienteNombre, { color: currentTheme.colors.text }]}>{facturaDetalle.cliente_nombre}</Text>
              </View>
              <View style={styles.detalleFechas}>
                <View style={[styles.detalleFechaBox, { backgroundColor: currentTheme.colors.card }]}>
                  <Text style={[styles.detalleFechaLabel, { color: currentTheme.colors.textSecondary }]}>{t('emision')}</Text>
                  <Text style={[styles.detalleFechaValor, { color: currentTheme.colors.text }]}>{facturaDetalle.fecha ? formatearFechaSync(facturaDetalle.fecha) : ''}</Text>
                </View>
                {facturaDetalle.fecha_vencimiento ? (
                  <View style={[styles.detalleFechaBox, { backgroundColor: currentTheme.colors.card }]}>
                    <Text style={[styles.detalleFechaLabel, { color: currentTheme.colors.textSecondary }]}>{t('vencimiento')}</Text>
                    <Text style={[styles.detalleFechaValor, { color: currentTheme.colors.text }]}>{formatearFechaSync(facturaDetalle.fecha_vencimiento)}</Text>
                  </View>
                ) : null}
              </View>
              <View style={[styles.detalleSeccion, { backgroundColor: currentTheme.colors.card }]}>
                <Text style={[styles.detalleSeccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('articulos')}</Text>
                {itemsDetalle.map((item, i) => (
                  <View key={i} style={styles.detalleItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detalleItemDesc, { color: currentTheme.colors.text }]}>{item.descripcion}</Text>
                      <Text style={[styles.detalleItemSub, { color: currentTheme.colors.textSecondary }]}>
                        {item.cantidad} {item.unidad} × {Number(item.precio_unitario).toFixed(2)}{simboloMoneda}
                        {Number(item.descuento) > 0 ? ` (-${item.descuento}%)` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.detalleItemTotal, { color: currentTheme.colors.text }]}>{Number(item.subtotal).toFixed(2)}{simboloMoneda}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.detalleTotalesBox, { backgroundColor: currentTheme.colors.card }]}>
                <View style={styles.detalleTotalFila}>
                  <Text style={[styles.detalleTotalLabel, { color: currentTheme.colors.textSecondary }]}>{t('subtotal')}</Text>
                  <Text style={[styles.detalleTotalValor, { color: currentTheme.colors.text }]}>{Number(facturaDetalle.subtotal).toFixed(2)} {simboloMoneda}</Text>
                </View>
                <View style={styles.detalleTotalFila}>
                  <Text style={[styles.detalleTotalLabel, { color: currentTheme.colors.textSecondary }]}>{t('iva')} ({facturaDetalle.iva_porcentaje}%)</Text>
                  <Text style={[styles.detalleTotalValor, { color: currentTheme.colors.text }]}>+{Number(facturaDetalle.iva_importe).toFixed(2)} {simboloMoneda}</Text>
                </View>
                {Number(facturaDetalle.irpf_porcentaje) > 0 && (
                  <View style={styles.detalleTotalFila}>
                    <Text style={[styles.detalleTotalLabel, { color: currentTheme.colors.textSecondary }]}>{t('irpf')} ({facturaDetalle.irpf_porcentaje}%)</Text>
                    <Text style={[styles.detalleTotalValor, { color: '#FF4757' }]}>-{Number(facturaDetalle.irpf_importe).toFixed(2)} {simboloMoneda}</Text>
                  </View>
                )}
                <View style={[styles.detalleTotalFila, styles.detalleTotalFilaFinal]}>
                  <Text style={[styles.detalleTotalLabelFinal, { color: currentTheme.colors.primary }]}>{t('total')}</Text>
                  <Text style={[styles.detalleTotalValorFinal, { color: currentTheme.colors.primary }]}>{Number(facturaDetalle.total).toFixed(2)} {simboloMoneda}</Text>
                </View>
              </View>
              {facturaDetalle.metodo_pago && (
                <View style={[styles.detalleSeccion, { backgroundColor: currentTheme.colors.card }]}>
                  <Text style={[styles.detalleSeccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('metodo_pago')}</Text>
                  <Text style={[styles.detalleMetodoPago, { color: currentTheme.colors.text }]}>{facturaDetalle.metodo_pago.charAt(0).toUpperCase() + facturaDetalle.metodo_pago.slice(1)}</Text>
                </View>
              )}
              {facturaDetalle.notas && (
                <View style={[styles.detalleSeccion, { backgroundColor: currentTheme.colors.card }]}>
                  <Text style={[styles.detalleSeccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('notas')}</Text>
                  <Text style={[styles.detalleNotas, { color: currentTheme.colors.textSecondary }]}>{facturaDetalle.notas}</Text>
                </View>
              )}
              <View style={styles.detalleEstadoAcciones}>
                <TouchableOpacity style={[styles.detalleEstadoBtnCompact, { backgroundColor: currentTheme.colors.card, borderColor: facturaDetalle?.estado === 'no_enviada' ? '#FF9F43' : currentTheme.colors.border, borderWidth: 2 }]} onPress={() => handleCambiarEstado('no_enviada')}>
                  <Ionicons name="send-outline" size={16} color={facturaDetalle?.estado === 'no_enviada' ? '#FF9F43' : '#FF9F43'} />
                  <Text style={[styles.detalleEstadoBtnTextoCompact, { color: facturaDetalle?.estado === 'no_enviada' ? '#FF9F43' : currentTheme.colors.text }]}>{t('no_enviada')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detalleEstadoBtnCompact, { backgroundColor: currentTheme.colors.card, borderColor: facturaDetalle?.estado === 'pendiente' ? '#6C47FF' : currentTheme.colors.border, borderWidth: 2 }]} onPress={() => handleCambiarEstado('pendiente')}>
                  <Ionicons name="time-outline" size={16} color={facturaDetalle?.estado === 'pendiente' ? '#6C47FF' : '#6C47FF'} />
                  <Text style={[styles.detalleEstadoBtnTextoCompact, { color: facturaDetalle?.estado === 'pendiente' ? '#6C47FF' : currentTheme.colors.text }]}>{t('por_cobrar')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detalleEstadoBtnCompact, { backgroundColor: currentTheme.colors.card, borderColor: facturaDetalle?.estado === 'pagada' ? '#26de81' : currentTheme.colors.border, borderWidth: 2 }]} onPress={() => handleCambiarEstado('pagada')}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={facturaDetalle?.estado === 'pagada' ? '#26de81' : '#26de81'} />
                  <Text style={[styles.detalleEstadoBtnTextoCompact, { color: facturaDetalle?.estado === 'pagada' ? '#26de81' : currentTheme.colors.text }]}>{t('pagada')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detalleEstadoBtnCompact, { backgroundColor: currentTheme.colors.card, borderColor: facturaDetalle?.estado === 'impagada' ? '#FF4757' : currentTheme.colors.border, borderWidth: 2 }]} onPress={() => handleCambiarEstado('impagada')}>
                  <Ionicons name="alert-circle-outline" size={16} color={facturaDetalle?.estado === 'impagada' ? '#FF4757' : '#FF4757'} />
                  <Text style={[styles.detalleEstadoBtnTextoCompact, { color: facturaDetalle?.estado === 'impagada' ? '#FF4757' : currentTheme.colors.text }]}>{t('impagada')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.detalleAcciones}>
                <TouchableOpacity style={[styles.detalleAccionBtn, { backgroundColor: currentTheme.colors.card }]} onPress={handleExportarPDF} disabled={generandoPDF}>
                  <Ionicons name="document-text-outline" size={20} color={currentTheme.colors.primary} />
                  <Text style={[styles.detalleAccionBtnTexto, { color: currentTheme.colors.primary }]}>{t('exportar_pdf')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detalleAccionBtn, { backgroundColor: currentTheme.colors.card }]} onPress={() => { setMostrarDetalle(false); setTimeout(() => router.push({ pathname: '/(tabs)/nueva-factura', params: { id: facturaDetalle.id.toString() } }), 100); }}>
                  <Ionicons name="create-outline" size={20} color={currentTheme.colors.primary} />
                  <Text style={[styles.detalleAccionBtnTexto, { color: currentTheme.colors.primary }]}>{t('editar')}</Text>
                </TouchableOpacity>
              </View>
              {!isPremium && (
                <TouchableOpacity style={[styles.detallePremiumBanner, { backgroundColor: "#6C47FF" }]} onPress={() => { setMostrarDetalle(false); setTimeout(() => setMostrarPaywall(true), 100); }}>
                  <Ionicons name="diamond-outline" size={20} color="#fff" />
                  <View style={styles.detallePremiumBannerTextoContainer}>
                    <Text style={styles.detallePremiumBannerTitulo}>Desbloquear PDF PRO</Text>
                    <Text style={styles.detallePremiumBannerSub}>Ilimitadas y sin marcas de agua</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#fff" />
                </TouchableOpacity>
              )}
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        )}
      </Modal>

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

      <Modal visible={mostrarDatePicker} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.datePickerWrapper}>
          <View style={styles.datePickerHeader}>
            <TouchableOpacity onPress={() => setMostrarDatePicker(false)}>
              <Ionicons name="close" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.datePickerTitulo}>Seleccionar fecha</Text>
            <TouchableOpacity onPress={() => {
              const fechaFormateada = formatearFechaSync(new Date(añoSeleccionado, mesSeleccionado - 1, diaSeleccionado));
              setBusqueda(fechaFormateada);
              setMostrarDatePicker(false);
            }}>
              <Text style={styles.datePickerConfirmar}>Confirmar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.datePickerContent}>
            <View style={styles.datePickerMonthYear}>
              <TouchableOpacity onPress={() => {
                if (mesSeleccionado === 1) {
                  setMesSeleccionado(12);
                  setAñoSeleccionado(añoSeleccionado - 1);
                } else {
                  setMesSeleccionado(mesSeleccionado - 1);
                }
              }}>
                <Ionicons name="chevron-back" size={24} color="#6C47FF" />
              </TouchableOpacity>
              <Text style={styles.datePickerMonthYearText}>
                {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][mesSeleccionado - 1]} {añoSeleccionado}
              </Text>
              <TouchableOpacity onPress={() => {
                if (mesSeleccionado === 12) {
                  setMesSeleccionado(1);
                  setAñoSeleccionado(añoSeleccionado + 1);
                } else {
                  setMesSeleccionado(mesSeleccionado + 1);
                }
              }}>
                <Ionicons name="chevron-forward" size={24} color="#6C47FF" />
              </TouchableOpacity>
            </View>
            <View style={styles.datePickerDaysHeader}>
              {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map(dia => (
                <Text key={dia} style={styles.datePickerDayName}>{dia}</Text>
              ))}
            </View>
            <View style={styles.datePickerDaysGrid}>
              {generarDiasCalendario()}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F8F7FF" },
  container: { flex: 1, paddingTop: 55, paddingHorizontal: 20 },
  titulo: { fontSize: 26, fontWeight: "800", color: "#1a1a1a", marginBottom: 16 },
  paywallWrapper: { flex: 1, backgroundColor: "#F8F7FF", paddingTop: 20 },
  paywallHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#f0f0f0", backgroundColor: "#fff" },
  paywallTop: { alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  paywallIcono: { width: 60, height: 60, borderRadius: 10, backgroundColor: "#6C47FF", justifyContent: "center", alignItems: "center" },
  paywallTitulo: { fontSize: 24, fontWeight: "800", color: "#1a1a1a", marginTop: 16 },
  paywallSub: { fontSize: 16, color: "#888", marginTop: 4, textAlign: "center" },
  feature: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  featureIcono: { width: 24, height: 24, borderRadius: 5, backgroundColor: "#6C47FF", justifyContent: "center", alignItems: "center", marginRight: 12 },
  featureTexto: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  planesContainer: { padding: 20 },
  planCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  planCardDestacado: { backgroundColor: "#6C47FF", borderColor: "#6C47FF" },
  planBadge: { position: "absolute", top: 16, right: 16, backgroundColor: "#26de81", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  planBadgeTexto: { fontSize: 12, fontWeight: "700", color: "#fff" },
  planNombre: { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },
  planPrecio: { fontSize: 16, fontWeight: "600", color: "#1a1a1a", marginTop: 4 },
  planDesc: { fontSize: 14, color: "#888", marginTop: 8 },
  paywallNoDisponible: { alignItems: "center", justifyContent: "center", padding: 20 },
  paywallNoDisponibleTexto: { fontSize: 14, color: "#888", textAlign: "center" },
  botonDesbloquear: { backgroundColor: "#6C47FF", borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24, alignItems: "center", justifyContent: "center", marginHorizontal: 20, marginTop: 12, shadowColor: "#6C47FF", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12 },
  botonDesbloquearTexto: { fontSize: 17, fontWeight: "800", color: "#fff" },
  restaurarBtn: { backgroundColor: "#fff", borderRadius: 16, paddingVertical: 12, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", marginHorizontal: 20, marginTop: 12, borderColor: "#6C47FF", borderWidth: 1.5 },
  restaurarTexto: { fontSize: 14, fontWeight: "600", color: "#6C47FF" },
  legalTexto: { fontSize: 12, color: "#888", marginTop: 8, textAlign: "center" },
  busquedaContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, borderWidth: 1.5, borderColor: "#e8e8e8" },
  busquedaIcono: { marginRight: 8 },
  busquedaInput: { flex: 1, fontSize: 15, color: "#1a1a1a" },
  fechaBtn: { padding: 6, marginLeft: 8 },
  fechaSeleccionadaContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#6C47FF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  fechaSeleccionadaTexto: { fontSize: 14, fontWeight: "600", color: "#fff" },
  filtroDropdownContainer: { marginBottom: 16, borderRadius: 12, overflow: "hidden" },
  filtroDropdownBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1.5, borderColor: "#e8e8e8" },
  filtroDropdownLabel: { fontSize: 16, fontWeight: "700", color: "#1a1a1a", marginRight: 12 },
  filtroDropdownValue: { flex: 1, fontSize: 15, fontWeight: "600", color: "#6C47FF" },
  filtroDropdownMenu: { backgroundColor: "#fff", borderRadius: 12, marginTop: 8, borderWidth: 1.5, borderColor: "#e8e8e8", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  filtroDropdownItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  filtroDropdownItemActivo: { backgroundColor: "#6C47FF" },
  filtroCheckbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#e8e8e8", backgroundColor: "#fff", marginRight: 12, alignItems: "center", justifyContent: "center" },
  filtroDropdownItemText: { fontSize: 15, fontWeight: "600", color: "#1a1a1a" },
  filtroDropdownItemTextActivo: { color: "#fff" },
  filtroImporteContainer: { marginBottom: 16, borderRadius: 12, overflow: "hidden" },
  filtroImporteBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1.5, borderColor: "#e8e8e8" },
  filtroImporteLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: "#6C47FF", marginLeft: 8 },
  filtroImporteMenu: { backgroundColor: "#fff", marginTop: 8, borderWidth: 1.5, borderColor: "#e8e8e8", padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  filtroImporteRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  filtroImporteInputLabel: { fontSize: 14, fontWeight: "600", width: 70 },
  filtroImporteInput: { flex: 1, fontSize: 15, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: "#e8e8e8", backgroundColor: "#fafafa" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 100 },
  emptyTexto: { fontSize: 18, fontWeight: "600", color: "#aaa", marginTop: 16 },
  emptySub: { fontSize: 14, color: "#ccc", marginTop: 6, textAlign: "center" },
  facturaCard: { backgroundColor: "#fff", borderRadius: 16, marginBottom: 12, flexDirection: "row", overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  estadoBarra: { width: 4 },
  facturaInfo: { flex: 1, padding: 14 },
  facturaNumero: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  facturaCliente: { fontSize: 13, color: "#888", marginTop: 2 },
  facturaFecha: { fontSize: 12, color: "#bbb", marginTop: 4 },
  facturaRight: { padding: 14, alignItems: "flex-end", justifyContent: "space-between" },
  facturaTotal: { fontSize: 16, fontWeight: "800", color: "#1a1a1a" },
  estadoPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: 6 },
  estadoTexto: { fontSize: 12, fontWeight: "600" },
  fab: { position: "absolute", bottom: 30, right: 20, backgroundColor: "#6C47FF", borderRadius: 30, paddingHorizontal: 22, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 8, shadowColor: "#6C47FF", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  fabTexto: { color: "#fff", fontWeight: "700", fontSize: 15 },
  detalleWrapper: { flex: 1, backgroundColor: "#F8F7FF", paddingTop: 20 },
  detalleHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#f0f0f0", backgroundColor: "#fff" },
  detalleCloseBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F8F7FF", justifyContent: "center", alignItems: "center" },
  detalleTitulo: { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#FFF0F0", justifyContent: "center", alignItems: "center" },
  detalleScroll: { flex: 1 },
  estadoBannerDetalle: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 16, marginBottom: 8, padding: 14, borderRadius: 12 },
  estadoDot: { width: 10, height: 10, borderRadius: 5 },
  estadoBannerTexto: { fontSize: 15, fontWeight: "700" },
  detalleSeccion: { backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, marginTop: 12, padding: 18 },
  detalleSeccionTitulo: { fontSize: 13, fontWeight: "700", color: "#888", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 },
  detalleClienteNombre: { fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
  detalleFechas: { flexDirection: "row", gap: 12, marginHorizontal: 16, marginTop: 12 },
  detalleFechaBox: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  detalleFechaLabel: { fontSize: 11, color: "#aaa", fontWeight: "600", textTransform: "uppercase", marginBottom: 4 },
  detalleFechaValor: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  detalleItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  detalleItemDesc: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  detalleItemSub: { fontSize: 12, color: "#888", marginTop: 2 },
  detalleItemTotal: { fontSize: 15, fontWeight: "800", color: "#6C47FF" },
  detalleTotalesBox: { backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, marginTop: 12, padding: 18 },
  detalleTotalFila: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  detalleTotalLabel: { fontSize: 14, color: "#888" },
  detalleTotalValor: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  detalleTotalFilaFinal: { borderTopWidth: 1.5, borderTopColor: "#f0f0f0", paddingTop: 14, marginTop: 4 },
  detalleTotalLabelFinal: { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },
  detalleTotalValorFinal: { fontSize: 22, fontWeight: "900", color: "#6C47FF" },
  detalleMetodoPago: { fontSize: 16, fontWeight: "600", color: "#1a1a1a" },
  detalleNotas: { fontSize: 14, color: "#888", lineHeight: 20 },
  detalleAcciones: { flexDirection: "row", gap: 12, marginHorizontal: 16, marginTop: 16 },
  detalleAccionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12, gap: 8 },
  detalleAccionBtnTexto: { fontSize: 14, fontWeight: "700" },
  detallePremiumBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginHorizontal: 16, marginTop: 12, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  detallePremiumBannerTextoContainer: { flex: 1 },
  detallePremiumBannerTitulo: { color: "#fff", fontWeight: "700", fontSize: 14 },
  detallePremiumBannerSub: { color: "rgba(255,255,255,0.8)", fontSize: 11 },
  detallePremiumBannerTexto: { color: "#fff", fontWeight: "600", fontSize: 13 },
  detalleEstadoAcciones: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginHorizontal: 16, marginTop: 12 },
  detalleEstadoBtnCompact: { width: "48%", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 8, gap: 4 },
  detalleEstadoBtnTextoCompact: { fontSize: 12, fontWeight: "600" },
  detalleEstadoBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12, gap: 8 },
  detalleEstadoBtnTexto: { fontSize: 14, fontWeight: "600" },
  detalleTexto: { fontSize: 14, color: "#555", lineHeight: 22 },
  estadoBtns: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  estadoBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  estadoBtnTexto: { fontSize: 12, fontWeight: "700" },
  accionesBtns: { flexDirection: "row", gap: 12, marginHorizontal: 16, marginTop: 12 },
  accionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#EEE9FF", borderRadius: 14, paddingVertical: 16 },
  accionBtnTexto: { color: "#6C47FF", fontWeight: "700", fontSize: 14 },
  exportarBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#6C47FF", marginHorizontal: 16, marginTop: 12, borderRadius: 16, paddingVertical: 18, shadowColor: "#6C47FF", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12 },
  exportarBtnTexto: { color: "#fff", fontWeight: "800", fontSize: 17 },
  premiumBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#6C47FF", marginHorizontal: 16, marginTop: 12, borderRadius: 12, paddingVertical: 12 },
  premiumBannerTexto: { color: "#fff", fontWeight: "600", fontSize: 13 },
  datePickerWrapper: { flex: 1, backgroundColor: "#F8F7FF", paddingTop: 20 },
  datePickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#f0f0f0", backgroundColor: "#fff" },
  datePickerTitulo: { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },
  datePickerConfirmar: { fontSize: 16, fontWeight: "700", color: "#6C47FF" },
  datePickerContent: { padding: 20 },
  datePickerMonthYear: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  datePickerMonthYearText: { fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
  datePickerDaysHeader: { flexDirection: "row", marginBottom: 10 },
  datePickerDayName: { flex: 1, textAlign: "center", fontSize: 14, fontWeight: "600", color: "#888" },
  datePickerDaysGrid: { flexDirection: "row", flexWrap: "wrap" },
  datePickerDayEmpty: { width: "14.28%", height: 40 },
  datePickerDay: { width: "14.28%", height: 40, justifyContent: "center", alignItems: "center", borderRadius: 8 },
  datePickerDayActivo: { backgroundColor: "#6C47FF" },
  datePickerDayText: { fontSize: 15, fontWeight: "600", color: "#1a1a1a" },
  datePickerDayTextActivo: { color: "#fff" },
});



