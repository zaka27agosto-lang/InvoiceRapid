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
    View,
} from "react-native";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useTheme } from "../../contexts/ThemeContext";
import { generarYCompartirPDF } from "../../utils/pdf";
import { getMoneda, getPlantillaPDF } from "../../utils/settings";
import { checkInvoiceLimitAsync, incrementInvoiceCounter } from "../../utils/subscription";
import { getClientes } from "../db/clientes";
import { deleteFacturaItems, getFactura, getFacturaItems, getFacturas, getNextNumeroFactura, insertFactura, insertFacturaItem, updateFactura } from "../db/facturas";
import { getProductos } from "../db/productos";

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
  const [comprando, setComprando] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);
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
  const [simboloMoneda, setSimboloMoneda] = useState("€");
  const [limiteInfo, setLimiteInfo] = useState<{ canCreate: boolean; currentCount: number; limit: number }>({ canCreate: true, currentCount: 0, limit: 15 });
  const [totalFacturas, setTotalFacturas] = useState(0);
  const [numeroFactura, setNumeroFactura] = useState("");
  const [navegandoFuera, setNavegandoFuera] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTotalFacturas((getFacturas() as any[]).length);
    getMoneda().then(m => setSimboloMoneda(m.simbolo));
    checkInvoiceLimitAsync().then(setLimiteInfo);
    // Cargar IVA guardado
    AsyncStorage.getItem('ultimo_iva').then(iva => {
      if (iva) setIvaPorcentaje(parseFloat(iva));
    });

    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // No prevenir la navegación si no hay cliente seleccionado o el modal está abierto
      if (!hayCambiosSinGuardar() || mostrarClientes) {
        return;
      }

      // Prevenir la navegación por defecto
      e.preventDefault();

      Alert.alert(
        t('salir_sin_guardar'),
        t('cambios_sin_guardar'),
        [
          { text: t('cancelar'), style: 'cancel' },
          { text: t('salir_sin_guardar'), style: 'destructive', onPress: () => navigation.dispatch(e.data.action) }
        ]
      );
    });

    return unsubscribe;
  }, [navigation, clienteSeleccionado, mostrarClientes]);

  useFocusEffect(
    useCallback(() => {
      // Scroll al inicio sin animación
      scrollRef.current?.scrollTo({ y: 0, animated: false });

      // Recargar moneda
      getMoneda().then(m => setSimboloMoneda(m.simbolo));

      if (facturaId) {
        cargarFactura(parseInt(facturaId));
      } else {
        setNumeroFactura(getNextNumeroFactura());
        reiniciarFormulario();
      }
    }, [facturaId])
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
    // Cargar IVA guardado en lugar de resetear a 21
    AsyncStorage.getItem('ultimo_iva').then(iva => {
      if (iva) setIvaPorcentaje(parseFloat(iva));
    });
    setIrpfPorcentaje(0);
    setNotas("");
    setMetodoPago("efectivo");
    setFechaVencimiento("");
    setNumeroFactura(getNextNumeroFactura());
  }

  function cargarFactura(id: number) {
    const factura = getFactura(id) as any;
    if (!factura) {
      Alert.alert(t('error'), t('factura_no_encontrada'));
      router.back();
      return;
    }

    const facturaItems = getFacturaItems(id) as any[];

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

  async function handleExportarPDF() {
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
      const facturaTemporal = {
        id: esModoEdicion ? parseInt(facturaId!) : 0,
        numero: numeroFactura || getNextNumeroFactura(),
        cliente_id: clienteSeleccionado.id,
        cliente_nombre: clienteSeleccionado.nombre,
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
      await generarYCompartirPDF(facturaTemporal, itemsConCalculos, isPremium, plantilla, simboloMoneda);
    } catch (e) {
      Alert.alert(t('error'), t('no_se_pudo_generar_pdf'));
    } finally {
      setGenerandoPDF(false);
    }
  }

  async function guardarFactura() {
    if (!esModoEdicion && !isPremium && !limiteInfo.canCreate) {
      Alert.alert(
        t('limite_alcanzado'),
        t('limite_desc'),
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
      const numero = numeroFactura || getNextNumeroFactura();

      if (esModoEdicion) {
        // Modo edición: actualizar factura existente
        updateFactura(parseInt(facturaId!), {
          numero,
          cliente_id: clienteSeleccionado.id,
          cliente_nombre: clienteSeleccionado.nombre,
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
        });

        // Eliminar items existentes y insertar nuevos
        deleteFacturaItems(parseInt(facturaId!));
        itemsValidos.forEach(item => {
          insertFacturaItem({
            factura_id: parseInt(facturaId!),
            descripcion: item.descripcion,
            cantidad: parseFloat(item.cantidad) || 1,
            unidad: item.unidad,
            precio_unitario: parseFloat(item.precio) || 0,
            descuento: parseFloat(item.descuento) || 0,
            subtotal: calcularSubtotalItem(item),
          });
        });

        Alert.alert(`✅ ${t('factura_actualizada')}`, `${numero} ${t('factura_guardada')}`, [
          { text: "OK", onPress: () => router.back() }
        ]);
      } else {
        // Modo creación: insertar nueva factura
        const facturaId = insertFactura({
          numero,
          cliente_id: clienteSeleccionado.id,
          cliente_nombre: clienteSeleccionado.nombre,
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
        });

        // Guardar flag de primera factura creada
        await AsyncStorage.setItem('ha_creado_primera_factura', 'true');

        itemsValidos.forEach(item => {
          insertFacturaItem({
            factura_id: facturaId as number,
            descripcion: item.descripcion,
            cantidad: parseFloat(item.cantidad) || 1,
            unidad: item.unidad,
            precio_unitario: parseFloat(item.precio) || 0,
            descuento: parseFloat(item.descuento) || 0,
            subtotal: calcularSubtotalItem(item),
          });
        });

        // Incrementar contador acumulativo de facturas
        incrementInvoiceCounter();

        Alert.alert(t('factura_creada'), `${numero} ${t('factura_guardada')}`, [
          { text: t('ok'), onPress: () => router.back() }
        ]);
      }
    } catch (e: any) {
      console.log("Error:", e?.message);
      Alert.alert(t('error'), `${t('error_guardar')}: ${e?.message || ''}`);
    }
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase())
  );

  function hayCambiosSinGuardar() {
    // Solo verificar si hay cliente seleccionado
    return !!clienteSeleccionado;
  }

  function handleSalir() {
    if (hayCambiosSinGuardar()) {
      Alert.alert(
        t('salir_sin_guardar'),
        t('cambios_sin_guardar'),
        [
          { text: t('cancelar'), style: 'cancel' },
          { text: t('salir_sin_guardar'), style: 'destructive', onPress: () => router.back() }
        ]
      );
    } else {
      router.back();
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>

        <View style={[styles.header, { backgroundColor: currentTheme.colors.card }]}>
          <TouchableOpacity style={styles.backBtn} onPress={handleSalir}>
            <Ionicons name="arrow-back" size={22} color={currentTheme.colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>{esModoEdicion ? t('editar') : t('nueva_factura_titulo')}</Text>
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: currentTheme.colors.primary }]} onPress={guardarFactura}>
            <Text style={styles.saveBtnTexto}>{t('guardar')}</Text>
          </TouchableOpacity>
        </View>

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
                <TouchableOpacity style={styles.clienteBtn} activeOpacity={0.7} onPress={abrirSelectorClientes}>
                  <Ionicons name="person-outline" size={16} color="#6C47FF" />
                  <Text style={styles.clienteBtnTexto}>{t('seleccionar_cliente')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.clienteBtn, styles.clienteBtnSecundario]}
                  activeOpacity={0.7}
                  onPress={() => router.push("/(tabs)/clientes")}
                >
                  <Ionicons name="person-add-outline" size={16} color="#6C47FF" />
                  <Text style={styles.clienteBtnTexto}>{t('anadir_cliente')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Artículos */}
          <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('articulos')}</Text>
            {items.map((item, index) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemNumero}>{t('articulo')} {index + 1}</Text>
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
                    style={styles.botonProducto}
                    onPress={() => abrirSelectorProductos(item.id)}
                  >
                    <Ionicons name="cube-outline" size={20} color="#6C47FF" />
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
                      <Text style={styles.descuentoSymbol}>{item.descuentoTipo === 'porcentaje' ? '%' : simboloMoneda}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.subtotalItem}>= {calcularSubtotalItem(item).toFixed(2)} {simboloMoneda}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.addItemBtn} onPress={() => setItems(prev => [...prev, nuevoItem()])}>
              <Ionicons name="add-circle-outline" size={20} color="#6C47FF" />
              <Text style={styles.addItemTexto}>{t('anadir_articulo')}</Text>
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
                  style={[styles.ivaBtn, ivaPorcentaje === opcion && styles.ivaBtnActivo]}
                  onPress={() => handleCambiarIva(opcion)}
                >
                  <Text style={[styles.ivaBtnTexto, ivaPorcentaje === opcion && styles.ivaBtnTextoActivo]}>
                    {opcion}%
                  </Text>
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
                <Text style={[styles.totalValor, { color: "#FF4757" }]}>-{irpfImporte.toFixed(2)} {simboloMoneda}</Text>
              </View>
            )}
            <View style={[styles.totalFila, styles.totalFilaFinal]}>
              <Text style={styles.totalLabelFinal}>{t('total')}</Text>
              <Text style={styles.totalValorFinal}>{total.toFixed(2)} {simboloMoneda}</Text>
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
                  <Ionicons name={op.icon as any} size={20} color={metodoPago === op.id ? "#6C47FF" : "#aaa"} />
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

          <TouchableOpacity style={styles.botonGuardar} onPress={guardarFactura}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.botonGuardarTexto}>{t('guardar_factura')}</Text>
          </TouchableOpacity>

          <View style={styles.accionesRow}>
            <TouchableOpacity style={[styles.accionBtn, { backgroundColor: currentTheme.colors.card }]} onPress={handleExportarPDF} disabled={generandoPDF}>
              <Ionicons name="document-text-outline" size={20} color={currentTheme.colors.primary} />
              <Text style={[styles.accionBtnTexto, { color: currentTheme.colors.primary }]}>{t('exportar_pdf')}</Text>
            </TouchableOpacity>
          </View>

          {!isPremium && (
            <TouchableOpacity style={[styles.premiumBanner, { backgroundColor: "#6C47FF" }]} onPress={() => setMostrarPaywall(true)}>
              <Ionicons name="diamond-outline" size={20} color="#fff" />
              <View style={styles.premiumBannerTextoContainer}>
                <Text style={styles.premiumBannerTitulo}>Desbloquear PDF PRO</Text>
                <Text style={styles.premiumBannerSub}>Ilimitadas y sin marcas de agua</Text>
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
                        <Ionicons name="cube-outline" size={24} color="#6C47FF" />
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
                  <Ionicons name="diamond" size={48} color="#6C47FF" />
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
                      style={[styles.paywallPlan, { borderColor: planSeleccionado?.identifier === pkg.identifier ? '#6C47FF' : pkg.packageType === 'ANNUAL' ? '#6C47FF' : '#e8e8e8', backgroundColor: planSeleccionado?.identifier === pkg.identifier ? '#6C47FF10' : '#fff' }]}
                      onPress={() => setPlanSeleccionado(pkg)}
                      disabled={comprando}
                    >
                      <Text style={[styles.paywallPlanTitulo, { color: planSeleccionado?.identifier === pkg.identifier ? '#6C47FF' : '#1a1a1a' }]}>{pkg.packageType === 'ANNUAL' ? t('anual') : pkg.packageType === 'MONTHLY' ? t('mensual') : t('lifetime')}</Text>
                      <Text style={[styles.paywallPlanPrecio, { color: planSeleccionado?.identifier === pkg.identifier ? '#6C47FF' : '#1a1a1a' }]}>{pkg.product.priceString}</Text>
                      {pkg.packageType === 'ANNUAL' && (
                        <Text style={styles.paywallPlanRecomendado}>{t('recomendado')}</Text>
                      )}
                      {planSeleccionado?.identifier === pkg.identifier && (
                        <View style={styles.checkmarkContainer}>
                          <Ionicons name="checkmark-circle" size={24} color="#6C47FF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <TouchableOpacity 
                style={[styles.paywallDesbloquear, { opacity: planSeleccionado ? 1 : 0.5 }]} 
                onPress={() => planSeleccionado && handleComprar(planSeleccionado)}
                disabled={!planSeleccionado || comprando}
              >
                <Text style={styles.paywallDesbloquearTexto}>{t('desbloquear')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.paywallRestaurar} onPress={handleRestaurar}>
                <Text style={styles.paywallRestaurarTexto}>{t('restaurar')}</Text>
              </TouchableOpacity>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </Modal>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F8F7FF", paddingTop: 55 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#EEE9FF", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },
  saveBtn: { backgroundColor: "#6C47FF", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  saveBtnTexto: { color: "#fff", fontWeight: "700", fontSize: 14 },
  scroll: { flex: 1 },
  seccion: { backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, marginBottom: 16, padding: 18 },
  seccionTitulo: { fontSize: 16, fontWeight: "700", color: "#1a1a1a", marginBottom: 14 },
  clienteBtns: { flexDirection: "row", gap: 10 },
  clienteBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderColor: "#6C47FF", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8, backgroundColor: "#fff" },
  clienteBtnSecundario: { backgroundColor: "#fff" },
  clienteBtnTexto: { color: "#6C47FF", fontWeight: "600", fontSize: 12 },
  clienteSeleccionado: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F8F7FF", borderRadius: 12, padding: 12 },
  clienteAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#6C47FF", justifyContent: "center", alignItems: "center" },
  clienteAvatarLetra: { color: "#fff", fontSize: 18, fontWeight: "700" },
  clienteNombre: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  clienteEmail: { fontSize: 12, color: "#888", marginTop: 2 },
  quitarClienteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, paddingVertical: 8 },
  quitarClienteTexto: { fontSize: 13, color: "#FF4757", fontWeight: "600" },
  itemCard: { backgroundColor: "#F8F7FF", borderRadius: 12, padding: 14, marginBottom: 12 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  itemNumero: { fontSize: 13, fontWeight: "700", color: "#6C47FF" },
  descripcionContainer: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  inputDescripcion: { flex: 1, borderWidth: 1.5, borderColor: "#e8e8e8", borderRadius: 10, padding: 12, fontSize: 15, color: "#1a1a1a", backgroundColor: "#fff", minHeight: 44 },
  botonProducto: { width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: "#6C47FF", backgroundColor: "#EEE9FF", justifyContent: "center", alignItems: "center" },
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
  descuentoSymbol: { fontSize: 15, color: "#6C47FF", fontWeight: "700" },
  subtotalItem: { fontSize: 14, fontWeight: "700", color: "#6C47FF", minWidth: 80, textAlign: "right" },
  addItemBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: "#6C47FF", borderStyle: "dashed", borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  addItemTexto: { color: "#6C47FF", fontWeight: "600", fontSize: 14 },
  ivaOpciones: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  ivaBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#e8e8e8", backgroundColor: "#fff" },
  ivaBtnActivo: { backgroundColor: "#6C47FF", borderColor: "#6C47FF" },
  ivaBtnTexto: { color: "#888", fontWeight: "600", fontSize: 14 },
  ivaBtnTextoActivo: { color: "#fff" },
  seccionTotales: { backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, marginBottom: 16, padding: 18 },
  totalFila: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  totalLabel: { fontSize: 14, color: "#888" },
  totalValor: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  totalFilaFinal: { borderTopWidth: 1.5, borderTopColor: "#f0f0f0", paddingTop: 14, marginTop: 4 },
  totalLabelFinal: { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },
  totalValorFinal: { fontSize: 22, fontWeight: "800", color: "#6C47FF" },
  pagoOpciones: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pagoBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: "#e8e8e8", backgroundColor: "#fff" },
  pagoBtnActivo: { borderColor: "#6C47FF", backgroundColor: "#EEE9FF" },
  pagoBtnTexto: { fontSize: 13, color: "#aaa", fontWeight: "600" },
  pagoBtnTextoActivo: { color: "#6C47FF" },
  botonGuardar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#6C47FF", marginHorizontal: 16, borderRadius: 16, paddingVertical: 18, shadowColor: "#6C47FF", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12 },
  botonGuardarTexto: { color: "#fff", fontWeight: "800", fontSize: 17 },
  accionesRow: { flexDirection: "row", gap: 12, marginHorizontal: 16, marginTop: 12 },
  accionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12, gap: 8 },
  accionBtnTexto: { fontSize: 14, fontWeight: "700" },
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
  paywallPlanPrecio: { fontSize: 24, fontWeight: "800", color: "#6C47FF", marginBottom: 4 },
  paywallPlanRecomendado: { fontSize: 11, fontWeight: "700", color: "#6C47FF", textTransform: "uppercase" },
  checkmarkContainer: { position: "absolute", top: 10, right: 10 },
  paywallDesbloquear: { backgroundColor: "#6C47FF", marginHorizontal: 20, marginTop: 20, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  paywallDesbloquearTexto: { color: "#fff", fontSize: 16, fontWeight: "800" },
  paywallRestaurar: { alignItems: "center", paddingVertical: 20 },
  paywallRestaurarTexto: { fontSize: 15, color: "#6C47FF", fontWeight: "600" },
});