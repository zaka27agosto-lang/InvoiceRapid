import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";    import {
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
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { generarPDFPreview } from "../../utils/pdf";
import Pdf from 'react-native-pdf';
import { getMoneda, getNumeracionConfig, getPlantillaPDF } from "../../utils/settings";
import { checkInvoiceLimitAsync, incrementInvoiceCounter, getRemainingRewardedAds, incrementRewardedAdCount } from "../../utils/subscription";
import { getClientes } from "../db/clientes";
import { deleteFacturaItems, getFactura, getFacturaItems, getNextNumeroFactura, insertFactura, insertFacturaItem, updateFactura } from "../db/facturas";
import { getProductos } from "../db/productos";
import type { Factura, FacturaItem } from "../db/types";

type Item = {
  id: string;
  descripcion: string;
  cantidad: string;
  unidad: string;
  precio: string;
  descuento: string;
  descuentoTipo: 'porcentaje' | 'moneda';
};

const UNIDADES = ["ud", "kg", "g", "l", "ml", "m", "m²", "h", "día", "mes"];

export default function NuevaFactura() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id: facturaId } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const { isPremium, offerings, comprar, restaurar } = useSubscription();
  const { currentTheme } = useTheme();
  const esModoEdicion = !!facturaId;

  const [mostrarPaywall, setMostrarPaywall] = useState(false);
  const [pendingRewardedSave, setPendingRewardedSave] = useState(false);
  const [comprando, setComprando] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [generandoPreview, setGenerandoPreview] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
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
  const [ivaPorcentaje, setIvaPorcentaje] = useState(21);
  const [irpfPorcentaje, setIrpfPorcentaje] = useState(0);
  const [notas, setNotas] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [mostrarDatePickerEntrega, setMostrarDatePickerEntrega] = useState(false);
  const [mostrarDatePickerVencimiento, setMostrarDatePickerVencimiento] = useState(false);
  const [simboloMoneda, setSimboloMoneda] = useState("€");
  const [codigoMoneda, setCodigoMoneda] = useState("EUR");
  const [limiteInfo, setLimiteInfo] = useState<{ canCreate: boolean; currentCount: number; limit: number }>({ canCreate: true, currentCount: 0, limit: 5 });
  const [numeroFactura, setNumeroFactura] = useState("");
  const [numeracionConfig, setNumeracionConfigState] = useState<{ prefijo: string; sufijo: string; digitos: number }>({ prefijo: 'F-', sufijo: '', digitos: 4 });
  const scrollRef = useRef<ScrollView>(null);
  const savingRef = useRef(false);
  const closingRef = useRef(false);

  useEffect(() => {
    getMoneda().then(m => {
      setSimboloMoneda(m.simbolo);
      setCodigoMoneda(m.codigo);
    });
    checkInvoiceLimitAsync(isPremium).then(setLimiteInfo);
    getNumeracionConfig().then(setNumeracionConfigState);
    // Cargar IVA guardado
    AsyncStorage.getItem('ultimo_iva').then(iva => {
      if (iva) setIvaPorcentaje(parseFloat(iva));
    });

    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (savingRef.current || closingRef.current) return;
      if (mostrarClientes || mostrarProductos || mostrarUnidades || mostrarPaywall) {
        return;
      }
      if (!hayCambiosSinGuardar()) {
        return;
      }

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
  }, [navigation, t, mostrarClientes, mostrarProductos, mostrarUnidades, mostrarPaywall, clienteSeleccionado, items, notas]);

  useFocusEffect(
    useCallback(() => {
      // Scroll al inicio sin animación
      scrollRef.current?.scrollTo({ y: 0, animated: false });

      // Recalcular límite siempre al enfocar
      checkInvoiceLimitAsync(isPremium).then(setLimiteInfo);

      // Recargar moneda
      getMoneda().then(m => {
        setSimboloMoneda(m.simbolo);
        setCodigoMoneda(m.codigo);
      });

      getNumeracionConfig().then(cfg => {
      setNumeracionConfigState(cfg);
      if (facturaId) {
        cargarFactura(parseInt(facturaId));
      } else {
        setNumeroFactura(getNextNumeroFactura(cfg));
        reiniciarFormulario();
      }
    });
    }, [facturaId, isPremium])
  );

  function nuevoItem(): Item {
    return {
      id: Math.random().toString(),
      descripcion: "",
      cantidad: "1",
      unidad: "ud",
      precio: "",
      descuento: "0",
      descuentoTipo: "porcentaje",
    };
  }

  function actualizarItem(id: string, campo: keyof Item, valor: string) {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, [campo]: valor } : item)));
  }

  function cambiarTipoDescuento(id: string, tipo: 'porcentaje' | 'moneda') {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, descuentoTipo: tipo } : item)));
  }

  function eliminarItem(id: string) {
    if (items.length === 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  }

  function calcularSubtotalItem(item: Item) {
    const cant = parseFloat(item.cantidad) || 0;
    const precio = parseFloat(item.precio) || 0;
    const desc = parseFloat(item.descuento) || 0;
    const subtotalBruto = cant * precio;
    
    if (item.descuentoTipo === 'moneda') {
      // Descuento en moneda: restar el importe del descuento
      return Math.max(0, subtotalBruto - desc);
    } else {
      // Descuento porcentaje: aplicar porcentaje
      return subtotalBruto * (1 - desc / 100);
    }
  }

  const subtotalBruto = items.reduce((acc, item) => acc + calcularSubtotalItem(item), 0);
  const ivaImporte = subtotalBruto * (ivaPorcentaje / 100);
  const irpfImporte = subtotalBruto * (irpfPorcentaje / 100);
  const total = subtotalBruto + ivaImporte - irpfImporte;

  function abrirSelectorClientes() {
    setClientes(getClientes());
    setBusquedaCliente("");
    setMostrarClientes(true);
  }

  function abrirSelectorProductos(itemId: string) {
    setProductos(getProductos());
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
    // Cargar IVA guardado en lugar de resetear a 21
    AsyncStorage.getItem('ultimo_iva').then(iva => {
      if (iva) setIvaPorcentaje(parseFloat(iva));
    });
    setIrpfPorcentaje(0);
    setNotas("");
    setMetodoPago("efectivo");
    setFechaVencimiento("");
    setFechaEntrega("");
    setNumeroFactura(getNextNumeroFactura(numeracionConfig));
  }

  function cargarFactura(id: number) {
    const factura = getFactura(id) as Factura | null;
    if (!factura) {
      Alert.alert(t('error'), t('factura_no_encontrada'));
      router.back();
      return;
    }

    const facturaItems = getFacturaItems(id) as FacturaItem[];

    setNumeroFactura(factura.numero);
    setClienteSeleccionado({
      id: factura.cliente_id,
      nombre: factura.cliente_nombre,
    });
    setIvaPorcentaje(factura.iva_porcentaje);
    setIrpfPorcentaje(factura.irpf_porcentaje);
    setNotas(factura.notas || "");
    setMetodoPago(factura.metodo_pago || "efectivo");
    setFechaVencimiento(factura.fecha_vencimiento || "");
    setFechaEntrega(factura.fecha_entrega || "");

    const itemsCargados: Item[] = facturaItems.map((item: any) => ({
      id: Math.random().toString(),
      descripcion: item.descripcion,
      cantidad: item.cantidad.toString(),
      unidad: item.unidad,
      precio: item.precio_unitario.toString(),
      descuento: item.descuento.toString(),
      descuentoTipo: "porcentaje",
    }));
    setItems(itemsCargados.length > 0 ? itemsCargados : [nuevoItem()]);
  }

  async function handleCambiarIva(valor: number) {
    setIvaPorcentaje(valor);
    await AsyncStorage.setItem('ultimo_iva', valor.toString());
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
    if (result.isPremium) {
      Alert.alert('✅', t('compra_restaurada'));
    } else {
      Alert.alert(t('info'), t('no_compras_previas'));
    }
  }

  async function handleVistaPrevia() {
    if (!clienteSeleccionado) {
      Alert.alert(t('cliente_requerido'), t('selecciona_cliente'));
      return;
    }

    const itemsValidos = items.filter(i => i.descripcion.trim() && parseFloat(i.precio) > 0);
    if (itemsValidos.length === 0) {
      Alert.alert(t('sin_articulos'), t('anadir_articulo_valido'));
      return;
    }

    setGenerandoPreview(true);
    try {
      const facturaPreview = {
        id: 0,
        numero: numeroFactura || 'PREVIEW',
        cliente_id: clienteSeleccionado?.id || 0,
        cliente_nombre: clienteSeleccionado?.nombre || '',
        subtotal: subtotalBruto,
        descuento: 0,
        iva_porcentaje: ivaPorcentaje,
        iva_importe: ivaImporte,
        irpf_porcentaje: irpfPorcentaje,
        irpf_importe: irpfImporte,
        total,
        notas,
        metodo_pago: metodoPago,
        fecha_vencimiento: fechaVencimiento,
        fecha_entrega: fechaEntrega,
        fecha: new Date().toISOString(),
        estado: 'pendiente',
      };

      const itemsConCalculos = itemsValidos.map(item => ({
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        unidad: item.unidad,
        precio_unitario: item.precio,
        descuento: item.descuento,
        subtotal: calcularSubtotalItem(item),
      }));

      const plantilla = await getPlantillaPDF();
      const uri = await generarPDFPreview(facturaPreview, itemsConCalculos, isPremium, plantilla, simboloMoneda, currentTheme.colors.primary);
      if (uri) {
        setPreviewUri(uri);
        setMostrarPreviewPdf(true);
      }
    } catch {
      Alert.alert(t('error'), t('no_se_pudo_generar_pdf'));
    } finally {
      setGenerandoPreview(false);
    }
  }

  async function handleExportarPDF() {
    // Verificar límite mensual (misma lógica que guardarFactura)
    if (!esModoEdicion && !isPremium && !limiteInfo.canCreate) {
      const diasRestH = getDiasRestantesMes();
      Alert.alert(
        t('limite_alcanzado'),
        t('limite_desc') + '\n\n' + t('se_renueva_en', { dias: diasRestH }),
        [
          { text: t('cancelar'), style: 'cancel' },
          { text: t('unlock_premium'), onPress: () => router.push('/(tabs)/ajustes') }
        ]
      );
      return;
    }

    if (!clienteSeleccionado) {
      Alert.alert(t('cliente_requerido'), t('selecciona_cliente'));
      return;
    }

    const itemsValidos = items.filter(i => i.descripcion.trim() && parseFloat(i.precio) > 0);
    if (itemsValidos.length === 0) {
      Alert.alert(t('sin_articulos'), t('anadir_articulo_valido'));
      return;
    }

    setGenerandoPDF(true);
    try {
      const numero = numeroFactura || getNextNumeroFactura();
      const subtotalEnEuros = await convertirAEurosParaGuardar(subtotalBruto, codigoMoneda);
      const ivaEnEuros = await convertirAEurosParaGuardar(ivaImporte, codigoMoneda);
      const irpfEnEuros = await convertirAEurosParaGuardar(irpfImporte, codigoMoneda);
      const totalEnEuros = await convertirAEurosParaGuardar(total, codigoMoneda);

      const isRewardedSave = pendingRewardedSave;
      if (pendingRewardedSave) setPendingRewardedSave(false);

      // 1. Generar PDF con datos de previsualización (sin guardar todavía)
      const facturaPreview = {
        id: 0,
        numero,
        cliente_id: clienteSeleccionado.id,
        cliente_nombre: clienteSeleccionado.nombre,
        subtotal: subtotalEnEuros, descuento: 0, iva_porcentaje: ivaPorcentaje,
        iva_importe: ivaEnEuros, irpf_porcentaje: irpfPorcentaje, irpf_importe: irpfEnEuros,
        total: totalEnEuros, notas, metodo_pago: metodoPago, fecha_vencimiento: fechaVencimiento,
        fecha_entrega: fechaEntrega,
        fecha: new Date().toISOString(), estado: 'pendiente',
      };

      const itemsConCalculos = itemsValidos.map(item => ({
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        unidad: item.unidad,
        precio_unitario: item.precio,
        descuento: item.descuento,
        subtotal: calcularSubtotalItem(item),
      }));

      const plantilla = await getPlantillaPDF();
      const uri = await generarPDFPreview(facturaPreview, itemsConCalculos, isPremium, plantilla, simboloMoneda, currentTheme.colors.primary);
      if (!uri) throw new Error('No se pudo generar el PDF');

      // 2. Compartir el PDF (si el usuario cancela, shareAsync lanza error)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Factura ${numero} - InvoiceRapid Pro`,
          UTI: 'com.adobe.pdf',
        });
      }

      // 3. Si llegamos aquí, el usuario compartió → guardar la factura
      if (esModoEdicion) {
        updateFactura(parseInt(facturaId!), {
          numero, cliente_id: clienteSeleccionado.id, cliente_nombre: clienteSeleccionado.nombre,
          subtotal: subtotalEnEuros, descuento: 0, iva_porcentaje: ivaPorcentaje,
          iva_importe: ivaEnEuros, irpf_porcentaje: irpfPorcentaje, irpf_importe: irpfEnEuros,
          total: totalEnEuros, notas, metodo_pago: metodoPago, fecha_vencimiento: fechaVencimiento,
          fecha_entrega: fechaEntrega,
        });
        deleteFacturaItems(parseInt(facturaId!));
        for (const item of itemsValidos) {
          const precioEnEuros = await convertirAEurosParaGuardar(parseFloat(item.precio) || 0, codigoMoneda);
          const descuentoEnEuros = await convertirAEurosParaGuardar(parseFloat(item.descuento) || 0, codigoMoneda);
          const subtotalItemEnEuros = await convertirAEurosParaGuardar(calcularSubtotalItem(item), codigoMoneda);
          insertFacturaItem({
            factura_id: parseInt(facturaId!), descripcion: item.descripcion,
            cantidad: parseFloat(item.cantidad) || 1, unidad: item.unidad,
            precio_unitario: precioEnEuros, descuento: descuentoEnEuros, subtotal: subtotalItemEnEuros,
          });
        }
      } else {
        const newId = insertFactura({
          numero, cliente_id: clienteSeleccionado.id, cliente_nombre: clienteSeleccionado.nombre,
          subtotal: subtotalEnEuros, descuento: 0, iva_porcentaje: ivaPorcentaje,
          iva_importe: ivaEnEuros, irpf_porcentaje: irpfPorcentaje, irpf_importe: irpfEnEuros,
          total: totalEnEuros, notas, metodo_pago: metodoPago, fecha_vencimiento: fechaVencimiento,
          fecha_entrega: fechaEntrega,
        });
        const yaTeniaPrimera = await AsyncStorage.getItem('ha_creado_primera_factura');
        await AsyncStorage.setItem('ha_creado_primera_factura', 'true');
        activarReferidoSiProcede();
        for (const item of itemsValidos) {
          const precioEnEuros = await convertirAEurosParaGuardar(parseFloat(item.precio) || 0, codigoMoneda);
          const descuentoEnEuros = await convertirAEurosParaGuardar(parseFloat(item.descuento) || 0, codigoMoneda);
          const subtotalItemEnEuros = await convertirAEurosParaGuardar(calcularSubtotalItem(item), codigoMoneda);
          insertFacturaItem({
            factura_id: newId as number, descripcion: item.descripcion,
            cantidad: parseFloat(item.cantidad) || 1, unidad: item.unidad,
            precio_unitario: precioEnEuros, descuento: descuentoEnEuros, subtotal: subtotalItemEnEuros,
          });
        }
        if (!isRewardedSave && !isPremium) await incrementInvoiceCounter();
        if (yaTeniaPrimera !== 'true' && !isPremium) {
          savingRef.current = true;
          router.push('/settings/referral' as any);
          return;
        }
      }

      // 4. Anuncio y volver atrás
      await adsService.incrementAction(isPremium);
      savingRef.current = true;
      router.back();
    } catch (e: any) {
      savingRef.current = false;
      // Si el usuario cancela el share, no hacer nada (no guardar, no alertar)
      if (e?.message?.includes('CANCELED') || e?.message?.includes('canceled') || e?.message?.includes('cancelled')) {
        return;
      }
      Alert.alert(t('error'), t('no_se_pudo_generar_pdf'));
    } finally {
      setGenerandoPDF(false);
    }
  }

  
  function getDiasRestantesMes(): number {
    const hoy = new Date();
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    return Math.ceil((ultimoDia.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  }

  async function guardarFactura() {
    // ── Límite alcanzado: mostrar opciones ──
    if (!esModoEdicion && !isPremium && !limiteInfo.canCreate && !pendingRewardedSave) {
      const remaining = await getRemainingRewardedAds();

      const buttons: any[] = [
        { text: t('cancelar'), style: 'cancel' },
      ];

      if (remaining > 0) {
        buttons.push({
          text: `${t('ver_anuncio')} (${remaining} ${t('hoy')})`,
          onPress: async () => {
            const rewarded = await adsService.showRewardedAd();
            if (rewarded) {
              await incrementRewardedAdCount();
              setPendingRewardedSave(true);
              Alert.alert(t('recompensa_recibida'), t('puedes_guardar_factura'), [
                { text: t('guardar'), onPress: () => guardarFactura() }
              ]);
            } else {
              // Mostrar mensaje específico según el tipo de error
              const errorType = adsService.lastRewardedError;
              if (errorType === 'no_fill') {
                Alert.alert(
                  t('sin_anuncios_disponibles'),
                  t('sin_anuncios_desc')
                );
              } else {
                Alert.alert(
                  t('anuncio_no_completado'),
                  t('intenta_de_nuevo')
                );
              }
            }
          },
        });
      }

      buttons.push({
        text: t('unlock_premium'),
        onPress: () => router.push('/(tabs)/ajustes'),
      });

      const diasRest = getDiasRestantesMes();
      const mensajeLimite = t('limite_desc') + '\n\n' + t('se_renueva_en', { dias: diasRest });
      Alert.alert(t('limite_alcanzado'), mensajeLimite, buttons);
      return;
    }

    // Si venimos de un rewarded ad, NO incrementamos el contador mensual
    const isRewardedSave = pendingRewardedSave;
    if (pendingRewardedSave) setPendingRewardedSave(false);

    // Para usuarios gratuitos en modo edición, verificar límite antes de editar
    if (esModoEdicion && !isPremium && !limiteInfo.canCreate) {
      const diasRestE = getDiasRestantesMes();
      Alert.alert(
        t('limite_alcanzado'),
        t('limite_desc') + '\n\n' + t('se_renueva_en', { dias: diasRestE }),
        [
          { text: t('cancelar'), style: 'cancel' },
          { text: t('unlock_premium'), onPress: () => router.push('/(tabs)/ajustes') }
        ]
      );
      return;
    }

    if (!clienteSeleccionado) {
      Alert.alert(t('cliente_requerido'), t('selecciona_cliente'));
      return;
    }

    const itemsValidos = items.filter(i => i.descripcion.trim() && parseFloat(i.precio) > 0);
    if (itemsValidos.length === 0) {
      Alert.alert(t('sin_articulos'), t('anadir_articulo_valido'));
      return;
    }

    try {
      const numero = numeroFactura || getNextNumeroFactura(numeracionConfig);

      // Convertir importes a euros para guardar en la base de datos
      const subtotalEnEuros = await convertirAEurosParaGuardar(subtotalBruto, codigoMoneda);
      const ivaEnEuros = await convertirAEurosParaGuardar(ivaImporte, codigoMoneda);
      const irpfEnEuros = await convertirAEurosParaGuardar(irpfImporte, codigoMoneda);
      const totalEnEuros = await convertirAEurosParaGuardar(total, codigoMoneda);

      if (esModoEdicion) {
        if (isPremium) {
          // Modo edición premium: actualizar factura existente
          updateFactura(parseInt(facturaId!), {
            numero,
            cliente_id: clienteSeleccionado.id,
            cliente_nombre: clienteSeleccionado.nombre,
            subtotal: subtotalEnEuros,
            descuento: 0,
            iva_porcentaje: ivaPorcentaje,
            iva_importe: ivaEnEuros,
            irpf_porcentaje: irpfPorcentaje,
            irpf_importe: irpfEnEuros,
            total: totalEnEuros,
            notas,
            metodo_pago: metodoPago,
            fecha_vencimiento: fechaVencimiento,
            fecha_entrega: fechaEntrega,
          });

          // Eliminar items existentes y insertar nuevos
          deleteFacturaItems(parseInt(facturaId!));
          for (const item of itemsValidos) {
            const precioEnEuros = await convertirAEurosParaGuardar(parseFloat(item.precio) || 0, codigoMoneda);
            const descuentoEnEuros = await convertirAEurosParaGuardar(parseFloat(item.descuento) || 0, codigoMoneda);
            const subtotalItemEnEuros = await convertirAEurosParaGuardar(calcularSubtotalItem(item), codigoMoneda);
            
            insertFacturaItem({
              factura_id: parseInt(facturaId!),
              descripcion: item.descripcion,
              cantidad: parseFloat(item.cantidad) || 1,
              unidad: item.unidad,
              precio_unitario: precioEnEuros,
              descuento: descuentoEnEuros,
              subtotal: subtotalItemEnEuros,
            });
          }

          // Mostrar anuncio intersticial cada 3 acciones
          await adsService.incrementAction(isPremium);

          savingRef.current = true;
          router.back();
          return;
        } else {
          // Modo edición gratis: crear nueva factura en lugar de actualizar
          const nuevoNumero = getNextNumeroFactura(numeracionConfig);
          const nuevaFacturaId = insertFactura({
            numero: nuevoNumero,
            cliente_id: clienteSeleccionado.id,
            cliente_nombre: clienteSeleccionado.nombre,
            subtotal: subtotalEnEuros,
            descuento: 0,
            iva_porcentaje: ivaPorcentaje,
            iva_importe: ivaEnEuros,
            irpf_porcentaje: irpfPorcentaje,
            irpf_importe: irpfEnEuros,
            total: totalEnEuros,
            notas,
            metodo_pago: metodoPago,
            fecha_vencimiento: fechaVencimiento,
            fecha_entrega: fechaEntrega,
          });

          // Checkear ANTES de setear el flag para saber si es la primera factura
          const yaTeniaPrimera = await AsyncStorage.getItem('ha_creado_primera_factura');
          
          // Guardar flag de primera factura creada
          await AsyncStorage.setItem('ha_creado_primera_factura', 'true');
          activarReferidoSiProcede();

          for (const item of itemsValidos) {
            const precioEnEuros = await convertirAEurosParaGuardar(parseFloat(item.precio) || 0, codigoMoneda);
            const descuentoEnEuros = await convertirAEurosParaGuardar(parseFloat(item.descuento) || 0, codigoMoneda);
            const subtotalItemEnEuros = await convertirAEurosParaGuardar(calcularSubtotalItem(item), codigoMoneda);
            
            insertFacturaItem({
              factura_id: nuevaFacturaId as number,
              descripcion: item.descripcion,
              cantidad: parseFloat(item.cantidad) || 1,
              unidad: item.unidad,
              precio_unitario: precioEnEuros,
              descuento: descuentoEnEuros,
              subtotal: subtotalItemEnEuros,
            });
          }

          // Incrementar contador mensual (solo si NO es un rewarded save y NO es premium)
          if (!isRewardedSave && !isPremium) await incrementInvoiceCounter();

          // Mostrar anuncio intersticial cada 3 acciones
          await adsService.incrementAction(isPremium);

          // Si es la primera factura, redirigir a la pantalla de invitar amigos
          savingRef.current = true;
          if (yaTeniaPrimera !== 'true' && !isPremium) {
            router.push('/settings/referral' as any);
          } else {
            router.back();
          }
          return;
        }
      } else {
        // Modo creación: insertar nueva factura
        const facturaId = insertFactura({
          numero,
          cliente_id: clienteSeleccionado.id,
          cliente_nombre: clienteSeleccionado.nombre,
          subtotal: subtotalEnEuros,
          descuento: 0,
          iva_porcentaje: ivaPorcentaje,
          iva_importe: ivaEnEuros,
          irpf_porcentaje: irpfPorcentaje,
          irpf_importe: irpfEnEuros,
          total: totalEnEuros,
          notas,
          metodo_pago: metodoPago,
          fecha_vencimiento: fechaVencimiento,
          fecha_entrega: fechaEntrega,
        });

        // Checkear ANTES de setear el flag
        const yaTeniaPrimera = await AsyncStorage.getItem('ha_creado_primera_factura');
        
        // Guardar flag de primera factura creada
        await AsyncStorage.setItem('ha_creado_primera_factura', 'true');
        activarReferidoSiProcede();

        for (const item of itemsValidos) {
          const precioEnEuros = await convertirAEurosParaGuardar(parseFloat(item.precio) || 0, codigoMoneda);
          const descuentoEnEuros = await convertirAEurosParaGuardar(parseFloat(item.descuento) || 0, codigoMoneda);
          const subtotalItemEnEuros = await convertirAEurosParaGuardar(calcularSubtotalItem(item), codigoMoneda);
          
          insertFacturaItem({
            factura_id: facturaId as number,
            descripcion: item.descripcion,
            cantidad: parseFloat(item.cantidad) || 1,
            unidad: item.unidad,
            precio_unitario: precioEnEuros,
            descuento: descuentoEnEuros,
            subtotal: subtotalItemEnEuros,
          });
        }

        // Incrementar contador mensual (solo si NO es rewarded save y NO es premium)
        if (!isRewardedSave && !isPremium) await incrementInvoiceCounter();

        // Mostrar anuncio intersticial cada 3 acciones
        await adsService.incrementAction(isPremium);

        // Si es la primera factura, redirigir a referidos
        savingRef.current = true;
        if (yaTeniaPrimera !== 'true' && !isPremium) {
          router.push('/settings/referral' as any);
        } else {
          router.back();
        }
      }
    } catch (e: any) {
      savingRef.current = false;
      Alert.alert(t('error'), `${t('error_guardar')}: ${e?.message || ''}`);
    }
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase())
  );

  async function activarReferidoSiProcede() {
    try {
      const codigo = await AsyncStorage.getItem('pending_referral_code');
      if (!codigo) return;

      // Verificar si el deadline de 12h ha expirado
      const deadline = await AsyncStorage.getItem('referral_code_deadline');
      if (deadline && Date.now() > new Date(deadline).getTime()) {
        // Deadline expirado, limpiar y no activar
        await AsyncStorage.removeItem('pending_referral_code');
        await AsyncStorage.removeItem('referral_code_deadline');
        return;
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const supabaseModule = await import('../../services/supabase');
      if (!supabaseModule.supabase) return;

      const { data: { session } } = await supabaseModule.supabase.auth.getSession();
      const userId = session?.user?.id;
      const userEmail = session?.user?.email;
      const accessToken = session?.access_token;
      if (!userId) return;

      // Buscar el dueño del código
      const { data: codeData } = await supabaseModule.supabase
        .from('referral_codes')
        .select('user_id')
        .eq('code', codigo)
        .maybeSingle();

      if (!codeData || codeData.user_id === userId) {
        await AsyncStorage.removeItem('pending_referral_code');
        return;
      }

      // Insertar evento pending con el email del usuario referido
      await supabaseModule.supabase
        .from('referral_events')
        .insert({
          referrer_id: codeData.user_id,
          referred_id: userId,
          referred_email: userEmail || null,
          code_used: codigo,
          status: 'pending',
        });

      // Llamar a la Edge Function para activar
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${supabaseUrl}/functions/v1/activate-referral`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ referred_user_id: userId }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return; // Si falla, mantener código para reintentar

      // Solo eliminar si la Edge Function respondió OK
      await AsyncStorage.removeItem('pending_referral_code');
    } catch {
      // Silencioso: no bloquear el flujo del usuario.
      // Si falla, pending_referral_code se mantiene para reintentar en la siguiente factura.
    }
  }

  function hayCambiosSinGuardar() {
    if (notas.trim().length > 0) return true;
    if (fechaEntrega.trim().length > 0) return true;
    if (clienteSeleccionado) return true;
    if (items.some(i => i.descripcion.trim().length > 0 || (parseFloat(i.precio) || 0) > 0)) return true;
    return false;
  }

  function handleSalir() {
    if (!hayCambiosSinGuardar()) {
      Alert.alert(t('salir_factura_titulo'), t('seguro_salir_factura'), [
        { text: t('cancelar'), style: 'cancel' },
        { text: t('salir'), onPress: () => { closingRef.current = true; router.back(); } }
      ]);
      return;
    }
    Alert.alert('', t('confirmar_salir_factura_cambios'), [
      { text: t('cancelar'), style: 'cancel' },
      { text: t('salir'), onPress: () => { closingRef.current = true; router.back(); } }
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
          <View style={[styles.screenHeaderRow, { borderBottomColor: currentTheme.colors.border ?? '#f0f0f0' }]}>
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: currentTheme.colors.card }]}
              onPress={handleSalir}
              accessibilityRole="button"
              accessibilityLabel={t('cerrar')}
            >
              <Ionicons name="close" size={24} color={currentTheme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.screenHeaderTitle, { color: currentTheme.colors.text }]} numberOfLines={1}>
              {esModoEdicion ? t('editar_factura') : t('nueva_factura')}
            </Text>
            <TouchableOpacity
              style={[styles.headerSavePill, { backgroundColor: currentTheme.colors.primary }]}
              onPress={guardarFactura}
              accessibilityRole="button"
              accessibilityLabel={t('guardar')}
            >
              <Text style={styles.headerSavePillText}>{t('guardar')}</Text>
            </TouchableOpacity>
          </View>

          {/* Límite mensual */}
          {!isPremium && (
            <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
              {limiteInfo.canCreate ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: currentTheme.colors.card, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: currentTheme.colors.border || '#f0f0f0' }}>
                  <Ionicons name="document-text-outline" size={14} color={currentTheme.colors.textSecondary} />
                  <Text style={{ fontSize: 12, color: currentTheme.colors.textSecondary, fontWeight: '500' }}>
                    {limiteInfo.currentCount} {t('de')} {limiteInfo.limit} {t('facturas_restantes')}
                  </Text>
                  <View style={{ flex: 1, height: 4, backgroundColor: (currentTheme.colors.border || '#e8e8e8'), borderRadius: 2, marginHorizontal: 4, maxWidth: 60 }}>
                    <View style={{ width: ((limiteInfo.currentCount / limiteInfo.limit) * 100 + '%') as any, height: 4, backgroundColor: '#FF9F43', borderRadius: 2 }} />
                  </View>
                </View>
              ) : (
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF3E0', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#FFB74D' }}>
                    <Ionicons name="alert-circle-outline" size={14} color="#FF4757" />
                    <Text style={{ fontSize: 12, color: '#FF4757', fontWeight: '600' }}>
                      {t('limite_alcanzado')} {'\u00b7'} {t('se_renueva_en', { dias: getDiasRestantesMes() })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: currentTheme.colors.primary + '12', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: currentTheme.colors.primary + '30' }}
                    onPress={() => router.push('/settings/referral' as any)}
                  >
                    <Ionicons name="gift-outline" size={16} color={currentTheme.colors.primary} />
                    <Text style={{ fontSize: 12, color: currentTheme.colors.primary, fontWeight: '600' }}>
                      {t('invitar_amigos_banner')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <ScrollView ref={scrollRef} style={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Número de factura */}
          <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('numero_factura')}</Text>
            <TextInput
              style={styles.input}
              placeholder="F-0001"
              placeholderTextColor="#bbb"
              value={numeroFactura}
              onChangeText={setNumeroFactura}
            />
          </View>

          {/* Cliente */}
          <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('cliente')}</Text>
            {clienteSeleccionado ? (
              <View>
                <TouchableOpacity style={styles.clienteSeleccionado} activeOpacity={0.7} onPress={abrirSelectorClientes}>
                  <View style={styles.clienteAvatar}>
                    <Text style={styles.clienteAvatarLetra}>
                      {clienteSeleccionado.nombre.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clienteNombre}>{clienteSeleccionado.nombre}</Text>
                    {clienteSeleccionado.email ? (
                      <Text style={styles.clienteEmail}>{clienteSeleccionado.email}</Text>
                    ) : null}
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
                <TouchableOpacity style={[styles.clienteBtn, { borderColor: currentTheme.colors.primary }]} activeOpacity={0.7} onPress={abrirSelectorClientes}>
                  <Ionicons name="person-outline" size={16} color={currentTheme.colors.primary} />
                  <Text style={[styles.clienteBtnTexto, { color: currentTheme.colors.primary }]}>{t('seleccionar_cliente')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.clienteBtn, styles.clienteBtnSecundario, { borderColor: currentTheme.colors.primary }]}
                  activeOpacity={0.7}
                  onPress={() => router.push("/(tabs)/clientes")}
                >
                  <Ionicons name="person-add-outline" size={16} color={currentTheme.colors.primary} />
                  <Text style={[styles.clienteBtnTexto, { color: currentTheme.colors.primary }]}>{t('anadir_cliente')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Fecha de vencimiento */}
          <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('fecha_vencimiento')}</Text>
            <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setMostrarDatePickerVencimiento(true)}>
              <Text style={{ color: fechaVencimiento ? currentTheme.colors.text : currentTheme.colors.textSecondary, fontSize: 15 }}>
                {fechaVencimiento || 'DD/MM/AAAA'}
              </Text>
            </TouchableOpacity>
            {fechaVencimiento ? (
              <TouchableOpacity style={{ position: 'absolute', right: 18, top: 52 }} onPress={() => setFechaVencimiento('')}>
                <Ionicons name="close-circle" size={18} color={currentTheme.colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
            {mostrarDatePickerVencimiento && (
              <DateTimePicker
                value={fechaVencimiento ? (() => { const parts = fechaVencimiento.split('/'); return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])); })() : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setMostrarDatePickerVencimiento(Platform.OS === 'ios');
                  if (selectedDate) {
                    const dia = String(selectedDate.getDate()).padStart(2, '0');
                    const mes = String(selectedDate.getMonth() + 1).padStart(2, '0');
                    const año = selectedDate.getFullYear();
                    setFechaVencimiento(`${dia}/${mes}/${año}`);
                  }
                }}
              />
            )}
          </View>

          {/* Fecha de entrega */}
          <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('fecha_entrega')}</Text>
            <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setMostrarDatePickerEntrega(true)}>
              <Text style={{ color: fechaEntrega ? currentTheme.colors.text : currentTheme.colors.textSecondary, fontSize: 15 }}>
                {fechaEntrega || 'DD/MM/AAAA'}
              </Text>
            </TouchableOpacity>
            {fechaEntrega ? (
              <TouchableOpacity style={{ position: 'absolute', right: 18, top: 52 }} onPress={() => setFechaEntrega('')}>
                <Ionicons name="close-circle" size={18} color={currentTheme.colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
            {mostrarDatePickerEntrega && (
              <DateTimePicker
                value={fechaEntrega ? (() => { const parts = fechaEntrega.split('/'); return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])); })() : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setMostrarDatePickerEntrega(Platform.OS === 'ios');
                  if (selectedDate) {
                    const dia = String(selectedDate.getDate()).padStart(2, '0');
                    const mes = String(selectedDate.getMonth() + 1).padStart(2, '0');
                    const año = selectedDate.getFullYear();
                    setFechaEntrega(`${dia}/${mes}/${año}`);
                  }
                }}
              />
            )}
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
                    style={styles.inputDescripcion}
                    placeholder={t('descripcion')}
                    placeholderTextColor="#bbb"
                    value={item.descripcion}
                    onChangeText={v => actualizarItem(item.id, "descripcion", v)}
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.botonProducto, { borderColor: currentTheme.colors.primary }]}
                    onPress={() => abrirSelectorProductos(item.id)}
                  >
                    <Ionicons name="cube-outline" size={20} color={currentTheme.colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.fila}>
                  <View style={styles.campoChico}>
                    <Text style={styles.campoLabel}>{t('cantidad')}</Text>
                    <TextInput
                      style={styles.inputChico}
                      placeholder="1"
                      placeholderTextColor="#bbb"
                      keyboardType="decimal-pad"
                      value={item.cantidad}
                      onChangeText={v => actualizarItem(item.id, "cantidad", v)}
                    />
                  </View>
                  <View style={styles.campoChico}>
                    <Text style={styles.campoLabel}>{t('unidad')}</Text>
                    <TouchableOpacity style={styles.inputChico} onPress={() => setMostrarUnidades(item.id)}>
                      <Text style={{ color: "#1a1a1a", fontSize: 15 }}>{item.unidad}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.campoChico}>
                    <Text style={styles.campoLabel}>{t('precio')} ({simboloMoneda})</Text>
                    <TextInput
                      style={styles.inputChico}
                      placeholder="0.00"
                      placeholderTextColor="#bbb"
                      keyboardType="decimal-pad"
                      value={item.precio}
                      onChangeText={v => actualizarItem(item.id, "precio", v)}
                    />
                  </View>
                </View>
                <View style={styles.filaDescuento}>
                  <Text style={styles.campoLabel}>{t('descuento')}</Text>
                  <View style={styles.descuentoInput}>
                    <TextInput
                      style={styles.inputDescuento}
                      placeholder="0"
                      placeholderTextColor="#ccc"
                      keyboardType="decimal-pad"
                      value={item.descuento}
                      onChangeText={v => actualizarItem(item.id, "descuento", v)}
                    />
                    <TouchableOpacity
                      style={styles.descuentoTipoBtn}
                      onPress={() => cambiarTipoDescuento(item.id, item.descuentoTipo === 'porcentaje' ? 'moneda' : 'porcentaje')}
                    >
                      <Text style={[styles.descuentoSymbol, { color: currentTheme.colors.primary }]}>{item.descuentoTipo === 'porcentaje' ? '%' : simboloMoneda}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.subtotalItem, { color: currentTheme.colors.primary }]}>= {calcularSubtotalItem(item).toFixed(2)} {simboloMoneda}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={[styles.addItemBtn, { borderColor: currentTheme.colors.primary }]} onPress={() => setItems(prev => [...prev, nuevoItem()])}>
              <Ionicons name="add-circle-outline" size={20} color={currentTheme.colors.primary} />
              <Text style={[styles.addItemTexto, { color: currentTheme.colors.primary }]}>{t('anadir_articulo')}</Text>
            </TouchableOpacity>
          </View>

          {/* Impuestos */}
          <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('impuestos')}</Text>
            <Text style={styles.campoLabel}>{t('iva')} (%)</Text>
            <View style={styles.ivaOpciones}>
              {[0, 4, 10, 21].map(opcion => (
                <TouchableOpacity
                  key={opcion}
                  style={[styles.ivaBtn, opcion === ivaPorcentaje && { backgroundColor: currentTheme.colors.primary, borderColor: currentTheme.colors.primary }]}
                  onPress={() => handleCambiarIva(opcion)}
                >
                  <Text style={[styles.ivaBtnTexto, opcion === ivaPorcentaje && styles.ivaBtnTextoActivo]}>{opcion}%</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="21"
              placeholderTextColor="#bbb"
              keyboardType="decimal-pad"
              value={ivaPorcentaje.toString()}
              onChangeText={(v) => handleCambiarIva(parseFloat(v) || 0)}
            />
            <Text style={[styles.campoLabel, { marginTop: 16 }]}>{t('irpf')} (%)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#bbb"
              keyboardType="decimal-pad"
              value={irpfPorcentaje.toString()}
              onChangeText={(v) => setIrpfPorcentaje(parseFloat(v) || 0)}
            />
          </View>

          {/* Totales */}
          <View style={[styles.seccionTotales, { backgroundColor: currentTheme.colors.card }]}>
            <View style={styles.totalFila}>
              <Text style={styles.totalLabel}>{t('subtotal')}</Text>
              <Text style={styles.totalValor}>{subtotalBruto.toFixed(2)} {simboloMoneda}</Text>
            </View>
            <View style={styles.totalFila}>
              <Text style={styles.totalLabel}>{t('iva')} ({ivaPorcentaje}%)</Text>
              <Text style={styles.totalValor}>+{ivaImporte.toFixed(2)} {simboloMoneda}</Text>
            </View>
            {irpfPorcentaje > 0 && (
              <View style={styles.totalFila}>
                <Text style={styles.totalLabel}>{t('irpf')} ({irpfPorcentaje}%)</Text>
                <Text style={[styles.totalValor, { color: currentTheme.colors.error }]}>-{irpfImporte.toFixed(2)} {simboloMoneda}</Text>
              </View>
            )}
            <View style={[styles.totalFila, styles.totalFilaFinal]}>
              <Text style={styles.totalLabelFinal}>{t('total')}</Text>
              <Text style={[styles.totalValorFinal, { color: currentTheme.colors.primary }]}>{total.toFixed(2)} {simboloMoneda}</Text>
            </View>
          </View>

          {/* Método de pago */}
          <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('metodo_pago')}</Text>
            <View style={styles.pagoOpciones}>
              {[
                { id: "efectivo", label: t('efectivo').charAt(0).toUpperCase() + t('efectivo').slice(1), icon: "cash-outline" },
                { id: "transferencia", label: t('transferencia').charAt(0).toUpperCase() + t('transferencia').slice(1), icon: "swap-horizontal-outline" },
                { id: "bizum", label: t('bizum').charAt(0).toUpperCase() + t('bizum').slice(1), icon: "phone-portrait-outline" },
                { id: "tarjeta", label: t('tarjeta').charAt(0).toUpperCase() + t('tarjeta').slice(1), icon: "card-outline" },
              ].map(op => (
                <TouchableOpacity
                  key={op.id}
                  style={[styles.pagoBtn, metodoPago === op.id && styles.pagoBtnActivo]}
                  onPress={() => setMetodoPago(op.id)}
                >
                  <Ionicons name={op.icon as any} size={20} color={metodoPago === op.id ? currentTheme.colors.primary : "#aaa"} />
                  <Text style={[styles.pagoBtnTexto, metodoPago === op.id && styles.pagoBtnTextoActivo]}>
                    {op.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Notas */}
          <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('notas')}</Text>
            <TextInput
              style={[styles.input, styles.inputNotas]}
              placeholder={t('notas_placeholder')}
              placeholderTextColor="#bbb"
              value={notas}
              onChangeText={setNotas}
              multiline
              numberOfLines={4}
            />
          </View>

          <TouchableOpacity style={[styles.botonGuardar, { backgroundColor: currentTheme.colors.primary }]} onPress={guardarFactura}>
            <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
            <Text style={styles.botonGuardarTexto}>{t('guardar_factura')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.botonGuardar,
              styles.botonExportarPdf,
              { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.primary }
            ]}
            onPress={handleVistaPrevia}
            disabled={generandoPreview}
          >
            <Ionicons name="eye-outline" size={22} color={currentTheme.colors.primary} />
            <Text style={[styles.botonGuardarTexto, { color: currentTheme.colors.primary }]}>{generandoPreview ? '...' : t('numeracion_vista_previa')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.botonGuardar,
              styles.botonExportarPdf,
              { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.primary }
            ]}
            onPress={handleExportarPDF}
            disabled={generandoPDF}
          >
            <Ionicons name="document-text-outline" size={22} color={currentTheme.colors.primary} />
            <Text style={[styles.botonGuardarTexto, { color: currentTheme.colors.primary }]}>{t('exportar_pdf')}</Text>
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
              <TouchableOpacity onPress={() => setMostrarClientes(false)}>
                <Ionicons name="close" size={26} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Ionicons name="search" size={18} color="#888" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder={t('buscar_cliente')}
                placeholderTextColor="#aaa"
                value={busquedaCliente}
                onChangeText={setBusquedaCliente}
              />
            </View>
            <ScrollView>
              {clientesFiltrados.length === 0 ? (
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyTexto}>{t('no_hay_clientes')}</Text>
                </View>
              ) : (
                clientesFiltrados.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.modalClienteItem}
                    onPress={() => { setClienteSeleccionado(c); setMostrarClientes(false); }}
                  >
                    <View style={styles.clienteAvatar}>
                      <Text style={styles.clienteAvatarLetra}>{c.nombre.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View>
                      <Text style={styles.modalClienteNombre}>{c.nombre}</Text>
                      {c.email ? <Text style={styles.modalClienteEmail}>{c.email}</Text> : null}
                    </View>
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
              <TouchableOpacity onPress={() => setMostrarUnidades(null)}>
                <Ionicons name="close" size={26} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
            {UNIDADES.map(u => (
              <TouchableOpacity
                key={u}
                style={styles.unidadItem}
                onPress={() => { if (mostrarUnidades) actualizarItem(mostrarUnidades, "unidad", u); setMostrarUnidades(null); }}
              >
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
              <TouchableOpacity onPress={() => setMostrarProductos(false)}>
                <Ionicons name="close" size={26} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Ionicons name="search" size={18} color="#888" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder={t('buscar_producto')}
                placeholderTextColor="#aaa"
                value={busquedaProducto}
                onChangeText={setBusquedaProducto}
              />
            </View>
            <ScrollView>
              {productos.filter(p => p.descripcion.toLowerCase().includes(busquedaProducto.toLowerCase())).length === 0 ? (
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyTexto}>{t('no_productos')}</Text>
                </View>
              ) : (
                productos
                  .filter(p => p.descripcion.toLowerCase().includes(busquedaProducto.toLowerCase()))
                  .map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.modalProductoItem}
                      onPress={() => seleccionarProducto(p)}
                    >
                      <View style={styles.productoIcono}>
                        <Ionicons name="cube-outline" size={24} color={currentTheme.colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalProductoNombre}>{p.descripcion}</Text>
                        <Text style={styles.modalProductoInfo}>{p.precio} {simboloMoneda} / {p.unidad}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
              )}
            </ScrollView>
          </View>
        </Modal>

        {/* Modal paywall premium */}
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
                  <Ionicons name="diamond" size={48} color={currentTheme.colors.primary} />
                </View>
                <Text style={styles.paywallTitulo}>{t('premium_titulo')}</Text>
                <Text style={styles.paywallSub}>{t('premium_sub')}</Text>
              </View>
              <View style={styles.paywallCaracteristicas}>
                <View style={styles.paywallCaracteristica}>
                  <Ionicons name="checkmark-circle" size={20} color="#26de81" />
                  <Text style={styles.paywallCaracteristicaTexto}>{t('facturas_ilimitadas')}</Text>
                </View>
                <View style={styles.paywallCaracteristica}>
                  <Ionicons name="checkmark-circle" size={20} color="#26de81" />
                  <Text style={styles.paywallCaracteristicaTexto}>{t('pdf_sin_marca')}</Text>
                </View>
                <View style={styles.paywallCaracteristica}>
                  <Ionicons name="checkmark-circle" size={20} color="#26de81" />
                  <Text style={styles.paywallCaracteristicaTexto}>{t('logo_personalizado')}</Text>
                </View>
                <View style={styles.paywallCaracteristica}>
                  <Ionicons name="checkmark-circle" size={20} color="#26de81" />
                  <Text style={styles.paywallCaracteristicaTexto}>{t('plantillas_premium')}</Text>
                </View>
                <View style={styles.paywallCaracteristica}>
                  <Ionicons name="checkmark-circle" size={20} color="#26de81" />
                  <Text style={styles.paywallCaracteristicaTexto}>{t('sin_anuncios')}</Text>
                </View>
              </View>
              {offerings && offerings.availablePackages && offerings.availablePackages.length > 0 ? (
                <View style={styles.paywallPlanes}>
                  {offerings.availablePackages.map((pkg: any) => (
                    <TouchableOpacity
                      key={pkg.identifier}
                      style={[styles.paywallPlan, { borderColor: planSeleccionado?.identifier === pkg.identifier ? currentTheme.colors.primary : '#e8e8e8', backgroundColor: planSeleccionado?.identifier === pkg.identifier ? currentTheme.colors.primary + '10' : '#fff' }]}
                      onPress={() => setPlanSeleccionado(pkg)}
                      disabled={comprando}
                    >
                      <Text style={[styles.paywallPlanTitulo, { color: planSeleccionado?.identifier === pkg.identifier ? currentTheme.colors.primary : '#1a1a1a' }]}>{pkg.packageType === 'ANNUAL' ? t('anual') : t('mensual')}</Text>
                      <Text style={[styles.paywallPlanPrecio, { color: planSeleccionado?.identifier === pkg.identifier ? currentTheme.colors.primary : '#1a1a1a' }]}>{pkg.product.priceString}</Text>
                      {pkg.packageType === 'ANNUAL' && (
                        <Text style={[styles.paywallPlanRecomendado, { color: currentTheme.colors.primary }]}>{t('recomendado')}</Text>
                      )}
                      {planSeleccionado?.identifier === pkg.identifier && (
                        <View style={styles.checkmarkContainer}>
                          <Ionicons name="checkmark-circle" size={24} color={currentTheme.colors.primary} />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <TouchableOpacity 
                style={[styles.paywallDesbloquear, { opacity: planSeleccionado ? 1 : 0.5, backgroundColor: currentTheme.colors.primary }]} 
                onPress={() => planSeleccionado && handleComprar(planSeleccionado)}
                disabled={!planSeleccionado || comprando}
              >
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
              <TouchableOpacity style={styles.previewCloseBtn} onPress={() => { setMostrarPreviewPdf(false); setPreviewUri(null); }}>
                <Ionicons name="close" size={22} color={currentTheme.colors.text} />
              </TouchableOpacity>
              <Text style={[styles.previewTitle, { color: currentTheme.colors.text }]}>{t('numeracion_vista_previa')}</Text>
              <View style={{ width: 36 }} />
            </View>
            {previewUri ? (
              <Pdf source={{ uri: previewUri }} style={{ flex: 1 }} />
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
  screenHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  screenHeaderTitle: {
    flex: 1,
    marginHorizontal: 8,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
  },
  headerSavePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSavePillText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  scroll: { flex: 1 },
  seccion: { backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, marginBottom: 16, padding: 18 },
  seccionPrimera: { borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: 0 },
  seccionTitulo: { fontSize: 16, fontWeight: "700", color: "#1a1a1a", marginBottom: 14 },
  clienteBtns: { flexDirection: "row", gap: 10 },
  clienteBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8, backgroundColor: "#fff" },
  clienteBtnSecundario: { backgroundColor: "#fff" },
  clienteBtnTexto: { fontWeight: "600", fontSize: 12 },
  clienteSeleccionado: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F8F7FF", borderRadius: 12, padding: 12 },
  clienteAvatar: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center", backgroundColor: "#007AFF" },
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
  descuentoTipoBtn: { paddingHorizontal: 6, paddingVertical: 6, backgroundColor: "#f5f5f5", borderRadius: 6, marginLeft: 8 },
  descuentoSymbol: { fontSize: 15, fontWeight: "700" },
  subtotalItem: { fontSize: 14, fontWeight: "700", minWidth: 80, textAlign: "right" },
  addItemBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderStyle: "dashed", borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  addItemTexto: { fontWeight: "600", fontSize: 14 },
  ivaOpciones: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  ivaBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#e8e8e8", backgroundColor: "#fff" },
  ivaBtnActivo: { borderColor: "#007AFF" },
  ivaBtnTexto: { color: "#888", fontWeight: "600", fontSize: 14 },
  ivaBtnTextoActivo: { color: "#fff" },
  seccionTotales: { backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, marginBottom: 16, padding: 18 },
  totalFila: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  totalLabel: { fontSize: 14, color: "#888" },
  totalValor: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  totalFilaFinal: { borderTopWidth: 1.5, borderTopColor: "#f0f0f0", paddingTop: 14, marginTop: 4 },
  totalLabelFinal: { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },
  totalValorFinal: { fontSize: 22, fontWeight: "800" },
  pagoOpciones: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
  pagoBtn: { width: "47%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: "#e8e8e8", backgroundColor: "#fff" },
  pagoBtnActivo: { borderColor: "#007AFF", backgroundColor: "#EEE9FF" },
  pagoBtnTexto: { fontSize: 13, color: "#aaa", fontWeight: "600" },
  pagoBtnTextoActivo: { color: "#007AFF" },
  botonGuardar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginHorizontal: 16, borderRadius: 16, paddingVertical: 18 },
  botonExportarPdf: { marginTop: 12, borderWidth: 1.5 },
  botonGuardarTexto: { color: "#fff", fontWeight: "800", fontSize: 17 },
  premiumBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginHorizontal: 16, marginTop: 12, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  premiumBannerTextoContainer: { flex: 1 },
  premiumBannerTitulo: { color: "#fff", fontWeight: "700", fontSize: 14 },
  premiumBannerSub: { color: "rgba(255,255,255,0.8)", fontSize: 11 },
  premiumBannerTexto: { color: "#fff", fontWeight: "600", fontSize: 13 },
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
});