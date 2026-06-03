import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useTheme } from "../../contexts/ThemeContext";
import { adsService } from "../../services/adsService";
import { convertirAEurosParaGuardar } from "../../utils/currency";
import { generarYCompartirPDFAlbaran, generarPDFPreviewAlbaran, fileToPreviewHtml } from "../../utils/pdf";
import { WebView } from 'react-native-webview';
import { SignaturePad } from "../../components/SignaturePad";
import { getMoneda, getNumeracionConfig, getPlantillaPDF } from "../../utils/settings";
import { checkInvoiceLimitAsync, incrementInvoiceCounter, getRemainingRewardedAds, incrementRewardedAdCount } from "../../utils/subscription";
import { getClientes } from "../db/clientes";
import { deleteAlbaranItems, getAlbaran, getAlbaranItems, getNextNumeroAlbaran, insertAlbaran, insertAlbaranItem, updateAlbaran } from "../db/albaranes";
import { getProductos } from "../db/productos";

type Item = {
  id: string;
  descripcion: string;
  cantidad: string;
  unidad: string;
  precio: string;
  descuento: string;
  sinPrecio: boolean;
};

const UNIDADES = ["ud", "kg", "g", "l", "ml", "m", "m²", "h", "día", "mes"];

export default function NuevoAlbaran() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id: albaranId } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const { isPremium, offerings, comprar, restaurar } = useSubscription();
  const { currentTheme } = useTheme();
  const esModoEdicion = !!albaranId;

  const [mostrarPaywall, setMostrarPaywall] = useState(false);
  const [pendingRewardedSave, setPendingRewardedSave] = useState(false);
  const [comprando, setComprando] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [generandoPreview, setGenerandoPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [mostrarPreviewPdf, setMostrarPreviewPdf] = useState(false);
  const [planSeleccionado, setPlanSeleccionado] = useState<any>(null);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [mostrarClientes, setMostrarClientes] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [items, setItems] = useState<Item[]>([nuevoItem()]);
  const [mostrarUnidades, setMostrarUnidades] = useState<string | null>(null);
  const [mostrarProductos, setMostrarProductos] = useState(false);
  const [productos, setProductos] = useState<any[]>([]);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [itemSeleccionadoParaProducto, setItemSeleccionadoParaProducto] = useState<string | null>(null);
  const [notas, setNotas] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [direccionEntrega, setDireccionEntrega] = useState("");
  const [firmaData, setFirmaData] = useState<string | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [simboloMoneda, setSimboloMoneda] = useState("€");
  const [codigoMoneda, setCodigoMoneda] = useState("EUR");
  const [limiteInfo, setLimiteInfo] = useState<{ canCreate: boolean; currentCount: number; limit: number }>({ canCreate: true, currentCount: 0, limit: 10 });
  const [numeroAlbaran, setNumeroAlbaran] = useState("");
  const [numeracionConfig, setNumeracionConfigState] = useState<{ prefijo: string; sufijo: string; digitos: number }>({ prefijo: 'A-', sufijo: '', digitos: 4 });
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    getMoneda().then(m => {
      setSimboloMoneda(m.simbolo);
      setCodigoMoneda(m.codigo);
    });
    checkInvoiceLimitAsync().then(setLimiteInfo);
    getNumeracionConfig().then(cfg => {
      // Para albaranes usamos prefijo 'A-' por defecto
      setNumeracionConfigState({ prefijo: 'A-', sufijo: cfg.sufijo, digitos: cfg.digitos });
    });
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (mostrarClientes || mostrarProductos || mostrarUnidades || mostrarPaywall) return;
      if (!hayCambiosSinGuardar()) return;
      e.preventDefault();
      Alert.alert(
        '',
        t('confirmar_salir_factura_cambios'),
        [
          { text: t('cancelar'), style: 'cancel' },
          { text: t('salir'), onPress: () => navigation.dispatch(e.data.action) }
        ]
      );
    });
    return unsubscribe;
  }, [navigation, t, mostrarClientes, mostrarProductos, mostrarUnidades, mostrarPaywall, clienteSeleccionado, items, notas, firmaData, fechaEntrega]);

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      checkInvoiceLimitAsync().then(setLimiteInfo);
      getMoneda().then(m => {
        setSimboloMoneda(m.simbolo);
        setCodigoMoneda(m.codigo);
      });
      getNumeracionConfig().then(cfg => {
        setNumeracionConfigState({ prefijo: 'A-', sufijo: cfg.sufijo, digitos: cfg.digitos });
        if (albaranId) {
          cargarAlbaran(parseInt(albaranId));
        } else {
          setNumeroAlbaran(getNextNumeroAlbaran({ prefijo: 'A-', sufijo: cfg.sufijo, digitos: cfg.digitos }));
          reiniciarFormulario();
        }
      });
    }, [albaranId])
  );

  function nuevoItem(): Item {
    return { id: Math.random().toString(), descripcion: "", cantidad: "1", unidad: "ud", precio: "", descuento: "0", sinPrecio: false };
  }

  function actualizarItem(id: string, campo: keyof Item, valor: string) {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, [campo]: valor } : item)));
  }

  function toggleSinPrecio(id: string) {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, sinPrecio: !item.sinPrecio, precio: '', descuento: '0' } : item)));
  }

  function eliminarItem(id: string) {
    if (items.length === 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  }

  function calcularSubtotalItem(item: Item) {
    const cant = parseFloat(item.cantidad) || 0;
    const precio = parseFloat(item.precio) || 0;
    const desc = parseFloat(item.descuento) || 0;
    return Math.max(0, (cant * precio) * (1 - desc / 100));
  }

  const subtotalBruto = items.reduce((acc, item) => acc + (item.sinPrecio ? 0 : calcularSubtotalItem(item)), 0);

  function abrirSelectorClientes() {
    setClientes(getClientes() as any[]);
    setBusquedaCliente("");
    setMostrarClientes(true);
  }

  function abrirSelectorProductos(itemId: string) {
    setProductos(getProductos() as any[]);
    setBusquedaProducto("");
    setItemSeleccionadoParaProducto(itemId);
    setMostrarProductos(true);
  }

  function seleccionarProducto(producto: any) {
    if (itemSeleccionadoParaProducto) {
      actualizarItem(itemSeleccionadoParaProducto, "descripcion", producto.descripcion);
      actualizarItem(itemSeleccionadoParaProducto, "precio", producto.precio.toString());
      actualizarItem(itemSeleccionadoParaProducto, "unidad", producto.unidad);
    }
    setMostrarProductos(false);
    setItemSeleccionadoParaProducto(null);
  }

  function reiniciarFormulario() {
    setClienteSeleccionado(null);
    setItems([nuevoItem()]);
    setNotas("");
    setFechaEntrega("");
    setDireccionEntrega("");
    setFirmaData(null);
    setNumeroAlbaran(getNextNumeroAlbaran(numeracionConfig));
  }

  function cargarAlbaran(id: number) {
    const albaran = getAlbaran(id) as any;
    if (!albaran) {
      Alert.alert(t('error'), t('albaran_no_encontrado'));
      router.back();
      return;
    }
    const albaranItems = getAlbaranItems(id) as any[];
    setNumeroAlbaran(albaran.numero);
    setClienteSeleccionado({ id: albaran.cliente_id, nombre: albaran.cliente_nombre });
    setNotas(albaran.notas || "");
    setFechaEntrega(albaran.fecha_entrega || "");
    setDireccionEntrega(albaran.direccion_entrega || "");
    setFirmaData(albaran.firma_data || null);

    const itemsCargados: Item[] = albaranItems.map((item: any) => ({
      id: Math.random().toString(),
      descripcion: item.descripcion,
      cantidad: item.cantidad.toString(),
      unidad: item.unidad,
      precio: (item.precio_unitario || 0) > 0 ? item.precio_unitario.toString() : "",
      descuento: (item.descuento || 0) > 0 ? item.descuento.toString() : "0",
      sinPrecio: !item.precio_unitario || item.precio_unitario === 0,
    }));
    setItems(itemsCargados.length > 0 ? itemsCargados : [nuevoItem()]);
  }



  async function handleComprar(pkg: any) {
    setComprando(true);
    const result = await comprar(pkg);
    setComprando(false);
    if (result.success) {
      setMostrarPaywall(false);
      Alert.alert('✨ ' + t('bienvenida_premium'), t('acceso_premium'));
    } else if (!result.cancelled) {
      Alert.alert(t('error'), result.error || t('error_procesar_compra'));
    }
  }

  async function handleRestaurar() {
    const result = await restaurar();
    if (result.isPremium) Alert.alert('✅', t('compra_restaurada'));
    else Alert.alert(t('info'), t('no_compras_previas'));
  }

  async function handleVistaPrevia() {
    if (!clienteSeleccionado) { Alert.alert(t('cliente_requerido'), t('selecciona_cliente')); return; }
    const itemsValidos = items.filter(i => i.descripcion.trim());
    if (itemsValidos.length === 0) { Alert.alert(t('sin_articulos'), t('anadirArticuloValidoAlbaran')); return; }

    setGenerandoPreview(true);
    try {
      const albaranPreview = {
        id: 0, numero: numeroAlbaran || 'PREVIEW', cliente_id: clienteSeleccionado?.id || 0,
        cliente_nombre: clienteSeleccionado?.nombre || '', subtotal: subtotalBruto, descuento: 0,
        iva_porcentaje: 0, iva_importe: 0, irpf_porcentaje: 0,
        irpf_importe: 0, total: subtotalBruto, notas, fecha_entrega: fechaEntrega,
        direccion_entrega: direccionEntrega,
        fecha: new Date().toISOString(), estado: 'pendiente',
      };
      const itemsConCalculos = itemsValidos.map(item => ({
        descripcion: item.descripcion, cantidad: item.cantidad, unidad: item.unidad,
        precio_unitario: item.sinPrecio ? '0' : item.precio, descuento: item.descuento,
        subtotal: item.sinPrecio ? 0 : calcularSubtotalItem(item),
      }));
      const plantilla = await getPlantillaPDF();
      const uri = await generarPDFPreviewAlbaran(albaranPreview, itemsConCalculos, isPremium, plantilla, simboloMoneda, currentTheme.colors.primary, firmaData);
      if (uri) { const html = await fileToPreviewHtml(uri); setPreviewHtml(html); setMostrarPreviewPdf(true); }
    } catch {
      Alert.alert(t('error'), t('no_se_pudo_generar_pdf'));
    } finally {
      setGenerandoPreview(false);
    }
  }

  async function handleExportarPDF() {
    if (!esModoEdicion && !isPremium && !limiteInfo.canCreate) {
      Alert.alert(t('limite_alcanzado'), t('limite_desc'), [
        { text: t('cancelar'), style: 'cancel' },
        { text: t('unlock_premium'), onPress: () => router.push('/(tabs)/ajustes') }
      ]);
      return;
    }
    if (!clienteSeleccionado) { Alert.alert(t('cliente_requerido'), t('selecciona_cliente')); return; }
    const itemsValidos = items.filter(i => i.descripcion.trim());
    if (itemsValidos.length === 0) { Alert.alert(t('sin_articulos'), t('anadirArticuloValidoAlbaran')); return; }

    setGenerandoPDF(true);
    try {
      const numero = numeroAlbaran || getNextNumeroAlbaran(numeracionConfig);
      const subtotalEnEuros = await convertirAEurosParaGuardar(subtotalBruto, codigoMoneda);

      let savedId = esModoEdicion ? parseInt(albaranId!) : 0;
      const isRewardedSave = pendingRewardedSave;
      if (pendingRewardedSave) setPendingRewardedSave(false);

      if (esModoEdicion) {
        updateAlbaran(parseInt(albaranId!), {
          numero, cliente_id: clienteSeleccionado.id, cliente_nombre: clienteSeleccionado.nombre,
          subtotal: subtotalEnEuros, descuento: 0, iva_porcentaje: 0,
          iva_importe: 0, irpf_porcentaje: 0, irpf_importe: 0,
          total: subtotalEnEuros, notas, fecha_entrega: fechaEntrega, firma_data: firmaData,
          direccion_entrega: direccionEntrega,
        });
        deleteAlbaranItems(parseInt(albaranId!));
        for (const item of itemsValidos) {
          const precioEnEuros = item.sinPrecio ? 0 : await convertirAEurosParaGuardar(parseFloat(item.precio) || 0, codigoMoneda);
          const subtotalItemEnEuros = item.sinPrecio ? 0 : await convertirAEurosParaGuardar(calcularSubtotalItem(item), codigoMoneda);
          insertAlbaranItem({
            albaran_id: parseInt(albaranId!), descripcion: item.descripcion,
            cantidad: parseFloat(item.cantidad) || 1, unidad: item.unidad,
            precio_unitario: precioEnEuros, descuento: parseFloat(item.descuento) || 0, subtotal: subtotalItemEnEuros,
          });
        }
        savedId = parseInt(albaranId!);
      } else {
        const newId = insertAlbaran({
          numero, cliente_id: clienteSeleccionado.id, cliente_nombre: clienteSeleccionado.nombre,
          subtotal: subtotalEnEuros, descuento: 0, iva_porcentaje: 0,
          iva_importe: 0, irpf_porcentaje: 0, irpf_importe: 0,
          total: subtotalEnEuros, notas, fecha_entrega: fechaEntrega, firma_data: firmaData,
          direccion_entrega: direccionEntrega,
        });
        await AsyncStorage.setItem('ha_creado_primera_factura', 'true');
        for (const item of itemsValidos) {
          const precioEnEuros = item.sinPrecio ? 0 : await convertirAEurosParaGuardar(parseFloat(item.precio) || 0, codigoMoneda);
          const subtotalItemEnEuros = item.sinPrecio ? 0 : await convertirAEurosParaGuardar(calcularSubtotalItem(item), codigoMoneda);
          insertAlbaranItem({
            albaran_id: newId as number, descripcion: item.descripcion,
            cantidad: parseFloat(item.cantidad) || 1, unidad: item.unidad,
            precio_unitario: precioEnEuros, descuento: parseFloat(item.descuento) || 0, subtotal: subtotalItemEnEuros,
          });
        }
        if (!isRewardedSave) incrementInvoiceCounter();
        savedId = newId as number;
      }

      const albaranGuardado = {
        id: savedId, numero, cliente_id: clienteSeleccionado.id, cliente_nombre: clienteSeleccionado.nombre,
        subtotal: subtotalEnEuros, descuento: 0, iva_porcentaje: 0, iva_importe: 0,
        irpf_porcentaje: 0, irpf_importe: 0, total: subtotalEnEuros, notas,
        fecha_entrega: fechaEntrega, direccion_entrega: direccionEntrega,
        fecha: new Date().toISOString(), estado: 'pendiente',
      };
      const itemsConCalculos = itemsValidos.map(item => ({
        descripcion: item.descripcion, cantidad: item.cantidad, unidad: item.unidad,
        precio_unitario: item.sinPrecio ? '0' : item.precio, descuento: item.descuento,
        subtotal: item.sinPrecio ? 0 : calcularSubtotalItem(item),
      }));
      const plantilla = await getPlantillaPDF();
      await generarYCompartirPDFAlbaran(albaranGuardado, itemsConCalculos, isPremium, plantilla, simboloMoneda, currentTheme.colors.primary, firmaData);
      await adsService.incrementAction(isPremium);
      router.back();
    } catch (e: any) {
      console.log("Error:", e?.message);
      Alert.alert(t('error'), t('no_se_pudo_generar_pdf'));
    } finally {
      setGenerandoPDF(false);
    }
  }

  async function guardarAlbaran() {
    if (!esModoEdicion && !isPremium && !limiteInfo.canCreate && !pendingRewardedSave) {
      const remaining = await getRemainingRewardedAds();
      const buttons: any[] = [{ text: t('cancelar'), style: 'cancel' }];
      if (remaining > 0) {
        buttons.push({
          text: `${t('ver_anuncio')} (${remaining} ${t('hoy')})`,
          onPress: async () => {
            const rewarded = await adsService.showRewardedAd();
            if (rewarded) {
              await incrementRewardedAdCount();
              setPendingRewardedSave(true);
              Alert.alert(t('recompensa_recibida'), t('puedes_guardar_factura'), [{ text: t('guardar'), onPress: () => guardarAlbaran() }]);
            } else {
              const errorType = adsService.lastRewardedError;
              if (errorType === 'no_fill') Alert.alert(t('sin_anuncios_disponibles'), t('sin_anuncios_desc'));
              else Alert.alert(t('anuncio_no_completado'), t('intenta_de_nuevo'));
            }
          },
        });
      }
      buttons.push({ text: t('unlock_premium'), onPress: () => router.push('/(tabs)/ajustes') });
      Alert.alert(t('limite_alcanzado'), t('limite_desc'), buttons);
      return;
    }

    const isRewardedSave = pendingRewardedSave;
    if (pendingRewardedSave) setPendingRewardedSave(false);

    if (!clienteSeleccionado) { Alert.alert(t('cliente_requerido'), t('selecciona_cliente')); return; }
    const itemsValidos = items.filter(i => i.descripcion.trim());
    if (itemsValidos.length === 0) { Alert.alert(t('sin_articulos'), t('anadirArticuloValidoAlbaran')); return; }

    try {
      const numero = numeroAlbaran || getNextNumeroAlbaran(numeracionConfig);
      const subtotalEnEuros = await convertirAEurosParaGuardar(subtotalBruto, codigoMoneda);

      if (esModoEdicion) {
        updateAlbaran(parseInt(albaranId!), {
          numero, cliente_id: clienteSeleccionado.id, cliente_nombre: clienteSeleccionado.nombre,
          subtotal: subtotalEnEuros, descuento: 0, iva_porcentaje: 0,
          iva_importe: 0, irpf_porcentaje: 0, irpf_importe: 0,
          total: subtotalEnEuros, notas, fecha_entrega: fechaEntrega, firma_data: firmaData,
          direccion_entrega: direccionEntrega,
        });
        deleteAlbaranItems(parseInt(albaranId!));
        for (const item of itemsValidos) {
          const precioEnEuros = item.sinPrecio ? 0 : await convertirAEurosParaGuardar(parseFloat(item.precio) || 0, codigoMoneda);
          const subtotalItemEnEuros = item.sinPrecio ? 0 : await convertirAEurosParaGuardar(calcularSubtotalItem(item), codigoMoneda);
          insertAlbaranItem({
            albaran_id: parseInt(albaranId!), descripcion: item.descripcion,
            cantidad: parseFloat(item.cantidad) || 1, unidad: item.unidad,
            precio_unitario: precioEnEuros, descuento: parseFloat(item.descuento) || 0, subtotal: subtotalItemEnEuros,
          });
        }
        await adsService.incrementAction(isPremium);
        router.back();
      } else {
        const newId = insertAlbaran({
          numero, cliente_id: clienteSeleccionado.id, cliente_nombre: clienteSeleccionado.nombre,
          subtotal: subtotalEnEuros, descuento: 0, iva_porcentaje: 0,
          iva_importe: 0, irpf_porcentaje: 0, irpf_importe: 0,
          total: subtotalEnEuros, notas, fecha_entrega: fechaEntrega, firma_data: firmaData,
          direccion_entrega: direccionEntrega,
        });
        await AsyncStorage.setItem('ha_creado_primera_factura', 'true');
        for (const item of itemsValidos) {
          const precioEnEuros = item.sinPrecio ? 0 : await convertirAEurosParaGuardar(parseFloat(item.precio) || 0, codigoMoneda);
          const subtotalItemEnEuros = item.sinPrecio ? 0 : await convertirAEurosParaGuardar(calcularSubtotalItem(item), codigoMoneda);
          insertAlbaranItem({
            albaran_id: newId as number, descripcion: item.descripcion,
            cantidad: parseFloat(item.cantidad) || 1, unidad: item.unidad,
            precio_unitario: precioEnEuros, descuento: parseFloat(item.descuento) || 0, subtotal: subtotalItemEnEuros,
          });
        }
        if (!isRewardedSave) incrementInvoiceCounter();
        await adsService.incrementAction(isPremium);
        router.back();
      }
    } catch (e: any) {
      console.log("Error:", e?.message);
      Alert.alert(t('error'), `${t('error_guardar')}: ${e?.message || ''}`);
    }
  }

  const clientesFiltrados = clientes.filter(c => c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase()));

  function hayCambiosSinGuardar() {
    if (notas.trim().length > 0) return true;
    if (fechaEntrega.trim().length > 0) return true;
    if (direccionEntrega.trim().length > 0) return true;
    if (clienteSeleccionado) return true;
    if (firmaData) return true;
    if (items.some(i => i.descripcion.trim().length > 0 || (!i.sinPrecio && (parseFloat(i.precio) || 0) > 0))) return true;
    return false;
  }

  function handleSalir() {
    if (!hayCambiosSinGuardar()) {
      Alert.alert(t('salir_factura_titulo'), t('seguro_salir_factura'), [
        { text: t('cancelar'), style: 'cancel' },
        { text: t('salir'), onPress: () => router.back() }
      ]);
      return;
    }
    Alert.alert('', t('confirmar_salir_factura_cambios'), [
      { text: t('cancelar'), style: 'cancel' },
      { text: t('salir'), onPress: () => router.back() }
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.screenHeaderRow, { borderBottomColor: currentTheme.colors.border ?? '#f0f0f0' }]}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: currentTheme.colors.card }]}
            onPress={handleSalir}
            accessibilityRole="button" accessibilityLabel={t('cerrar')}>
            <Ionicons name="close" size={24} color={currentTheme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.screenHeaderTitle, { color: currentTheme.colors.text }]} numberOfLines={1}>
            {esModoEdicion ? t('editar_albaran') : t('nuevo_albaran')}
          </Text>
          <TouchableOpacity
            style={[styles.headerSavePill, { backgroundColor: currentTheme.colors.primary }]}
            onPress={guardarAlbaran}
            accessibilityRole="button" accessibilityLabel={t('guardar')}>
            <Text style={styles.headerSavePillText}>{t('guardar')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} style={styles.scroll} showsVerticalScrollIndicator={false} scrollEnabled={scrollEnabled}>

          {/* Número de albarán */}
          <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('numero_albaran')}</Text>
            <TextInput
              style={styles.input} placeholder="A-0001" placeholderTextColor="#bbb"
              value={numeroAlbaran} onChangeText={setNumeroAlbaran}
            />
          </View>

          {/* Cliente */}
          <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('cliente')}</Text>
            {clienteSeleccionado ? (
              <View>
                <TouchableOpacity style={styles.clienteSeleccionado} activeOpacity={0.7} onPress={abrirSelectorClientes}>
                  <View style={styles.clienteAvatar}>
                    <Text style={styles.clienteAvatarLetra}>{clienteSeleccionado.nombre.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clienteNombre}>{clienteSeleccionado.nombre}</Text>
                    {clienteSeleccionado.email ? <Text style={styles.clienteEmail}>{clienteSeleccionado.email}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#aaa" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.quitarClienteBtn} onPress={() => setClienteSeleccionado(null)}>
                  <Ionicons name="close-circle-outline" size={16} color="#FF4757" />
                  <Text style={styles.quitarClienteTexto}>{t('quitar_cliente')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.clienteBtns}>
                <TouchableOpacity style={[styles.clienteBtn, { borderColor: currentTheme.colors.primary }]} onPress={abrirSelectorClientes}>
                  <Ionicons name="person-outline" size={16} color={currentTheme.colors.primary} />
                  <Text style={[styles.clienteBtnTexto, { color: currentTheme.colors.primary }]}>{t('seleccionar_cliente')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.clienteBtn, styles.clienteBtnSecundario, { borderColor: currentTheme.colors.primary }]} onPress={() => router.push("/(tabs)/clientes")}>
                  <Ionicons name="person-add-outline" size={16} color={currentTheme.colors.primary} />
                  <Text style={[styles.clienteBtnTexto, { color: currentTheme.colors.primary }]}>{t('anadir_cliente')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Fecha de entrega */}
          <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('fecha_entrega')}</Text>
            <TextInput
              style={styles.input} placeholder="DD/MM/AAAA" placeholderTextColor="#bbb"
              value={fechaEntrega} onChangeText={setFechaEntrega}
            />
          </View>

          {/* Dirección de entrega */}
          <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('direccion_entrega')}</Text>
            <TextInput
              style={[styles.input, styles.inputNotas]}
              placeholder={t('direccion_entrega')}
              placeholderTextColor="#bbb"
              value={direccionEntrega}
              onChangeText={setDireccionEntrega}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Artículos */}
          <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('articulos')}</Text>
            {items.map((item, index) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={[styles.itemNumero, { color: currentTheme.colors.primary }]}>{t('articulo')} {index + 1}</Text>
                  {items.length > 1 && (
                    <TouchableOpacity onPress={() => eliminarItem(item.id)}>
                      <Ionicons name="trash-outline" size={18} color="#FF4757" />
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.descripcionContainer}>
                  <TextInput
                    style={styles.inputDescripcion} placeholder={t('descripcion')} placeholderTextColor="#bbb"
                    value={item.descripcion} onChangeText={v => actualizarItem(item.id, "descripcion", v)} multiline
                  />
                  <TouchableOpacity style={[styles.botonProducto, { borderColor: currentTheme.colors.primary }]} onPress={() => abrirSelectorProductos(item.id)}>
                    <Ionicons name="cube-outline" size={20} color={currentTheme.colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.fila}>
                  <View style={styles.campoChico}>
                    <Text style={styles.campoLabel}>{t('cantidad')}</Text>
                    <TextInput style={styles.inputChico} placeholder="1" placeholderTextColor="#bbb" keyboardType="decimal-pad"
                      value={item.cantidad} onChangeText={v => actualizarItem(item.id, "cantidad", v)} />
                  </View>
                  <View style={styles.campoChico}>
                    <Text style={styles.campoLabel}>{t('unidad')}</Text>
                    <TouchableOpacity style={styles.inputChico} onPress={() => setMostrarUnidades(item.id)}>
                      <Text style={{ color: "#1a1a1a", fontSize: 15 }}>{item.unidad}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.campoChico}>
                    <Text style={styles.campoLabel}>{item.sinPrecio ? '' : `${t('precio')} (${simboloMoneda})`}</Text>
                    {item.sinPrecio ? (
                      <TouchableOpacity style={[styles.inputChico, { justifyContent: 'center', alignItems: 'center' }]} onPress={() => toggleSinPrecio(item.id)}>
                        <Text style={{ color: '#888', fontSize: 13, fontStyle: 'italic' }}>{t('sin_precio')}</Text>
                      </TouchableOpacity>
                    ) : (
                      <TextInput style={styles.inputChico} placeholder="0.00" placeholderTextColor="#bbb" keyboardType="decimal-pad"
                        value={item.precio} onChangeText={v => actualizarItem(item.id, "precio", v)} />
                    )}
                  </View>
                </View>
                <View style={styles.filaDescuento}>
                  {!item.sinPrecio ? (
                    <>
                      <Text style={styles.campoLabel}>{t('descuento')} (%)</Text>
                      <View style={styles.descuentoInput}>
                        <TextInput style={styles.inputDescuento} placeholder="0" placeholderTextColor="#ccc" keyboardType="decimal-pad"
                          value={item.descuento} onChangeText={v => actualizarItem(item.id, "descuento", v)} />
                      </View>
                      <Text style={[styles.subtotalItem, { color: currentTheme.colors.primary }]}>= {calcularSubtotalItem(item).toFixed(2)} {simboloMoneda}</Text>
                    </>
                  ) : (
                    <TouchableOpacity onPress={() => toggleSinPrecio(item.id)}>
                      <Text style={{ color: currentTheme.colors.primary, fontSize: 12, fontWeight: '600' }}>{t('anadirPrecio')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
            <TouchableOpacity style={[styles.addItemBtn, { borderColor: currentTheme.colors.primary }]} onPress={() => setItems(prev => [...prev, nuevoItem()])}>
              <Ionicons name="add-circle-outline" size={20} color={currentTheme.colors.primary} />
              <Text style={[styles.addItemTexto, { color: currentTheme.colors.primary }]}>{t('anadir_articulo')}</Text>
            </TouchableOpacity>
          </View>

          {/* Notas */}
          <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('notas')}</Text>
            <TextInput style={[styles.input, styles.inputNotas]} placeholder={t('notas_placeholder')} placeholderTextColor="#bbb"
              value={notas} onChangeText={setNotas} multiline numberOfLines={4} />
          </View>

          {/* Separador visual antes de la firma */}
          <View style={styles.firmaSeparador}>
            <View style={[styles.firmaSeparadorLinea, { backgroundColor: currentTheme.colors.primary + '40' }]} />
            <View style={[styles.firmaBanner, { backgroundColor: currentTheme.colors.primary + '12', borderColor: currentTheme.colors.primary + '30' }]}>
              <Ionicons name="create-outline" size={14} color={currentTheme.colors.primary} />
              <Text style={[styles.firmaBannerTexto, { color: currentTheme.colors.primary }]}>{t('zona_firma_receptor_titulo')}</Text>
            </View>
            <View style={[styles.firmaSeparadorLinea, { backgroundColor: currentTheme.colors.primary + '40' }]} />
          </View>

          {/* Firma del receptor */}
          <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('firmaReceptor')}</Text>
            <Text style={[styles.firmaDescripcion, { color: currentTheme.colors.textSecondary }]}>{t('firmaDescripcion')}</Text>
            <Text style={[styles.firmaClienteHint, { color: currentTheme.colors.primary }]}>{t('zona_firma_receptor_sub')}</Text>
            <SignaturePad
              onSignatureChange={setFirmaData}
              onDrawStart={() => setScrollEnabled(false)}
              onDrawEnd={() => setScrollEnabled(true)}
              primaryColor={currentTheme.colors.primary}
            />
          </View>

          <TouchableOpacity style={[styles.botonGuardar, { backgroundColor: currentTheme.colors.primary }]} onPress={guardarAlbaran}>
            <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
            <Text style={styles.botonGuardarTexto}>{t('guardar_albaran')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.botonGuardar, styles.botonExportarPdf, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.primary }]} onPress={handleVistaPrevia} disabled={generandoPreview}>
            <Ionicons name="eye-outline" size={22} color={currentTheme.colors.primary} />
            <Text style={[styles.botonGuardarTexto, { color: currentTheme.colors.primary }]}>{generandoPreview ? '...' : t('numeracion_vista_previa')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.botonGuardar, styles.botonExportarPdf, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.primary }]} onPress={handleExportarPDF} disabled={generandoPDF}>
            <Ionicons name="document-text-outline" size={22} color={currentTheme.colors.primary} />
            <Text style={[styles.botonGuardarTexto, { color: currentTheme.colors.primary }]}>{t('exportar_albaran')}</Text>
          </TouchableOpacity>

          {!isPremium && (
            <TouchableOpacity style={[styles.premiumBanner, { backgroundColor: currentTheme.colors.primary }]} onPress={() => setMostrarPaywall(true)}>
              <Ionicons name="diamond-outline" size={20} color="#fff" />
              <View style={styles.premiumBannerTextoContainer}>
                <Text style={styles.premiumBannerTitulo}>{t('desbloquear_pdf_pro')}</Text>
                <Text style={styles.premiumBannerSub}>{t('ilimitadas_sin_marca')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>

        {/* Modal clientes */}
        <Modal visible={mostrarClientes} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalWrapper}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>{t('seleccionar_cliente')}</Text>
              <TouchableOpacity onPress={() => setMostrarClientes(false)}><Ionicons name="close" size={26} color="#1a1a1a" /></TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Ionicons name="search" size={18} color="#888" />
              <TextInput style={styles.modalSearchInput} placeholder={t('buscar_cliente')} placeholderTextColor="#aaa" value={busquedaCliente} onChangeText={setBusquedaCliente} />
            </View>
            <ScrollView>
              {clientesFiltrados.length === 0 ? (
                <View style={styles.modalEmpty}><Text style={styles.modalEmptyTexto}>{t('no_hay_clientes')}</Text></View>
              ) : (
                clientesFiltrados.map(c => (
                  <TouchableOpacity key={c.id} style={styles.modalClienteItem} onPress={() => {
                setClienteSeleccionado(c);
                const addrParts = [c.calle, c.ciudad, c.cp, c.provincia].filter(Boolean);
                setDireccionEntrega(addrParts.length > 0 ? addrParts.join(', ') : '');
                setMostrarClientes(false);
              }}>
                    <View style={styles.clienteAvatar}><Text style={styles.clienteAvatarLetra}>{c.nombre.charAt(0).toUpperCase()}</Text></View>
                    <View><Text style={styles.modalClienteNombre}>{c.nombre}</Text>{c.email ? <Text style={styles.modalClienteEmail}>{c.email}</Text> : null}</View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </Modal>

        {/* Modal unidades */}
        <Modal visible={!!mostrarUnidades} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalWrapper}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>{t('seleccionar_unidad')}</Text>
              <TouchableOpacity onPress={() => setMostrarUnidades(null)}><Ionicons name="close" size={26} color="#1a1a1a" /></TouchableOpacity>
            </View>
            {UNIDADES.map(u => (
              <TouchableOpacity key={u} style={styles.unidadItem} onPress={() => { if (mostrarUnidades) actualizarItem(mostrarUnidades, "unidad", u); setMostrarUnidades(null); }}>
                <Text style={styles.unidadTexto}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Modal>

        {/* Modal productos */}
        <Modal visible={mostrarProductos} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalWrapper}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>{t('seleccionar_producto')}</Text>
              <TouchableOpacity onPress={() => setMostrarProductos(false)}><Ionicons name="close" size={26} color="#1a1a1a" /></TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Ionicons name="search" size={18} color="#888" />
              <TextInput style={styles.modalSearchInput} placeholder={t('buscar_producto')} placeholderTextColor="#aaa" value={busquedaProducto} onChangeText={setBusquedaProducto} />
            </View>
            <ScrollView>
              {productos.filter(p => p.descripcion.toLowerCase().includes(busquedaProducto.toLowerCase())).length === 0 ? (
                <View style={styles.modalEmpty}><Text style={styles.modalEmptyTexto}>{t('no_productos')}</Text></View>
              ) : (
                productos.filter(p => p.descripcion.toLowerCase().includes(busquedaProducto.toLowerCase())).map(p => (
                  <TouchableOpacity key={p.id} style={styles.modalProductoItem} onPress={() => seleccionarProducto(p)}>
                    <View style={styles.productoIcono}><Ionicons name="cube-outline" size={24} color={currentTheme.colors.primary} /></View>
                    <View style={{ flex: 1 }}><Text style={styles.modalProductoNombre}>{p.descripcion}</Text><Text style={styles.modalProductoInfo}>{p.precio} {simboloMoneda} / {p.unidad}</Text></View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </Modal>

        {/* Modal paywall */}
        <Modal visible={mostrarPaywall} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.paywallWrapper}>
            <View style={styles.paywallHeader}>
              <TouchableOpacity onPress={() => setMostrarPaywall(false)}><Ionicons name="close" size={26} color="#1a1a1a" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.paywallTop}>
                <View style={styles.paywallIcono}><Ionicons name="diamond" size={48} color={currentTheme.colors.primary} /></View>
                <Text style={styles.paywallTitulo}>{t('premium_titulo')}</Text>
                <Text style={styles.paywallSub}>{t('premium_sub')}</Text>
              </View>
              <View style={styles.paywallCaracteristicas}>
                {[t('facturas_ilimitadas'), t('pdf_sin_marca'), t('logo_personalizado'), t('plantillas_premium'), t('sin_anuncios')].map((txt, i) => (
                  <View key={i} style={styles.paywallCaracteristica}>
                    <Ionicons name="checkmark-circle" size={20} color="#26de81" />
                    <Text style={styles.paywallCaracteristicaTexto}>{txt}</Text>
                  </View>
                ))}
              </View>
              {offerings && offerings.availablePackages && offerings.availablePackages.length > 0 ? (
                <View style={styles.paywallPlanes}>
                  {offerings.availablePackages.map((pkg: any) => (
                    <TouchableOpacity key={pkg.identifier}
                      style={[styles.paywallPlan, { borderColor: planSeleccionado?.identifier === pkg.identifier ? currentTheme.colors.primary : pkg.packageType === 'ANNUAL' ? currentTheme.colors.primary : '#e8e8e8', backgroundColor: planSeleccionado?.identifier === pkg.identifier ? currentTheme.colors.primary + '10' : '#fff' }]}
                      onPress={() => setPlanSeleccionado(pkg)} disabled={comprando}>
                      <Text style={[styles.paywallPlanTitulo, { color: planSeleccionado?.identifier === pkg.identifier ? currentTheme.colors.primary : '#1a1a1a' }]}>{pkg.packageType === 'ANNUAL' ? t('anual') : pkg.packageType === 'MONTHLY' ? t('mensual') : t('lifetime')}</Text>
                      <Text style={[styles.paywallPlanPrecio, { color: planSeleccionado?.identifier === pkg.identifier ? currentTheme.colors.primary : '#1a1a1a' }]}>{pkg.product.priceString}</Text>
                      {pkg.packageType === 'ANNUAL' && <Text style={[styles.paywallPlanRecomendado, { color: currentTheme.colors.primary }]}>{t('recomendado')}</Text>}
                      {planSeleccionado?.identifier === pkg.identifier && (
                        <View style={styles.checkmarkContainer}><Ionicons name="checkmark-circle" size={24} color={currentTheme.colors.primary} /></View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <TouchableOpacity style={[styles.paywallDesbloquear, { opacity: planSeleccionado ? 1 : 0.5, backgroundColor: currentTheme.colors.primary }]} onPress={() => planSeleccionado && handleComprar(planSeleccionado)} disabled={!planSeleccionado || comprando}>
                <Text style={styles.paywallDesbloquearTexto}>{t('desbloquear')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.paywallRestaurar} onPress={handleRestaurar}>
                <Text style={[styles.paywallRestaurarTexto, { color: currentTheme.colors.primary }]}>{t('restaurar')}</Text>
              </TouchableOpacity>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </Modal>

        {/* Modal Vista previa PDF */}
        <Modal visible={mostrarPreviewPdf} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMostrarPreviewPdf(false)}>
          <View style={[styles.previewWrapper, { backgroundColor: currentTheme.colors.background }]}>
            <View style={[styles.previewHeader, { backgroundColor: currentTheme.colors.card, borderBottomColor: currentTheme.colors.border || '#f0f0f0' }]}>
              <TouchableOpacity style={styles.previewCloseBtn} onPress={() => { setMostrarPreviewPdf(false); setPreviewHtml(null); }}>
                <Ionicons name="close" size={22} color={currentTheme.colors.text} />
              </TouchableOpacity>
              <Text style={[styles.previewTitle, { color: currentTheme.colors.text }]}>{t('numeracion_vista_previa')}</Text>
              <View style={{ width: 36 }} />
            </View>
            {previewHtml ? (
              <WebView source={{ html: previewHtml }} style={{ flex: 1 }} originWhitelist={['*']} javaScriptEnabled={true} />
            ) : (
              <View style={styles.previewLoading}><Text style={{ color: currentTheme.colors.textSecondary }}>{t('cargando')}...</Text></View>
            )}
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F8F7FF", paddingTop: 0 },
  screenHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 52, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerIconBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  screenHeaderTitle: { flex: 1, marginHorizontal: 8, textAlign: "center", fontSize: 17, fontWeight: "800" },
  headerSavePill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, minWidth: 84, alignItems: "center", justifyContent: "center" },
  headerSavePillText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  scroll: { flex: 1 },
  seccion: { backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, marginBottom: 16, padding: 18 },
  seccionTitulo: { fontSize: 16, fontWeight: "700", color: "#1a1a1a", marginBottom: 14 },
  clienteBtns: { flexDirection: "row", gap: 10 },
  clienteBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8, backgroundColor: "#fff" },
  clienteBtnSecundario: { backgroundColor: "#fff" },
  clienteBtnTexto: { fontWeight: "600", fontSize: 12 },
  clienteSeleccionado: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F8F7FF", borderRadius: 12, padding: 12 },
  clienteAvatar: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center", backgroundColor: "#6C47FF" },
  clienteAvatarLetra: { color: "#fff", fontSize: 18, fontWeight: "700" },
  clienteNombre: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  clienteEmail: { fontSize: 12, color: "#888", marginTop: 2 },
  quitarClienteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, paddingVertical: 8 },
  quitarClienteTexto: { fontSize: 13, color: "#FF4757", fontWeight: "600" },
  itemCard: { backgroundColor: "#F8F7FF", borderRadius: 12, padding: 14, marginBottom: 12 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  itemNumero: { fontSize: 13, fontWeight: "700" },
  descripcionContainer: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  inputDescripcion: { flex: 1, borderWidth: 1.5, borderColor: "#e8e8e8", borderRadius: 10, padding: 12, fontSize: 15, color: "#1a1a1a", backgroundColor: "#fff", minHeight: 44 },
  botonProducto: { width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, backgroundColor: "#EEE9FF", justifyContent: "center", alignItems: "center" },
  input: { borderWidth: 1.5, borderColor: "#e8e8e8", borderRadius: 10, padding: 12, fontSize: 15, color: "#1a1a1a", backgroundColor: "#fff", marginBottom: 10 },
  inputNotas: { minHeight: 90, textAlignVertical: "top" },
  fila: { flexDirection: "row", gap: 8, marginBottom: 8 },
  campoChico: { flex: 1 },
  campoLabel: { fontSize: 11, fontWeight: "600", color: "#888", marginBottom: 5, textTransform: "uppercase" },
  inputChico: { borderWidth: 1.5, borderColor: "#e8e8e8", borderRadius: 10, padding: 10, fontSize: 15, color: "#1a1a1a", backgroundColor: "#fff", justifyContent: "center" },
  filaDescuento: { flexDirection: "row", alignItems: "center", gap: 10 },
  descuentoInput: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e8e8e8", borderRadius: 10, backgroundColor: "#fff", paddingHorizontal: 10, flex: 1 },
  inputDescuento: { flex: 1, fontSize: 15, color: "#1a1a1a", paddingVertical: 10 },
  subtotalItem: { fontSize: 14, fontWeight: "700", minWidth: 80, textAlign: "right" },
  addItemBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderStyle: "dashed", borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  addItemTexto: { fontWeight: "600", fontSize: 14 },
  ivaOpciones: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  ivaBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#e8e8e8", backgroundColor: "#fff" },
  ivaBtnActivo: { borderColor: "#6C47FF" },
  ivaBtnTexto: { color: "#888", fontWeight: "600", fontSize: 14 },
  ivaBtnTextoActivo: { color: "#fff" },
  seccionTotales: { backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, marginBottom: 16, padding: 18 },
  totalFila: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  totalLabel: { fontSize: 14, color: "#888" },
  totalValor: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  totalFilaFinal: { borderTopWidth: 1.5, borderTopColor: "#f0f0f0", paddingTop: 14, marginTop: 4 },
  totalLabelFinal: { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },
  totalValorFinal: { fontSize: 22, fontWeight: "800" },
  botonGuardar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginHorizontal: 16, borderRadius: 16, paddingVertical: 18 },
  botonExportarPdf: { marginTop: 12, borderWidth: 1.5 },
  botonGuardarTexto: { color: "#fff", fontWeight: "800", fontSize: 17 },
  premiumBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginHorizontal: 16, marginTop: 12, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  premiumBannerTextoContainer: { flex: 1 },
  premiumBannerTitulo: { color: "#fff", fontWeight: "700", fontSize: 14 },
  premiumBannerSub: { color: "rgba(255,255,255,0.8)", fontSize: 11 },
  modalWrapper: { flex: 1, backgroundColor: "#fff", paddingTop: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 16 },
  modalTitulo: { fontSize: 20, fontWeight: "800", color: "#1a1a1a" },
  modalSearch: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F8F7FF", borderRadius: 12, paddingHorizontal: 16, marginHorizontal: 20, marginBottom: 16 },
  modalSearchInput: { flex: 1, fontSize: 15, color: "#1a1a1a", paddingVertical: 14 },
  modalEmpty: { alignItems: "center", paddingTop: 60 },
  modalEmptyTexto: { fontSize: 16, color: "#aaa" },
  modalClienteItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  modalClienteNombre: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  modalClienteEmail: { fontSize: 12, color: "#888", marginTop: 2 },
  unidadItem: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  unidadTexto: { fontSize: 16, color: "#1a1a1a", fontWeight: "500" },
  modalProductoItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  productoIcono: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#EEE9FF", justifyContent: "center", alignItems: "center" },
  modalProductoNombre: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  modalProductoInfo: { fontSize: 13, color: "#888", marginTop: 2 },
  paywallWrapper: { flex: 1, backgroundColor: "#fff", paddingTop: 20 },
  paywallHeader: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 20, marginBottom: 16 },
  paywallTop: { alignItems: "center", paddingTop: 40, paddingBottom: 30 },
  paywallIcono: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#EEE9FF", justifyContent: "center", alignItems: "center", marginBottom: 20 },
  paywallTitulo: { fontSize: 28, fontWeight: "900", color: "#1a1a1a", marginBottom: 8 },
  paywallSub: { fontSize: 16, color: "#888", textAlign: "center", paddingHorizontal: 40 },
  paywallCaracteristicas: { paddingHorizontal: 20, marginTop: 20 },
  paywallCaracteristica: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  paywallCaracteristicaTexto: { fontSize: 16, color: "#1a1a1a", fontWeight: "500" },
  paywallPlanes: { paddingHorizontal: 20, marginTop: 30, gap: 12 },
  paywallPlan: { borderWidth: 2, borderRadius: 16, padding: 20, alignItems: "center", backgroundColor: "#fff", position: "relative" },
  paywallPlanTitulo: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  paywallPlanPrecio: { fontSize: 24, fontWeight: "800", marginBottom: 4 },
  paywallPlanRecomendado: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  checkmarkContainer: { position: "absolute", top: 10, right: 10 },
  paywallDesbloquear: { marginHorizontal: 20, marginTop: 20, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  paywallDesbloquearTexto: { color: "#fff", fontSize: 16, fontWeight: "800" },
  paywallRestaurar: { alignItems: "center", paddingVertical: 20 },
  paywallRestaurarTexto: { fontSize: 15, fontWeight: "600" },
  previewWrapper: { flex: 1, paddingTop: 20 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  previewCloseBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  previewTitle: { fontSize: 18, fontWeight: '800' },
  previewLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Firma
  firmaSeparador: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 16, gap: 10 },
  firmaSeparadorLinea: { flex: 1, height: 1.5, borderRadius: 1 },
  firmaBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  firmaBannerTexto: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  firmaDescripcion: { fontSize: 13, marginBottom: 14, lineHeight: 18 },
  firmaClienteHint: { fontSize: 12, fontWeight: '500', marginBottom: 12, textAlign: 'center' },
  firmaArea: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, height: 120, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  firmaPlaceholder: { fontSize: 13, fontStyle: 'italic', marginTop: 8 },
  firmaToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 14, borderWidth: 1.5 },
  firmaToggleText: { fontSize: 14, fontWeight: '600' },
});
