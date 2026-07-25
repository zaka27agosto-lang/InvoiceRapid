import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    FlatList,
    Keyboard,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from "react-native";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useModernAlert } from "../../components/ModernAlert";
import { useTheme } from "../../contexts/ThemeContext";
import SwipeNavigation from "../../components/SwipeNavigation";
import { convertirDeEurosParaMostrar } from "../../utils/currency";
import { generarYCompartirPDF, generarPDFPreview, generarYCompartirPDFAlbaran, generarPDFPreviewAlbaran } from "../../utils/pdf";
import Pdf from 'react-native-pdf';
import { FormatoFecha, getFormatoFecha, getMoneda, getPlantillaPDF } from "../../utils/settings";
import { deleteFactura, getFacturaItems, getFacturas, getNextNumeroFactura, insertFactura, insertFacturaItem, updateEstadoFactura } from "../db/facturas";
import { deleteAlbaran, getAlbaranItems, getAlbaranes, getNextNumeroAlbaran, insertAlbaran, insertAlbaranItem, updateEstadoAlbaran } from "../db/albaranes";
import { syncService } from "../../services/syncService";
import { useSync } from "../../hooks/useSync";
import { incrementInvoiceCounter } from "../../utils/subscription";

const ESTADOS_FACTURAS = ['todas', 'no_enviada', 'pendiente', 'pagada', 'impagada'];
const ESTADOS_ALBARANES = ['todas', 'pendiente', 'entregado'];

export default function Documentos() {
  const { t } = useTranslation();
  const { currentTheme } = useTheme();

  const ESTADOS_FACTURAS_LABELS: Record<string, string> = {
    'pendiente': t('por_cobrar'), 'pagada': t('pagada'), 'impagada': t('impagada'),
    'no_enviada': t('no_enviada'), 'todas': t('todas'),
  };
  const ESTADOS_ALBARANES_LABELS: Record<string, string> = {
    'pendiente': t('pendiente'), 'entregado': t('entregado'), 'todas': t('todas'),
  };

  const { filtro: filtroParam, facturaId: facturaIdParam, tipo, filtroMes } = useLocalSearchParams<{ filtro?: string; facturaId?: string; tipo?: string; filtroMes?: string }>();
  const [modo, setModo] = useState<'facturas' | 'albaranes'>('facturas');
  const [facturas, setFacturas] = useState<any[]>([]);
  const [albaranes, setAlbaranes] = useState<any[]>([]);
  const [filtrosSeleccionados, setFiltrosSeleccionados] = useState<string[]>([filtroParam || 'todas']);
  const [busqueda, setBusqueda] = useState('');
  const [facturaDetalle, setFacturaDetalle] = useState<any>(null);
  const [facturaDetalleConvertida, setFacturaDetalleConvertida] = useState<any>(null);
  const [itemsDetalle, setItemsDetalle] = useState<any[]>([]);
  const [itemsDetalleConvertidos, setItemsDetalleConvertidos] = useState<any[]>([]);
  const [albaranDetalle, setAlbaranDetalle] = useState<any>(null);
  const [albaranDetalleConvertida, setAlbaranDetalleConvertida] = useState<any>(null);
  const [itemsAlbaranDetalle, setItemsAlbaranDetalle] = useState<any[]>([]);
  const [itemsAlbaranDetalleConvertidos, setItemsAlbaranDetalleConvertidos] = useState<any[]>([]);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [mostrarDetalleAlbaran, setMostrarDetalleAlbaran] = useState(false);
  const [mostrarPaywall, setMostrarPaywall] = useState(false);
  const [comprando, setComprando] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [generandoPreview, setGenerandoPreview] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [mostrarPreviewPdf, setMostrarPreviewPdf] = useState(false);
  const [mostrarFiltro, setMostrarFiltro] = useState(false);
  const [mostrarDatePicker, setMostrarDatePicker] = useState(false);
  const [mostrarFiltroImporte, setMostrarFiltroImporte] = useState(false);
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [importeMinimo, setImporteMinimo] = useState('');
  const [importeMaximo, setImporteMaximo] = useState('');
  const [fechaDesde, setFechaDesde] = useState<string | null>(null);
  const [fechaHasta, setFechaHasta] = useState<string | null>(null);
  const [modoRangoFecha, setModoRangoFecha] = useState<'ninguno' | 'desde' | 'hasta'>('ninguno');
  const [mostrarFiltroFecha, setMostrarFiltroFecha] = useState(false);
  const [formatoFecha, setFormatoFecha] = useState<FormatoFecha>('DD/MM/YYYY');
  const [simboloMoneda, setSimboloMoneda] = useState('€');
  const [codigoMoneda, setCodigoMoneda] = useState('EUR');
  const hoy = new Date();
  const [diaSeleccionado, setDiaSeleccionado] = useState(hoy.getDate());
  const [mesSeleccionado, setMesSeleccionado] = useState(hoy.getMonth() + 1);
  const [añoSeleccionado, setAñoSeleccionado] = useState(hoy.getFullYear());
  const router = useRouter();
  const { lastSync } = useSync();
  const { isPremium, offerings, comprar, restaurar } = useSubscription();
  const modernAlert = useModernAlert();

  const estadosActuales = modo === 'facturas' ? ESTADOS_FACTURAS : ESTADOS_ALBARANES;
  const formatearFechaSync = (fecha: string | Date) => {
    let date: Date;
    if (typeof fecha === 'string') {
      // Intentar parsear DD/MM/YYYY primero (formato usado en fecha_entrega/vencimiento)
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

  async function handleComprar(pkg: any) {
    setComprando(true);
    const result = await comprar(pkg);
    setComprando(false);
    if (result.success) { setMostrarPaywall(false); modernAlert.showSuccess('✨ ' + t('bienvenida_premium'), t('acceso_premium')); }
    else if (!result.cancelled) { modernAlert.showError(t('error'), result.error || 'Error al procesar la compra'); }
  }

  async function handleRestaurar() {
    const result = await restaurar();
    if (result.isPremium) modernAlert.showSuccess('✅', t('compra_restaurada'));
    else modernAlert.showError(t('info'), t('no_compras_previas'));
  }

  useFocusEffect(useCallback(() => {
    cargarDatos();
    getFormatoFecha().then(setFormatoFecha);
    getMoneda().then(m => {
      setSimboloMoneda(m.simbolo); setCodigoMoneda(m.codigo);
      if (facturaIdParam && !mostrarDetalle && !mostrarDetalleAlbaran) {
        if (tipo === 'albaranes') {
          const albaran = (getAlbaranes()).find((a) => a.id === parseInt(facturaIdParam));
          if (albaran) { abrirDetalleAlbaran(albaran, m.codigo); router.setParams({ facturaId: undefined }); }
        } else if (tipo === 'facturas') {
          const factura = (getFacturas()).find((f) => f.id === parseInt(facturaIdParam));
          if (factura) { abrirDetalleFactura(factura, m.codigo); router.setParams({ facturaId: undefined }); }
        } else if (modo === 'facturas') {
          const factura = (getFacturas()).find((f) => f.id === parseInt(facturaIdParam));
          if (factura) { abrirDetalleFactura(factura, m.codigo); router.setParams({ facturaId: undefined }); }
        } else if (modo === 'albaranes') {
          const albaran = (getAlbaranes()).find((a) => a.id === parseInt(facturaIdParam));
          if (albaran) { abrirDetalleAlbaran(albaran, m.codigo); router.setParams({ facturaId: undefined }); }
        }
      }
    });
    if (!filtroParam) setFiltrosSeleccionados(['todas']);
    else if (filtroParam && estadosActuales.includes(filtroParam)) setFiltrosSeleccionados([filtroParam]);
    else setFiltrosSeleccionados(['todas']);
    // Forzar modo segun el parametro tipo (viene desde inicio)
    if (tipo === 'facturas' && modo !== 'facturas') setModo('facturas');
    else if (tipo === 'albaranes' && modo !== 'albaranes') setModo('albaranes');
    // Limpiar tipo del URL despues de leerlo
    if (tipo) router.setParams({ tipo: undefined });
    // Si viene con filtroMes=actual, filtrar por el mes actual
    if (filtroMes === 'actual') {
      const ahora = new Date();
      const primerDia = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      const ultimoDia = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
      const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      setFechaDesde(fmt(primerDia));
      setFechaHasta(fmt(ultimoDia));
      setFiltrosSeleccionados(['todas']);
      router.setParams({ filtroMes: undefined });
    }
  }, [filtroParam, facturaIdParam, tipo, filtroMes, mostrarDetalle, mostrarDetalleAlbaran, modo]));

  const lastSyncRef = useRef(lastSync);
  useEffect(() => {
    if (lastSync && lastSync !== lastSyncRef.current) { lastSyncRef.current = lastSync; cargarDatos(); }
    else lastSyncRef.current = lastSync;
  }, [lastSync, modo]);

  function cargarDatos() {
    if (modo === 'facturas') setFacturas(getFacturas());
    else setAlbaranes(getAlbaranes());
  }

  function cambiarModo(nuevoModo: 'facturas' | 'albaranes') {
    setModo(nuevoModo);
    setFiltrosSeleccionados(['todas']);
    setBusqueda('');
    setImporteMinimo(''); setImporteMaximo('');
    setFechaDesde(null); setFechaHasta(null);
    setModoRangoFecha('ninguno');
    setMostrarDetalle(false);
    setMostrarDetalleAlbaran(false);
    desactivarModoSeleccion();
  }

  // ──────── FACTURAS ────────
  async function abrirDetalleFactura(factura: any, codigoMonedaParam?: string) {
    const items = getFacturaItems(factura.id);
    setFacturaDetalle(factura); setItemsDetalle(items);
    const codigo = codigoMonedaParam || codigoMoneda;
    const fc = {
      ...factura,
      subtotal: await convertirDeEurosParaMostrar(factura.subtotal || 0, codigo),
      iva_importe: await convertirDeEurosParaMostrar(factura.iva_importe || 0, codigo),
      irpf_importe: await convertirDeEurosParaMostrar(factura.irpf_importe || 0, codigo),
      total: await convertirDeEurosParaMostrar(factura.total || 0, codigo),
    };
    setFacturaDetalleConvertida(fc);
    const ic = await Promise.all(items.map(async (item: any) => ({ ...item,
      precio_unitario: await convertirDeEurosParaMostrar(item.precio_unitario || 0, codigo),
      descuento: await convertirDeEurosParaMostrar(item.descuento || 0, codigo),
      subtotal: await convertirDeEurosParaMostrar(item.subtotal || 0, codigo),
    })));
    setItemsDetalleConvertidos(ic);
    setMostrarDetalle(true);
  }

  async function handleExportarPDFFactura() {
    if (!facturaDetalle) return;
    setGenerandoPDF(true);
    try {
      const plantilla = await getPlantillaPDF();
      const itemsConCalculos = itemsDetalle.map((item: any) => ({
        descripcion: item.descripcion, cantidad: item.cantidad, unidad: item.unidad,
        precio_unitario: item.precio_unitario, descuento: item.descuento, subtotal: item.subtotal,
      }));
      await generarYCompartirPDF(facturaDetalle, itemsConCalculos, isPremium, plantilla, simboloMoneda, currentTheme.colors.primary);
    } catch (e) { modernAlert.showError(t('error'), t('no_se_pudo_generar_pdf')); }
    finally { setGenerandoPDF(false); }
  }

  function handleCambiarEstadoFactura(estado: string) {
    if (!facturaDetalle) return;
    modernAlert.showAlert({
      title: t('cambiar_estado'),
      message: t('confirmar_cambio_estado', { estado: estadoLabelFactura(estado) }),
      buttons: [
      { text: t('cancelar'), style: "cancel" },
      { text: t('confirmar'), onPress: () => { updateEstadoFactura(facturaDetalle.id, estado); setFacturaDetalle({ ...facturaDetalle, estado }); cargarDatos(); } }
    ] });
  }

  function handleDuplicarFactura() {
    if (!facturaDetalle) return;
    const nuevoNumero = getNextNumeroFactura();
    const itemsOriginales = getFacturaItems(facturaDetalle.id);
    const newId = insertFactura({
      numero: nuevoNumero, cliente_id: facturaDetalle.cliente_id, cliente_nombre: facturaDetalle.cliente_nombre,
      subtotal: facturaDetalle.subtotal, descuento: facturaDetalle.descuento, iva_porcentaje: facturaDetalle.iva_porcentaje,
      iva_importe: facturaDetalle.iva_importe, irpf_porcentaje: facturaDetalle.irpf_porcentaje,
      irpf_importe: facturaDetalle.irpf_importe, total: facturaDetalle.total, notas: facturaDetalle.notas,
      metodo_pago: facturaDetalle.metodo_pago, fecha_vencimiento: facturaDetalle.fecha_vencimiento,
    });
    itemsOriginales.forEach((item: any) => insertFacturaItem({
      factura_id: newId as number, descripcion: item.descripcion, cantidad: item.cantidad,
      unidad: item.unidad, precio_unitario: item.precio_unitario, descuento: item.descuento, subtotal: item.subtotal,
    }));
    setMostrarDetalle(false); cargarDatos();
    modernAlert.showSuccess('✅', t('factura_duplicada'));
  }

  function handleEliminarFactura() {
    modernAlert.showAlert({
      title: t('eliminar_factura'),
      message: t('confirmar_eliminar_factura'),
      buttons: [
      { text: t('cancelar'), style: "cancel" },
      { text: t('eliminar'), style: "destructive", onPress: () => {
        deleteFactura(facturaDetalle.id);
        syncService.deleteInvoiceFromCloud(facturaDetalle.id).catch(() => {});
        setMostrarDetalle(false); cargarDatos();
      }}
    ] });
  }

  function estadoLabelFactura(estado: string) { return ESTADOS_FACTURAS_LABELS[estado] || estado; }
  function estadoColorFactura(estado: string) {
    switch (estado) { case 'pagada': return '#26de81'; case 'impagada': return '#FF4757'; case 'no_enviada': return '#FF9F43'; default: return currentTheme.colors.primary; }
  }

  async function handleVistaPreviaFactura() {
    if (!facturaDetalle || !facturaDetalleConvertida) return;
    setGenerandoPreview(true);
    try {
      const plantilla = await getPlantillaPDF();
      const itemsConCalculos = itemsDetalleConvertidos.map((item: any) => ({
        descripcion: item.descripcion, cantidad: item.cantidad, unidad: item.unidad,
        precio_unitario: item.precio_unitario, descuento: item.descuento, subtotal: item.subtotal,
      }));
      const uri = await generarPDFPreview(facturaDetalleConvertida || facturaDetalle, itemsConCalculos, isPremium, plantilla, simboloMoneda, currentTheme.colors.primary);
      if (uri) { setPreviewUri(uri); setMostrarPreviewPdf(true); }
    } catch { modernAlert.showError(t('error'), t('no_se_pudo_generar_pdf')); }
    finally { setGenerandoPreview(false); }
  }

  // ──────── ALBARANES ────────
  async function abrirDetalleAlbaran(albaran: any, codigoMonedaParam?: string) {
    const items = getAlbaranItems(albaran.id);
    setAlbaranDetalle(albaran); setItemsAlbaranDetalle(items);
    const codigo = codigoMonedaParam || codigoMoneda;
    const ac = {
      ...albaran,
      subtotal: await convertirDeEurosParaMostrar(albaran.subtotal || 0, codigo),
      iva_importe: await convertirDeEurosParaMostrar(albaran.iva_importe || 0, codigo),
      irpf_importe: await convertirDeEurosParaMostrar(albaran.irpf_importe || 0, codigo),
      total: await convertirDeEurosParaMostrar(albaran.total || 0, codigo),
    };
    setAlbaranDetalleConvertida(ac);
    const ic = await Promise.all(items.map(async (item: any) => ({ ...item,
      precio_unitario: await convertirDeEurosParaMostrar(item.precio_unitario || 0, codigo),
      descuento: await convertirDeEurosParaMostrar(item.descuento || 0, codigo),
      subtotal: await convertirDeEurosParaMostrar(item.subtotal || 0, codigo),
    })));
    setItemsAlbaranDetalleConvertidos(ic);
    setMostrarDetalleAlbaran(true);
  }

  async function handleExportarPDFAlbaran() {
    if (!albaranDetalle) return;
    setGenerandoPDF(true);
    try {
      const plantilla = await getPlantillaPDF();
      const itemsConCalculos = itemsAlbaranDetalle.map((item: any) => ({
        descripcion: item.descripcion, cantidad: item.cantidad, unidad: item.unidad,
        precio_unitario: item.precio_unitario, descuento: item.descuento, subtotal: item.subtotal,
      }));
      await generarYCompartirPDFAlbaran(albaranDetalle, itemsConCalculos, isPremium, plantilla, simboloMoneda, currentTheme.colors.primary, albaranDetalle.firma_data);
    } catch (e) { modernAlert.showError(t('error'), t('no_se_pudo_generar_pdf')); }
    finally { setGenerandoPDF(false); }
  }

  function handleCambiarEstadoAlbaran(estado: string) {
    if (!albaranDetalle) return;
    modernAlert.showAlert({
      title: t('cambiar_estado'),
      message: t('confirmar_cambio_estado_albaran', { estado: estadoLabelAlbaran(estado) }),
      buttons: [
      { text: t('cancelar'), style: "cancel" },
      { text: t('confirmar'), onPress: () => { updateEstadoAlbaran(albaranDetalle.id, estado); setAlbaranDetalle({ ...albaranDetalle, estado }); cargarDatos(); } }
    ] });
  }

  function handleDuplicarAlbaran() {
    if (!albaranDetalle) return;
    const nuevoNumero = getNextNumeroAlbaran();
    const itemsOriginales = getAlbaranItems(albaranDetalle.id);
    const newId = insertAlbaran({
      numero: nuevoNumero, cliente_id: albaranDetalle.cliente_id, cliente_nombre: albaranDetalle.cliente_nombre,
      subtotal: albaranDetalle.subtotal, descuento: albaranDetalle.descuento, iva_porcentaje: albaranDetalle.iva_porcentaje,
      iva_importe: albaranDetalle.iva_importe, irpf_porcentaje: albaranDetalle.irpf_porcentaje,
      irpf_importe: albaranDetalle.irpf_importe, total: albaranDetalle.total, notas: albaranDetalle.notas,
      fecha_entrega: albaranDetalle.fecha_entrega, firma_data: albaranDetalle.firma_data,
      direccion_entrega: albaranDetalle.direccion_entrega || '',
    });
    itemsOriginales.forEach((item: any) => insertAlbaranItem({
      albaran_id: newId as number, descripcion: item.descripcion, cantidad: item.cantidad,
      unidad: item.unidad, precio_unitario: item.precio_unitario, descuento: item.descuento, subtotal: item.subtotal,
    }));
    setMostrarDetalleAlbaran(false); cargarDatos();
    modernAlert.showSuccess('✅', t('albaran_duplicado'));
  }

  function handleEliminarAlbaran() {
    modernAlert.showAlert({
      title: t('eliminar_albaran'),
      message: t('confirmar_eliminar_albaran'),
      buttons: [
      { text: t('cancelar'), style: "cancel" },
      { text: t('eliminar'), style: "destructive", onPress: () => {
        deleteAlbaran(albaranDetalle.id);
        syncService.deleteAlbaranFromCloud(albaranDetalle.id).catch(() => {});
        setMostrarDetalleAlbaran(false); cargarDatos();
      }}
    ] });
  }

  async function handleConvertirAFactura() {
    if (!albaranDetalle) return;
    const nuevoNumero = getNextNumeroFactura();
    const itemsOriginales = getAlbaranItems(albaranDetalle.id);
    const newId = insertFactura({
      numero: nuevoNumero, cliente_id: albaranDetalle.cliente_id, cliente_nombre: albaranDetalle.cliente_nombre,
      subtotal: albaranDetalle.subtotal, descuento: albaranDetalle.descuento, iva_porcentaje: albaranDetalle.iva_porcentaje,
      iva_importe: albaranDetalle.iva_importe, irpf_porcentaje: albaranDetalle.irpf_porcentaje,
      irpf_importe: albaranDetalle.irpf_importe, total: albaranDetalle.total, notas: albaranDetalle.notas,
      metodo_pago: 'efectivo', fecha_vencimiento: albaranDetalle.fecha_entrega,
    });
    itemsOriginales.forEach((item: any) => insertFacturaItem({
      factura_id: newId as number, descripcion: item.descripcion, cantidad: item.cantidad,
      unidad: item.unidad, precio_unitario: item.precio_unitario, descuento: item.descuento, subtotal: item.subtotal,
    }));
    // Contar como factura del mes (convertir albarán a factura cuenta)
    try {
      if (!isPremium) await incrementInvoiceCounter();
    } catch (e: any) {
      // El documento ya está creado; mostramos error pero seguimos
      modernAlert.showError(t('error'), e?.message || t('error_guardar'));
    }
    setMostrarDetalleAlbaran(false);
    setModo('facturas');
    setFacturas(getFacturas());
    modernAlert.showSuccess('✅', t('albaran_convertido_factura'));
  }

  function estadoLabelAlbaran(estado: string) { return ESTADOS_ALBARANES_LABELS[estado] || estado; }
  function estadoColorAlbaran(estado: string) {
    switch (estado) { case 'entregado': return '#26de81'; default: return currentTheme.colors.primary; }
  }

  async function handleVistaPreviaAlbaran() {
    if (!albaranDetalle || !albaranDetalleConvertida) return;
    setGenerandoPreview(true);
    try {
      const plantilla = await getPlantillaPDF();
      const itemsConCalculos = itemsAlbaranDetalleConvertidos.map((item: any) => ({
        descripcion: item.descripcion, cantidad: item.cantidad, unidad: item.unidad,
        precio_unitario: item.precio_unitario, descuento: item.descuento, subtotal: item.subtotal,
      }));
      const uri2 = await generarPDFPreviewAlbaran(albaranDetalleConvertida || albaranDetalle, itemsConCalculos, isPremium, plantilla, simboloMoneda, currentTheme.colors.primary, albaranDetalle.firma_data);
      if (uri2) { setPreviewUri(uri2); setMostrarPreviewPdf(true); }
    } catch { modernAlert.showError(t('error'), t('no_se_pudo_generar_pdf')); }
    finally { setGenerandoPreview(false); }
  }

  // ──────── COMPARTIDOS ────────
  function toggleSeleccion(id: number) {
    setSeleccionados(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) { nuevo.delete(id); if (nuevo.size === 0) setModoSeleccion(false); }
      else nuevo.add(id);
      return nuevo;
    });
  }
  function activarModoSeleccion() { setModoSeleccion(true); setSeleccionados(new Set()); }
  function desactivarModoSeleccion() { setModoSeleccion(false); setSeleccionados(new Set()); }

  function handleEliminarSeleccionadas() {
    const count = seleccionados.size;
    if (count === 0) return;
    modernAlert.showAlert({
      title: modo === 'facturas' ? t('eliminar_factura') : t('eliminar_albaran'),
      message: modo === 'facturas' ? t('eliminar_varias_confirm', { count }) : t('eliminar_varios_albaranes_confirm', { count }),
      buttons: [
        { text: t('cancelar'), style: "cancel" },
        { text: t('eliminar'), style: "destructive", onPress: () => {
          seleccionados.forEach(id => {
            if (modo === 'facturas') {
              deleteFactura(id); syncService.deleteInvoiceFromCloud(id).catch(() => {});
            } else { deleteAlbaran(id); syncService.deleteAlbaranFromCloud(id).catch(() => {}); }
          });
          desactivarModoSeleccion(); cargarDatos();
        }}
      ]
    });
  }

  // ──────── SYNC STATUS ────────
  function syncStatusIcon(item: any) {
    const isSynced = item.sync_status === 'synced';
    return (
      <Ionicons
        name={isSynced ? 'cloud-done-outline' : 'cloud-upload-outline'}
        size={13}
        color={isSynced ? '#26de81' : '#FF9F43'}
        style={{ marginLeft: 4 }}
      />
    );
  }
  function syncStatusLabel(item: any) {
    return item.sync_status === 'synced' ? t('sync_synced') : t('sync_pending');
  }

  // ──────── FILTRADO ────────
  const datosFiltrados = (() => {
    const datos = modo === 'facturas' ? facturas : albaranes;
    let filtradas = datos;
    if (!filtrosSeleccionados.includes('todas')) {
      filtradas = datos.filter((f: any) => filtrosSeleccionados.includes(f.estado));
    }
    if (busqueda) {
      filtradas = filtradas.filter((f: any) => {
        const fechaFormateada = f.fecha ? formatearFechaSync(f.fecha) : '';
        return f.numero.toLowerCase() === busqueda.toLowerCase() ||
          f.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          fechaFormateada === busqueda;
      });
    }
    if (importeMinimo) { const min = parseFloat(importeMinimo); filtradas = filtradas.filter((f: any) => f.total >= min); }
    if (importeMaximo) { const max = parseFloat(importeMaximo); filtradas = filtradas.filter((f: any) => f.total <= max); }
    if (fechaDesde || fechaHasta) {
      filtradas = filtradas.filter((f: any) => {
        if (!f.fecha) return false;
        const fechaDoc = new Date(f.fecha);
        if (isNaN(fechaDoc.getTime())) return false;
        fechaDoc.setHours(0, 0, 0, 0);
        if (fechaDesde) {
          const [dd, mm, yyyy] = fechaDesde.split('/').map(Number);
          const desde = new Date(yyyy, mm - 1, dd);
          desde.setHours(0, 0, 0, 0);
          if (fechaDoc < desde) return false;
        }
        if (fechaHasta) {
          const [dd, mm, yyyy] = fechaHasta.split('/').map(Number);
          const hasta = new Date(yyyy, mm - 1, dd);
          hasta.setHours(23, 59, 59, 999);
          if (fechaDoc > hasta) return false;
        }
        return true;
      });
    }
    return filtradas;
  })();

  function estadoLabel(estado: string) {
    if (modo === 'facturas') return estadoLabelFactura(estado);
    return estadoLabelAlbaran(estado);
  }
  function estadoColor(estado: string) {
    return modo === 'facturas' ? estadoColorFactura(estado) : estadoColorAlbaran(estado);
  }

  const generarDiasCalendario = () => {
    const firstDay = new Date(añoSeleccionado, mesSeleccionado - 1, 1).getDay();
    const daysInMonth = new Date(añoSeleccionado, mesSeleccionado, 0).getDate();
    const emptyDays = firstDay === 0 ? 6 : firstDay - 1;
    const days = [];
    for (let i = 0; i < emptyDays; i++) days.push(<View key={`empty-${i}`} style={styles.datePickerDayEmpty} />);
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(
        <TouchableOpacity key={i} style={[styles.datePickerDay, diaSeleccionado === i && styles.datePickerDayActivo]} onPress={() => setDiaSeleccionado(i)}>
          <Text style={[styles.datePickerDayText, diaSeleccionado === i && styles.datePickerDayTextActivo]}>{i}</Text>
        </TouchableOpacity>
      );
    }
    return days;
  };

  const tabOrder = ['/(tabs)/index', '/(tabs)/documentos', '/(tabs)/clientes', '/(tabs)/productos', '/(tabs)/informes', '/(tabs)/ajustes'];
  const navigateToNextTab = () => { const idx = tabOrder.indexOf('/(tabs)/documentos'); if (idx < tabOrder.length - 1) router.push(tabOrder[idx + 1] as any); };
  const navigateToPreviousTab = () => { const idx = tabOrder.indexOf('/(tabs)/documentos'); if (idx > 0) router.push(tabOrder[idx - 1] as any); };

  const esFacturas = modo === 'facturas';
  const tituloSeccion = esFacturas ? t('facturas') : t('albaranes');
  const placeholderBusqueda = esFacturas ? t('buscar_factura_placeholder') : t('buscar_albaran_placeholder');
  const emptyIcono = esFacturas ? 'document-text-outline' : 'clipboard-outline';
  const emptyTexto = esFacturas ? t('no_facturas') : t('no_albaranes');
  const emptySub = filtrosSeleccionados.includes('todas') ? (esFacturas ? t('pulsa_crear') : t('pulsa_crear_albaran')) : emptyTexto;
  const btnCrearTexto = esFacturas ? t('nueva_factura') : t('nuevo_albaran');
  const btnCrearRuta = esFacturas ? "/(tabs)/nueva-factura" : ("/(tabs)/nuevo-albaran" as any);
  const btnToggleTexto = esFacturas ? t('albaranes') : t('facturas');
  const eliminarNTexto = esFacturas ? t('eliminar_n_facturas', { count: seleccionados.size }) : t('eliminar_n_albaranes', { count: seleccionados.size });

  return (
    <SwipeNavigation onSwipeLeft={navigateToNextTab} onSwipeRight={navigateToPreviousTab}>
    <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Text style={[styles.titulo, { color: currentTheme.colors.text }]}>{tituloSeccion}</Text>
            <TouchableOpacity
              style={[styles.seleccionarBtn, { borderColor: currentTheme.colors.primary }]}
              onPress={modoSeleccion ? desactivarModoSeleccion : activarModoSeleccion}>
              <Text style={[styles.seleccionarBtnTexto, { color: currentTheme.colors.primary }]}>
                {modoSeleccion ? t('cancelar') : t('seleccionar')}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.busquedaContainer, { backgroundColor: currentTheme.colors.card }]}>
            <Ionicons name="search" size={18} color={currentTheme.colors.textSecondary} style={styles.busquedaIcono} />
            <TextInput style={[styles.busquedaInput, { color: currentTheme.colors.text }]} placeholder={placeholderBusqueda}
              placeholderTextColor={currentTheme.colors.textSecondary} value={busqueda} onChangeText={setBusqueda} />
            {busqueda.length > 0 && (
              <TouchableOpacity onPress={() => setBusqueda('')}>
                <Ionicons name="close-circle" size={18} color={currentTheme.colors.textSecondary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => { setMostrarFiltroFecha(!mostrarFiltroFecha); setMostrarFiltro(false); setMostrarFiltroImporte(false); }} style={styles.fechaBtn}>
              <Ionicons name="calendar-outline" size={18} color={(fechaDesde || fechaHasta) ? '#FF9F43' : currentTheme.colors.primary} />
            </TouchableOpacity>
          </View>
          {/* ── Filtro por fecha ── */}
          {mostrarFiltroFecha && (
            <View style={[styles.filtroFechaPanel, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.border || '#e8e8e8' }]}>
              <Text style={[styles.filtroFechaPanelTitulo, { color: currentTheme.colors.textSecondary }]}>{t('filtro_fecha')}</Text>
              <View style={styles.filtroFechaPresets}>
                {[
                  { key: 'hoy', action: () => { const d = new Date(); const f = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; setFechaDesde(f); setFechaHasta(f); } },
                  { key: 'esta_semana', action: () => { const d = new Date(); const dia = d.getDay() || 7; const lun = new Date(d); lun.setDate(d.getDate() - dia + 1); const dom = new Date(lun); dom.setDate(lun.getDate() + 6); const fmt = (x: Date) => `${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()}`; setFechaDesde(fmt(lun)); setFechaHasta(fmt(dom)); } },
                  { key: 'este_mes', action: () => { const a = new Date(); const p = new Date(a.getFullYear(), a.getMonth(), 1); const u = new Date(a.getFullYear(), a.getMonth()+1, 0); const fmt = (x: Date) => `${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()}`; setFechaDesde(fmt(p)); setFechaHasta(fmt(u)); } },
                  { key: 'mes_pasado', action: () => { const a = new Date(); const p = new Date(a.getFullYear(), a.getMonth()-1, 1); const u = new Date(a.getFullYear(), a.getMonth(), 0); const fmt = (x: Date) => `${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()}`; setFechaDesde(fmt(p)); setFechaHasta(fmt(u)); } },
                ].map(p => (
                  <TouchableOpacity key={p.key} style={[styles.filtroFechaPreset, { borderColor: currentTheme.colors.border || '#e8e8e8' }]} onPress={() => { p.action(); setMostrarFiltroFecha(false); }}>
                    <Text style={[styles.filtroFechaPresetText, { color: currentTheme.colors.text }]}>{t(p.key)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.filtroFechaRango}>
                <TouchableOpacity style={[styles.filtroFechaInput, { borderColor: currentTheme.colors.border || '#e8e8e8' }]} onPress={() => { setModoRangoFecha('desde'); setMostrarDatePicker(true); setMostrarFiltroFecha(false); }}>
                  <Ionicons name="calendar-outline" size={14} color={currentTheme.colors.textSecondary} />
                  <Text style={[styles.filtroFechaInputText, { color: fechaDesde ? currentTheme.colors.text : currentTheme.colors.textSecondary }]}>
                    {fechaDesde || t('desde')}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.filtroFechaSeparador, { color: currentTheme.colors.textSecondary }]}>—</Text>
                <TouchableOpacity style={[styles.filtroFechaInput, { borderColor: currentTheme.colors.border || '#e8e8e8' }]} onPress={() => { setModoRangoFecha('hasta'); setMostrarDatePicker(true); setMostrarFiltroFecha(false); }}>
                  <Ionicons name="calendar-outline" size={14} color={currentTheme.colors.textSecondary} />
                  <Text style={[styles.filtroFechaInputText, { color: fechaHasta ? currentTheme.colors.text : currentTheme.colors.textSecondary }]}>
                    {fechaHasta || t('hasta')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={[styles.filtroDropdownContainer]}>
            <TouchableOpacity style={[styles.filtroDropdownBtn, { backgroundColor: currentTheme.colors.card }]} onPress={() => setMostrarFiltro(!mostrarFiltro)}>
              <Text style={[styles.filtroDropdownLabel, { color: currentTheme.colors.textSecondary }]}>{t('filtro_label')}:</Text>
              <Text style={[styles.filtroDropdownValue, { color: currentTheme.colors.text }]}>
                {filtrosSeleccionados.includes('todas') ? t('todas') : filtrosSeleccionados.map(e => estadoLabel(e)).join(', ')}
              </Text>
              <Ionicons name="chevron-down" size={20} color={currentTheme.colors.textSecondary} />
            </TouchableOpacity>
            {mostrarFiltro && (
              <View style={[styles.filtroDropdownMenu, { backgroundColor: currentTheme.colors.card }]}>
                {estadosActuales.map(e => (
                  <TouchableOpacity key={e}
                    style={[styles.filtroDropdownItem, filtrosSeleccionados.includes(e) && { backgroundColor: currentTheme.colors.primaryLight }]}
                    onPress={() => {
                      if (e === 'todas') { setFiltrosSeleccionados(['todas']); setMostrarFiltro(false); }
                      else {
                        if (filtrosSeleccionados.includes('todas')) setFiltrosSeleccionados([e]);
                        else {
                          setFiltrosSeleccionados(filtrosSeleccionados.includes(e) ? filtrosSeleccionados.filter(f => f !== e) : [...filtrosSeleccionados, e]);
                          if (filtrosSeleccionados.length === 1 && filtrosSeleccionados.includes(e)) setFiltrosSeleccionados(['todas']);
                        }
                      }
                    }}>
                    <Text style={[styles.filtroDropdownItemText, { color: currentTheme.colors.text }, filtrosSeleccionados.includes(e) && { color: currentTheme.colors.primary }]}>{estadoLabel(e)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {(fechaDesde || fechaHasta) && (
            <View style={[styles.filtroFechaChipContainer]}>
              <View style={[styles.filtroFechaChip, { backgroundColor: currentTheme.colors.primary + '15', borderColor: currentTheme.colors.primary }]}>
                <Ionicons name="calendar-outline" size={14} color={currentTheme.colors.primary} />
                <Text style={[styles.filtroFechaChipTexto, { color: currentTheme.colors.primary }]}>
                  {fechaDesde && fechaHasta
                    ? `${fechaDesde} — ${fechaHasta}`
                    : fechaDesde
                      ? `${t('desde')} ${fechaDesde}`
                      : `${t('hasta')} ${fechaHasta}`}
                </Text>
                <TouchableOpacity onPress={() => { setFechaDesde(null); setFechaHasta(null); }}>
                  <Ionicons name="close-circle" size={16} color={currentTheme.colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={[styles.filtroImporteContainer]}>
            <TouchableOpacity style={[styles.filtroImporteBtn, { backgroundColor: currentTheme.colors.card }]} onPress={() => setMostrarFiltroImporte(!mostrarFiltroImporte)}>
              <Ionicons name="cash-outline" size={18} color={currentTheme.colors.primary} />
              <Text style={[styles.filtroImporteLabel, { color: currentTheme.colors.text }]}>
                {importeMinimo || importeMaximo ? t('importe_filtro_rango', { min: importeMinimo || '0', max: importeMaximo || '∞' }) : t('filtrar_por_importe')}
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
                  <TextInput style={[styles.filtroImporteInput, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.background }]}
                    placeholder="0" placeholderTextColor={currentTheme.colors.textSecondary} value={importeMinimo} onChangeText={setImporteMinimo} keyboardType="decimal-pad" />
                </View>
                <View style={styles.filtroImporteRow}>
                  <Text style={[styles.filtroImporteInputLabel, { color: currentTheme.colors.textSecondary }]}>Máximo:</Text>
                  <TextInput style={[styles.filtroImporteInput, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.background }]}
                    placeholder={t('sin_limite')} placeholderTextColor={currentTheme.colors.textSecondary} value={importeMaximo} onChangeText={setImporteMaximo} keyboardType="decimal-pad" />
                </View>
              </View>
            )}
          </View>

        {datosFiltrados.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={[styles.emptyState, { flex: undefined }]}>
              <Ionicons name={emptyIcono as any} size={60} color={currentTheme.colors.textSecondary} />
              <Text style={[styles.emptyTexto, { color: currentTheme.colors.textSecondary }]}>{emptyTexto}</Text>
              <Text style={[styles.emptySub, { color: currentTheme.colors.textSecondary }]}>{emptySub}</Text>
            </View>
          </View>
        ) : (
          <FlatList
            data={datosFiltrados}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.facturaCard, { backgroundColor: currentTheme.colors.card, borderColor: seleccionados.has(item.id) ? currentTheme.colors.primary : currentTheme.colors.border, borderWidth: seleccionados.has(item.id) ? 2 : 1 }]}
                onPress={() => modoSeleccion ? toggleSeleccion(item.id) : (esFacturas ? abrirDetalleFactura(item) : abrirDetalleAlbaran(item))}
                onLongPress={() => { if (!modoSeleccion) { activarModoSeleccion(); toggleSeleccion(item.id); } }}>
                {modoSeleccion && (
                  <View style={[styles.checkboxContainer, { marginRight: 10, justifyContent: 'center' }]}>
                    <View style={[styles.checkbox, seleccionados.has(item.id) && { backgroundColor: currentTheme.colors.primary, borderColor: currentTheme.colors.primary }]}>
                      {seleccionados.has(item.id) && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                  </View>
                )}
                <View style={[styles.estadoBarra, { backgroundColor: estadoColor(item.estado) }]} />
                <View style={styles.facturaInfo}>
                  <Text style={[styles.facturaNumero, { color: currentTheme.colors.text }]}>{item.numero}</Text>
                  <Text style={[styles.facturaCliente, { color: currentTheme.colors.textSecondary }]}>{item.cliente_nombre}</Text>
                  <Text style={[styles.facturaFecha, { color: currentTheme.colors.textSecondary }]}>{item.fecha ? formatearFechaSync(item.fecha) : ''}</Text>
                </View>
                <View style={styles.facturaRight}>
                  <Text style={[styles.facturaTotal, { color: currentTheme.colors.text }]}>{Number(item.total).toFixed(2)}{simboloMoneda}</Text>
                  <View style={styles.estadoPillRow}>
                    <View style={[styles.estadoPill, { backgroundColor: estadoColor(item.estado) + '20' }]}>
                      <Text style={[styles.estadoTexto, { color: estadoColor(item.estado) }]}>{estadoLabel(item.estado)}</Text>
                    </View>
                    {syncStatusIcon(item)}
                  </View>
                </View>
              </TouchableOpacity>
            )}
            ListHeaderComponent={() => <View style={{ paddingVertical: 8 }} />}
            ListFooterComponent={() => <View style={{ paddingVertical: 16 }} />}
          />
        )}
        </View>
      </TouchableWithoutFeedback>

      {!modoSeleccion && (
        <View style={styles.fabContainer}>
          <TouchableOpacity style={[styles.fabToggle, { backgroundColor: '#FF9F43', shadowColor: '#FF9F43' }]} onPress={() => cambiarModo(esFacturas ? 'albaranes' : 'facturas')}>
            <Ionicons name={esFacturas ? 'clipboard-outline' : 'document-text-outline'} size={18} color="#fff" />
            <Text style={styles.fabToggleTexto}>{btnToggleTexto}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.fab, { backgroundColor: currentTheme.colors.primary, shadowColor: currentTheme.colors.primary }]} onPress={() => router.push(btnCrearRuta as any)}>
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={styles.fabTexto}>{btnCrearTexto}</Text>
          </TouchableOpacity>
        </View>
      )}

      {modoSeleccion && seleccionados.size > 0 && (
        <TouchableOpacity style={[styles.fabEliminar, { backgroundColor: '#FF4757', shadowColor: '#FF4757' }]} onPress={handleEliminarSeleccionadas}>
          <Ionicons name="trash-outline" size={22} color="#fff" />
          <Text style={styles.fabTexto}>{eliminarNTexto}</Text>
        </TouchableOpacity>
      )}

      {/* ─── Detalle Factura ─── */}
      <Modal visible={mostrarDetalle} animationType="slide" presentationStyle="pageSheet">
        {facturaDetalle && (
          <View style={[styles.detalleWrapper, { backgroundColor: currentTheme.colors.background }]}>
            <View style={[styles.detalleHeader, { backgroundColor: currentTheme.colors.card }]}>
              <TouchableOpacity style={styles.detalleCloseBtn} onPress={() => setMostrarDetalle(false)}><Ionicons name="close" size={22} color={currentTheme.colors.text} /></TouchableOpacity>
              <Text style={[styles.detalleTitulo, { color: currentTheme.colors.text }]}>{facturaDetalle.numero}</Text>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleEliminarFactura}><Ionicons name="trash-outline" size={20} color="#FF4757" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.detalleScroll} showsVerticalScrollIndicator={false}>
              <View style={[styles.estadoBannerDetalle, { backgroundColor: estadoColorFactura(facturaDetalle.estado) + '15' }]}>
                <View style={[styles.estadoDot, { backgroundColor: estadoColorFactura(facturaDetalle.estado) }]} />
                <Text style={[styles.estadoBannerTexto, { color: estadoColorFactura(facturaDetalle.estado) }]}>{estadoLabelFactura(facturaDetalle.estado)}</Text>
                <View style={{ flex: 1 }} />
                <View style={[styles.syncBadge, { backgroundColor: (facturaDetalle.sync_status === 'synced' ? '#26de81' : '#FF9F43') + '18' }]}>
                  <Ionicons name={facturaDetalle.sync_status === 'synced' ? 'cloud-done-outline' : 'cloud-upload-outline'} size={14} color={facturaDetalle.sync_status === 'synced' ? '#26de81' : '#FF9F43'} />
                  <Text style={[styles.syncBadgeText, { color: facturaDetalle.sync_status === 'synced' ? '#26de81' : '#FF9F43' }]}>{syncStatusLabel(facturaDetalle)}</Text>
                </View>
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
                <View style={[styles.detalleFechaBox, { backgroundColor: currentTheme.colors.card }]}>
                  <Text style={[styles.detalleFechaLabel, { color: currentTheme.colors.textSecondary }]}>{t('vencimiento')}</Text>
                  <Text style={[styles.detalleFechaValor, { color: currentTheme.colors.text }]}>{facturaDetalle.fecha_vencimiento ? formatearFechaSync(facturaDetalle.fecha_vencimiento) : '—'}</Text>
                </View>
              </View>
              <View style={[styles.detalleSeccion, { backgroundColor: currentTheme.colors.card }]}>
                <Text style={[styles.detalleSeccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('articulos')}</Text>
                {itemsDetalleConvertidos.map((item: any, index: number) => (
                  <View key={index} style={styles.detalleItem}>
                    <View style={styles.detalleItemInfo}>
                      <Text style={styles.detalleItemDesc}>{item.descripcion}</Text>
                      <Text style={styles.detalleItemSub}>{item.cantidad} {item.unidad}{Number(item.precio_unitario) > 0 ? ` × ${Number(item.precio_unitario).toFixed(2)}${simboloMoneda}` : ''}{Number(item.descuento) > 0 ? ` (-${item.descuento}%)` : ''}</Text>
                    </View>
                    <Text style={[styles.detalleItemTotal, { color: currentTheme.colors.text }]}>{Number(item.subtotal).toFixed(2)}{simboloMoneda}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.detalleTotalesBox, { backgroundColor: currentTheme.colors.card }]}>
                <View style={styles.detalleTotalFila}><Text style={[styles.detalleTotalLabel, { color: currentTheme.colors.textSecondary }]}>{t('subtotal')}</Text><Text style={[styles.detalleTotalValor, { color: currentTheme.colors.text }]}>{Number(facturaDetalleConvertida?.subtotal || facturaDetalle.subtotal).toFixed(2)} {simboloMoneda}</Text></View>
                <View style={styles.detalleTotalFila}><Text style={[styles.detalleTotalLabel, { color: currentTheme.colors.textSecondary }]}>{t('iva')} ({facturaDetalle.iva_porcentaje}%)</Text><Text style={[styles.detalleTotalValor, { color: currentTheme.colors.text }]}>+{Number(facturaDetalleConvertida?.iva_importe || facturaDetalle.iva_importe).toFixed(2)} {simboloMoneda}</Text></View>
                {Number(facturaDetalle.irpf_porcentaje) > 0 && (
                  <View style={styles.detalleTotalFila}><Text style={[styles.detalleTotalLabel, { color: currentTheme.colors.textSecondary }]}>{t('irpf')} ({facturaDetalle.irpf_porcentaje}%)</Text><Text style={[styles.detalleTotalValor, { color: '#FF4757' }]}>-{Number(facturaDetalleConvertida?.irpf_importe || facturaDetalle.irpf_importe).toFixed(2)} {simboloMoneda}</Text></View>
                )}
                <View style={[styles.detalleTotalFila, styles.detalleTotalFilaFinal]}>
                  <Text style={[styles.detalleTotalLabelFinal, { color: currentTheme.colors.primary }]}>{t('total')}</Text>
                  <Text style={[styles.detalleTotalValorFinal, { color: currentTheme.colors.primary }]}>{Number(facturaDetalleConvertida?.total || facturaDetalle.total).toFixed(2)} {simboloMoneda}</Text>
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
                <TouchableOpacity style={[styles.detalleEstadoBtnCompact, { borderColor: facturaDetalle?.estado === 'no_enviada' ? '#FF9F43' : currentTheme.colors.border, borderWidth: 2 }]} onPress={() => handleCambiarEstadoFactura('no_enviada')}>
                  <Ionicons name="send-outline" size={16} color="#FF9F43" /><Text style={[styles.detalleEstadoBtnTextoCompact, { color: facturaDetalle?.estado === 'no_enviada' ? '#FF9F43' : currentTheme.colors.text }]}>{t('no_enviada')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detalleEstadoBtnCompact, { borderColor: facturaDetalle?.estado === 'pendiente' ? currentTheme.colors.primary : currentTheme.colors.border, borderWidth: 2 }]} onPress={() => handleCambiarEstadoFactura('pendiente')}>
                  <Ionicons name="time-outline" size={16} color={currentTheme.colors.primary} /><Text style={[styles.detalleEstadoBtnTextoCompact, { color: facturaDetalle?.estado === 'pendiente' ? currentTheme.colors.primary : currentTheme.colors.text }]}>{t('por_cobrar')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detalleEstadoBtnCompact, { borderColor: facturaDetalle?.estado === 'pagada' ? '#26de81' : currentTheme.colors.border, borderWidth: 2 }]} onPress={() => handleCambiarEstadoFactura('pagada')}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#26de81" /><Text style={[styles.detalleEstadoBtnTextoCompact, { color: facturaDetalle?.estado === 'pagada' ? '#26de81' : currentTheme.colors.text }]}>{t('pagada')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detalleEstadoBtnCompact, { borderColor: facturaDetalle?.estado === 'impagada' ? '#FF4757' : currentTheme.colors.border, borderWidth: 2 }]} onPress={() => handleCambiarEstadoFactura('impagada')}>
                  <Ionicons name="alert-circle-outline" size={16} color="#FF4757" /><Text style={[styles.detalleEstadoBtnTextoCompact, { color: facturaDetalle?.estado === 'impagada' ? '#FF4757' : currentTheme.colors.text }]}>{t('impagada')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.detalleAcciones}>
                <TouchableOpacity style={[styles.detalleAccionBtn, { backgroundColor: currentTheme.colors.card }]} onPress={handleVistaPreviaFactura} disabled={generandoPreview}>
                  <Ionicons name="eye-outline" size={20} color={currentTheme.colors.primary} /><Text style={[styles.detalleAccionBtnTexto, { color: currentTheme.colors.primary }]}>{generandoPreview ? '...' : t('vista_previa')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detalleAccionBtn, { backgroundColor: currentTheme.colors.card }]} onPress={handleExportarPDFFactura} disabled={generandoPDF}>
                  <Ionicons name="document-text-outline" size={20} color={currentTheme.colors.primary} /><Text style={[styles.detalleAccionBtnTexto, { color: currentTheme.colors.primary }]}>{t('exportar_pdf')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detalleAccionBtn, { backgroundColor: currentTheme.colors.card }]} onPress={() => { setMostrarDetalle(false); setTimeout(() => router.push({ pathname: '/(tabs)/nueva-factura', params: { id: facturaDetalle.id.toString() } }), 100); }}>
                  <Ionicons name="create-outline" size={20} color={currentTheme.colors.primary} /><Text style={[styles.detalleAccionBtnTexto, { color: currentTheme.colors.primary }]}>{t('editar')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detalleAccionBtn, { backgroundColor: currentTheme.colors.card }]} onPress={handleDuplicarFactura}>
                  <Ionicons name="copy-outline" size={20} color={currentTheme.colors.primary} /><Text style={[styles.detalleAccionBtnTexto, { color: currentTheme.colors.primary }]}>{t('duplicar')}</Text>
                </TouchableOpacity>
              </View>
              {!isPremium && (
                <TouchableOpacity style={[styles.detallePremiumBanner, { backgroundColor: currentTheme.colors.primary }]} onPress={() => { setMostrarDetalle(false); setTimeout(() => setMostrarPaywall(true), 100); }}>
                  <Ionicons name="diamond-outline" size={20} color="#fff" />
                  <View style={styles.detallePremiumBannerTextoContainer}><Text style={styles.detallePremiumBannerTitulo}>{t('desbloquear_pdf_pro')}</Text><Text style={styles.detallePremiumBannerSub}>{t('ilimitadas_sin_marca')}</Text></View>
                  <Ionicons name="chevron-forward" size={20} color="#fff" />
                </TouchableOpacity>
              )}
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ─── Detalle Albarán ─── */}
      <Modal visible={mostrarDetalleAlbaran} animationType="slide" presentationStyle="pageSheet">
        {albaranDetalle && (
          <View style={[styles.detalleWrapper, { backgroundColor: currentTheme.colors.background }]}>
            <View style={[styles.detalleHeader, { backgroundColor: currentTheme.colors.card }]}>
              <TouchableOpacity style={styles.detalleCloseBtn} onPress={() => setMostrarDetalleAlbaran(false)}><Ionicons name="close" size={22} color={currentTheme.colors.text} /></TouchableOpacity>
              <Text style={[styles.detalleTitulo, { color: currentTheme.colors.text }]}>{albaranDetalle.numero}</Text>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleEliminarAlbaran}><Ionicons name="trash-outline" size={20} color="#FF4757" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.detalleScroll} showsVerticalScrollIndicator={false}>
              <View style={[styles.estadoBannerDetalle, { backgroundColor: estadoColorAlbaran(albaranDetalle.estado) + '15' }]}>
                <View style={[styles.estadoDot, { backgroundColor: estadoColorAlbaran(albaranDetalle.estado) }]} />
                <Text style={[styles.estadoBannerTexto, { color: estadoColorAlbaran(albaranDetalle.estado) }]}>{estadoLabelAlbaran(albaranDetalle.estado)}</Text>
                <View style={{ flex: 1 }} />
                <View style={[styles.syncBadge, { backgroundColor: (albaranDetalle.sync_status === 'synced' ? '#26de81' : '#FF9F43') + '18' }]}>
                  <Ionicons name={albaranDetalle.sync_status === 'synced' ? 'cloud-done-outline' : 'cloud-upload-outline'} size={14} color={albaranDetalle.sync_status === 'synced' ? '#26de81' : '#FF9F43'} />
                  <Text style={[styles.syncBadgeText, { color: albaranDetalle.sync_status === 'synced' ? '#26de81' : '#FF9F43' }]}>{syncStatusLabel(albaranDetalle)}</Text>
                </View>
              </View>
              <View style={[styles.detalleSeccion, { backgroundColor: currentTheme.colors.card }]}>
                <Text style={[styles.detalleSeccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('cliente')}</Text>
                <Text style={[styles.detalleClienteNombre, { color: currentTheme.colors.text }]}>{albaranDetalle.cliente_nombre}</Text>
              </View>
              <View style={styles.detalleFechas}>
                <View style={[styles.detalleFechaBox, { backgroundColor: currentTheme.colors.card }]}>
                  <Text style={[styles.detalleFechaLabel, { color: currentTheme.colors.textSecondary }]}>{t('emision')}</Text>
                  <Text style={[styles.detalleFechaValor, { color: currentTheme.colors.text }]}>{albaranDetalle.fecha ? formatearFechaSync(albaranDetalle.fecha) : ''}</Text>
                </View>
                <View style={[styles.detalleFechaBox, { backgroundColor: currentTheme.colors.card }]}>
                  <Text style={[styles.detalleFechaLabel, { color: currentTheme.colors.textSecondary }]}>{t('vencimiento')}</Text>
                  <Text style={[styles.detalleFechaValor, { color: currentTheme.colors.text }]}>{albaranDetalle.fecha_entrega ? formatearFechaSync(albaranDetalle.fecha_entrega) : '—'}</Text>
                </View>
              </View>
              <View style={[styles.detalleSeccion, { backgroundColor: currentTheme.colors.card }]}>
                <Text style={[styles.detalleSeccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('articulos')}</Text>
                {itemsAlbaranDetalleConvertidos.map((item: any, index: number) => (
                  <View key={index} style={styles.detalleItem}>
                    <View style={styles.detalleItemInfo}>
                      <Text style={styles.detalleItemDesc}>{item.descripcion}</Text>
                      <Text style={styles.detalleItemSub}>{item.cantidad} {item.unidad}{Number(item.precio_unitario) > 0 ? ` × ${Number(item.precio_unitario).toFixed(2)}${simboloMoneda}` : ''}{Number(item.descuento) > 0 ? ` (-${item.descuento}%)` : ''}</Text>
                    </View>
                    {Number(item.subtotal) > 0 ? (
                      <Text style={[styles.detalleItemTotal, { color: currentTheme.colors.text }]}>{Number(item.subtotal).toFixed(2)}{simboloMoneda}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
          <View style={[styles.detalleTotalesBox, { backgroundColor: currentTheme.colors.card }]}>
            {Number(albaranDetalle.subtotal || 0) > 0 && (
              <View style={styles.detalleTotalFila}><Text style={[styles.detalleTotalLabel, { color: currentTheme.colors.textSecondary }]}>{t('totalArticulos')}</Text><Text style={[styles.detalleTotalValor, { color: currentTheme.colors.text }]}>{Number(albaranDetalleConvertida?.subtotal || albaranDetalle.subtotal).toFixed(2)} {simboloMoneda}</Text></View>
            )}
              </View>
              {albaranDetalle.notas && (
                <View style={[styles.detalleSeccion, { backgroundColor: currentTheme.colors.card }]}>
                  <Text style={[styles.detalleSeccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('notas')}</Text>
                  <Text style={[styles.detalleNotas, { color: currentTheme.colors.textSecondary }]}>{albaranDetalle.notas}</Text>
                </View>
              )}
              <View style={styles.detalleEstadoAcciones}>
                <TouchableOpacity style={[styles.detalleEstadoBtnCompact, { borderColor: albaranDetalle?.estado === 'pendiente' ? currentTheme.colors.primary : currentTheme.colors.border, borderWidth: 2, width: '48%' }]} onPress={() => handleCambiarEstadoAlbaran('pendiente')}>
                  <Ionicons name="time-outline" size={16} color={currentTheme.colors.primary} /><Text style={[styles.detalleEstadoBtnTextoCompact, { color: albaranDetalle?.estado === 'pendiente' ? currentTheme.colors.primary : currentTheme.colors.text }]}>{t('pendiente')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detalleEstadoBtnCompact, { borderColor: albaranDetalle?.estado === 'entregado' ? '#26de81' : currentTheme.colors.border, borderWidth: 2, width: '48%' }]} onPress={() => handleCambiarEstadoAlbaran('entregado')}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#26de81" /><Text style={[styles.detalleEstadoBtnTextoCompact, { color: albaranDetalle?.estado === 'entregado' ? '#26de81' : currentTheme.colors.text }]}>{t('entregado')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.detalleAcciones}>
                <TouchableOpacity style={[styles.detalleAccionBtn, { backgroundColor: currentTheme.colors.card }]} onPress={handleVistaPreviaAlbaran} disabled={generandoPreview}>
                  <Ionicons name="eye-outline" size={20} color={currentTheme.colors.primary} /><Text style={[styles.detalleAccionBtnTexto, { color: currentTheme.colors.primary }]}>{generandoPreview ? '...' : t('vista_previa')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detalleAccionBtn, { backgroundColor: currentTheme.colors.card }]} onPress={handleExportarPDFAlbaran} disabled={generandoPDF}>
                  <Ionicons name="document-text-outline" size={20} color={currentTheme.colors.primary} /><Text style={[styles.detalleAccionBtnTexto, { color: currentTheme.colors.primary }]}>{t('exportar_albaran')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detalleAccionBtn, { backgroundColor: currentTheme.colors.card }]} onPress={() => { setMostrarDetalleAlbaran(false); setTimeout(() => router.push({ pathname: '/(tabs)/nuevo-albaran' as any, params: { id: albaranDetalle.id.toString() } }), 100); }}>
                  <Ionicons name="create-outline" size={20} color={currentTheme.colors.primary} /><Text style={[styles.detalleAccionBtnTexto, { color: currentTheme.colors.primary }]}>{t('editar')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detalleAccionBtn, { backgroundColor: currentTheme.colors.card }]} onPress={handleDuplicarAlbaran}>
                  <Ionicons name="copy-outline" size={20} color={currentTheme.colors.primary} /><Text style={[styles.detalleAccionBtnTexto, { color: currentTheme.colors.primary }]}>{t('duplicar')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detalleAccionBtn, { backgroundColor: '#26de8120' }]} onPress={handleConvertirAFactura}>
                  <Ionicons name="swap-horizontal-outline" size={20} color="#26de81" /><Text style={[styles.detalleAccionBtnTexto, { color: '#26de81' }]}>{t('convertir_a_factura')}</Text>
                </TouchableOpacity>
              </View>
              {!isPremium && (
                <TouchableOpacity style={[styles.detallePremiumBanner, { backgroundColor: currentTheme.colors.primary }]} onPress={() => { setMostrarDetalleAlbaran(false); setTimeout(() => setMostrarPaywall(true), 100); }}>
                  <Ionicons name="diamond-outline" size={20} color="#fff" />
                  <View style={styles.detallePremiumBannerTextoContainer}><Text style={styles.detallePremiumBannerTitulo}>{t('desbloquear_pdf_pro')}</Text><Text style={styles.detallePremiumBannerSub}>{t('ilimitadas_sin_marca')}</Text></View>
                  <Ionicons name="chevron-forward" size={20} color="#fff" />
                </TouchableOpacity>
              )}
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ─── Paywall ─── */}
      <Modal visible={mostrarPaywall} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.paywallWrapper}>
          <View style={styles.paywallHeader}><TouchableOpacity onPress={() => setMostrarPaywall(false)}><Ionicons name="close" size={26} color="#1a1a1a" /></TouchableOpacity></View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.paywallTop}>
              <View style={styles.paywallIcono}><Ionicons name="rocket" size={36} color={currentTheme.colors.primary} /></View>
              <Text style={styles.paywallTitulo}>{t('premium_titulo')}</Text><Text style={styles.paywallSub}>{t('premium_sub')}</Text>
            </View>
            {[{ icon: 'infinite-outline', texto: t('facturas_ilimitadas') },{ icon: 'document-text-outline', texto: t('pdf_sin_marca') },{ icon: 'image-outline', texto: t('logo_personalizado') },{ icon: 'color-palette-outline', texto: t('plantillas_premium') },{ icon: 'ban-outline', texto: t('sin_anuncios') }].map((f, i) => (
              <View key={i} style={styles.feature}><View style={styles.featureIcono}><Ionicons name={f.icon as any} size={20} color={currentTheme.colors.primary} /></View><Text style={styles.featureTexto}>{f.texto}</Text><Ionicons name="checkmark" size={18} color="#26de81" /></View>
            ))}
            <View style={styles.planesContainer}>
              {offerings?.availablePackages?.map((pkg: any, i: number) => {
                const isAnual = pkg.packageType === 'ANNUAL';
                return (<TouchableOpacity key={i} style={[styles.planCard, isAnual && [styles.planCardDestacado, { borderColor: currentTheme.colors.primary, backgroundColor: currentTheme.colors.primary + '15' }]]} onPress={() => handleComprar(pkg)} disabled={comprando}>
                  {isAnual && <View style={[styles.planBadge, { backgroundColor: currentTheme.colors.primary }]}><Text style={styles.planBadgeTexto}>{t('recomendado')}</Text></View>}
                  <Text style={styles.planNombre}>{pkg.product.title}</Text><Text style={[styles.planPrecio, { color: currentTheme.colors.primary }]}>{pkg.product.priceString}</Text><Text style={styles.planDesc}>{pkg.product.description}</Text>
                </TouchableOpacity>);
              })}
            </View>
            <TouchableOpacity style={styles.botonDesbloquear} onPress={() => offerings?.availablePackages?.[0] && handleComprar(offerings.availablePackages[0])}><Text style={styles.botonDesbloquearTexto}>{t('desbloquear')}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.restaurarBtn} onPress={handleRestaurar}><Text style={styles.restaurarTexto}>{t('restaurar')}</Text></TouchableOpacity>
            <Text style={styles.legalTexto}>{t('cancelar_anytime')}</Text>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ─── Vista previa ─── */}
      <Modal visible={mostrarPreviewPdf} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMostrarPreviewPdf(false)}>
        <View style={[styles.previewWrapper, { backgroundColor: currentTheme.colors.background }]}>
          <View style={[styles.previewHeader, { backgroundColor: currentTheme.colors.card, borderBottomColor: currentTheme.colors.border }]}>
            <TouchableOpacity style={styles.previewCloseBtn} onPress={() => { setMostrarPreviewPdf(false); setPreviewUri(null); }}><Ionicons name="close" size={22} color={currentTheme.colors.text} /></TouchableOpacity>
            <Text style={[styles.previewTitle, { color: currentTheme.colors.text }]}>{t('numeracion_vista_previa')}</Text>
            <View style={{ width: 36 }} />
          </View>
          {previewUri ? (<Pdf source={{ uri: previewUri }} style={{ flex: 1 }} />) : (<View style={styles.previewLoading}><Text style={{ color: currentTheme.colors.textSecondary }}>{t('cargando')}...</Text></View>)}
        </View>
      </Modal>

      {/* ─── Date picker ─── */}
      <Modal visible={mostrarDatePicker} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.datePickerWrapper}>
          <View style={styles.datePickerHeader}>
            <TouchableOpacity onPress={() => { setMostrarDatePicker(false); setModoRangoFecha('ninguno'); }}><Ionicons name="close" size={24} color="#1a1a1a" /></TouchableOpacity>
            <Text style={styles.datePickerTitulo}>
              {modoRangoFecha === 'desde' ? t('desde') : modoRangoFecha === 'hasta' ? t('hasta') : t('seleccionar_fecha')}
            </Text>
            <TouchableOpacity onPress={() => {
              const fechaSel = `${String(diaSeleccionado).padStart(2,'0')}/${String(mesSeleccionado).padStart(2,'0')}/${añoSeleccionado}`;
              if (modoRangoFecha === 'desde') setFechaDesde(fechaSel);
              else if (modoRangoFecha === 'hasta') setFechaHasta(fechaSel);
              else setBusqueda(formatearFechaSync(new Date(añoSeleccionado, mesSeleccionado - 1, diaSeleccionado)));
              setMostrarDatePicker(false);
              setModoRangoFecha('ninguno');
            }}><Text style={styles.datePickerConfirmar}>Confirmar</Text></TouchableOpacity>
          </View>
          <View style={styles.datePickerContent}>
            <View style={styles.datePickerMonthYear}>
              <TouchableOpacity onPress={() => { if (mesSeleccionado === 1) { setMesSeleccionado(12); setAñoSeleccionado(añoSeleccionado - 1); } else setMesSeleccionado(mesSeleccionado - 1); }}><Ionicons name="chevron-back" size={24} color={currentTheme.colors.primary} /></TouchableOpacity>
              <Text style={styles.datePickerMonthYearText}>{['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][mesSeleccionado-1]} {añoSeleccionado}</Text>
              <TouchableOpacity onPress={() => { if (mesSeleccionado === 12) { setMesSeleccionado(1); setAñoSeleccionado(añoSeleccionado + 1); } else setMesSeleccionado(mesSeleccionado + 1); }}><Ionicons name="chevron-forward" size={24} color={currentTheme.colors.primary} /></TouchableOpacity>
            </View>
            <View style={styles.datePickerDaysHeader}>{['D','L','M','X','J','V','S'].map(d => <Text key={d} style={styles.datePickerDayName}>{d}</Text>)}</View>
            <View style={styles.datePickerDaysGrid}>{generarDiasCalendario()}</View>
          </View>
        </View>
      </Modal>
    </View>
    </SwipeNavigation>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 }, container: { flex: 1, paddingTop: 55, paddingHorizontal: 20 }, titulo: { fontSize: 26, fontWeight: "800" },
  paywallWrapper: { flex: 1, backgroundColor: "#F8F7FF", paddingTop: 20 },
  paywallHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#f0f0f0", backgroundColor: "#fff" },
  paywallTop: { alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  paywallIcono: { width: 60, height: 60, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  paywallTitulo: { fontSize: 24, fontWeight: "800", color: "#1a1a1a", marginTop: 16 },
  paywallSub: { fontSize: 16, color: "#888", marginTop: 4, textAlign: "center" },
  feature: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  featureIcono: { width: 24, height: 24, borderRadius: 5, justifyContent: "center", alignItems: "center", marginRight: 12 },
  featureTexto: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  planesContainer: { padding: 20 },
  planCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  planCardDestacado: { borderColor: "#007AFF" },
  planBadge: { position: "absolute", top: 16, right: 16, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  planBadgeTexto: { fontSize: 12, fontWeight: "700", color: "#fff" },
  planNombre: { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },
  planPrecio: { fontSize: 16, fontWeight: "600", color: "#1a1a1a", marginTop: 4 },
  planDesc: { fontSize: 14, color: "#888", marginTop: 8 },
  botonDesbloquear: { borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24, alignItems: "center", justifyContent: "center", marginHorizontal: 20, marginTop: 12, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12 },
  botonDesbloquearTexto: { fontSize: 17, fontWeight: "800", color: "#fff" },
  restaurarBtn: { backgroundColor: "#fff", borderRadius: 16, paddingVertical: 12, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", marginHorizontal: 20, marginTop: 12, borderWidth: 1.5 },
  restaurarTexto: { fontSize: 14, fontWeight: "600" }, legalTexto: { fontSize: 12, color: "#888", marginTop: 8, textAlign: "center" },
  busquedaContainer: { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, borderWidth: 1.5, borderColor: "#e8e8e8" },
  busquedaIcono: { marginRight: 8 }, busquedaInput: { flex: 1, fontSize: 15 }, fechaBtn: { padding: 6, marginLeft: 8 },
  filtroDropdownContainer: { marginBottom: 16, borderRadius: 12, overflow: "hidden" },
  filtroDropdownBtn: { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1.5, borderColor: "#e8e8e8" },
  filtroDropdownLabel: { fontSize: 16, fontWeight: "700", marginRight: 12 },
  filtroDropdownValue: { flex: 1, fontSize: 15, fontWeight: "600" },
  filtroDropdownMenu: { borderRadius: 12, marginTop: 8, borderWidth: 1.5, borderColor: "#e8e8e8", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  filtroDropdownItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  filtroDropdownItemText: { fontSize: 15, fontWeight: "600" },
  filtroImporteContainer: { marginBottom: 16, borderRadius: 12, overflow: "hidden" },
  filtroImporteBtn: { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1.5, borderColor: "#e8e8e8" },
  filtroImporteLabel: { flex: 1, fontSize: 15, fontWeight: "600", marginLeft: 8 },
  filtroFechaChipContainer: { marginBottom: 12 },
  filtroFechaChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, alignSelf: 'flex-start' },
  filtroFechaChipTexto: { fontSize: 13, fontWeight: '600' },
  filtroFechaPanel: { borderRadius: 12, borderWidth: 1.5, padding: 14, marginBottom: 14 },
  filtroFechaPanelTitulo: { fontSize: 12, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  filtroFechaPresets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  filtroFechaPreset: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  filtroFechaPresetText: { fontSize: 12, fontWeight: '600' },
  filtroFechaRango: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filtroFechaInput: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  filtroFechaInputText: { fontSize: 13, fontWeight: '500' },
  filtroFechaSeparador: { fontSize: 13, fontWeight: '600' },
  filtroImporteMenu: { marginTop: 8, borderWidth: 1.5, borderColor: "#e8e8e8", padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  filtroImporteRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  filtroImporteInputLabel: { fontSize: 14, fontWeight: "600", width: 70 },
  filtroImporteInput: { flex: 1, fontSize: 15, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: "#e8e8e8" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 100 },
  emptyTexto: { fontSize: 18, fontWeight: "600", marginTop: 16 },
  emptySub: { fontSize: 14, marginTop: 6, textAlign: "center" },
  facturaCard: { borderRadius: 16, marginBottom: 12, flexDirection: "row", overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  estadoBarra: { width: 4 }, facturaInfo: { flex: 1, padding: 14 },
  facturaNumero: { fontSize: 15, fontWeight: "700" }, facturaCliente: { fontSize: 13, marginTop: 2 }, facturaFecha: { fontSize: 12, marginTop: 4 },
  facturaRight: { padding: 14, alignItems: "flex-end", justifyContent: "space-between" },
  facturaTotal: { fontSize: 16, fontWeight: "800" },
  estadoPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: 6 }, estadoTexto: { fontSize: 12, fontWeight: "600" },
  estadoPillRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  syncBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  syncBadgeText: { fontSize: 11, fontWeight: '600' },
  fab: { borderRadius: 30, paddingHorizontal: 22, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 8, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  fabTexto: { color: "#fff", fontWeight: "700", fontSize: 15 },
  fabContainer: { position: "absolute", bottom: 24, left: 20, right: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fabToggle: { borderRadius: 30, paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 6, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  fabToggleTexto: { color: "#fff", fontWeight: "700", fontSize: 14 },
  detalleWrapper: { flex: 1, paddingTop: 20 },
  detalleHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  detalleCloseBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  detalleTitulo: { fontSize: 18, fontWeight: "800" },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#FFF0F0", justifyContent: "center", alignItems: "center" },
  detalleScroll: { flex: 1 },
  estadoBannerDetalle: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 16, marginBottom: 8, padding: 14, borderRadius: 12 },
  estadoDot: { width: 10, height: 10, borderRadius: 5 }, estadoBannerTexto: { fontSize: 15, fontWeight: "700" },
  detalleSeccion: { borderRadius: 16, marginHorizontal: 16, marginTop: 12, padding: 18 },
  detalleSeccionTitulo: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 },
  detalleClienteNombre: { fontSize: 18, fontWeight: "700" },
  detalleFechas: { flexDirection: "row", gap: 12, marginHorizontal: 16, marginTop: 12 },
  detalleFechaBox: { flex: 1, borderRadius: 12, padding: 14 },
  detalleFechaLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", marginBottom: 4 },
  detalleFechaValor: { fontSize: 14, fontWeight: "700" },
  detalleItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  detalleItemInfo: { flex: 1 }, detalleItemDesc: { fontSize: 14, fontWeight: "600" },
  detalleItemSub: { fontSize: 12, marginTop: 2 }, detalleItemTotal: { fontSize: 15, fontWeight: "800" },
  detalleTotalesBox: { borderRadius: 16, marginHorizontal: 16, marginTop: 12, padding: 18 },
  detalleTotalFila: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  detalleTotalLabel: { fontSize: 14 }, detalleTotalValor: { fontSize: 14, fontWeight: "600" },
  detalleTotalFilaFinal: { borderTopWidth: 1.5, borderTopColor: "#f0f0f0", paddingTop: 14, marginTop: 4 },
  detalleTotalLabelFinal: { fontSize: 18, fontWeight: "800" }, detalleTotalValorFinal: { fontSize: 22, fontWeight: "900" },
  detalleMetodoPago: { fontSize: 16, fontWeight: "600" }, detalleNotas: { fontSize: 14, lineHeight: 20 },
  detalleAcciones: { marginHorizontal: 16, marginTop: 16, gap: 10 },
  detalleAccionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12, gap: 8 },
  detalleAccionBtnTexto: { fontSize: 14, fontWeight: "700" },
  detallePremiumBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginHorizontal: 16, marginTop: 12, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  detallePremiumBannerTextoContainer: { flex: 1 }, detallePremiumBannerTitulo: { color: "#fff", fontWeight: "700", fontSize: 14 }, detallePremiumBannerSub: { color: "rgba(255,255,255,0.8)", fontSize: 11 },
  detalleEstadoAcciones: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginHorizontal: 16, marginTop: 12 },
  detalleEstadoBtnCompact: { backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 8, gap: 4 },
  detalleEstadoBtnTextoCompact: { fontSize: 12, fontWeight: "600" },
  datePickerWrapper: { flex: 1, backgroundColor: "#F8F7FF", paddingTop: 20 },
  datePickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#f0f0f0", backgroundColor: "#fff" },
  datePickerTitulo: { fontSize: 18, fontWeight: "800" }, datePickerConfirmar: { fontSize: 16, fontWeight: "700" },
  datePickerContent: { padding: 20 },
  datePickerMonthYear: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  datePickerMonthYearText: { fontSize: 18, fontWeight: "700" },
  datePickerDaysHeader: { flexDirection: "row", marginBottom: 10 },
  datePickerDayName: { flex: 1, textAlign: "center", fontSize: 14, fontWeight: "600", color: "#888" },
  datePickerDaysGrid: { flexDirection: "row", flexWrap: "wrap" },
  datePickerDayEmpty: { width: "14.28%", height: 40 },
  datePickerDay: { width: "14.28%", height: 40, justifyContent: "center", alignItems: "center", borderRadius: 8 },
  datePickerDayActivo: { backgroundColor: "#007AFF" },
  datePickerDayText: { fontSize: 15, fontWeight: "600", color: "#1a1a1a" }, datePickerDayTextActivo: { color: "#fff" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  seleccionarBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  seleccionarBtnTexto: { fontSize: 14, fontWeight: "700" },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: "#ccc", justifyContent: "center", alignItems: "center" },
  checkboxContainer: { justifyContent: "center", alignItems: "center", paddingLeft: 8, alignSelf: "center" },
  fabEliminar: { position: "absolute", bottom: 24, right: 20, borderRadius: 30, paddingHorizontal: 22, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 8, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  previewWrapper: { flex: 1, paddingTop: 20 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  previewCloseBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  previewTitle: { fontSize: 18, fontWeight: '800' },
  previewLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
