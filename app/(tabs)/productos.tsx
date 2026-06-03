import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useTheme } from "../../contexts/ThemeContext";
import { adsService } from "../../services/adsService";
import { syncService } from "../../services/syncService";
import SwipeNavigation from "../../components/SwipeNavigation";
import { convertirDeEurosParaMostrar } from "../../utils/currency";
import { getMoneda } from "../../utils/settings";
import { deleteProducto, getProductos, insertProducto, updateProducto } from "../db/productos";
import { useSync } from "../../hooks/useSync";

type Producto = {
  id: number;
  descripcion: string;
  precio: number;
  unidad: string;
};

export default function Productos() {
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
  const { isPremium } = useSubscription();
  const { lastSync } = useSync();
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [formulario, setFormulario] = useState({
    descripcion: "",
    precio: "",
    unidad: "ud"
  });
  const [simboloMoneda, setSimboloMoneda] = useState("€");
  const [productosConvertidos, setProductosConvertidos] = useState<Producto[]>([]);

  const tabOrder = ['/(tabs)/index', '/(tabs)/documentos', '/(tabs)/clientes', '/(tabs)/productos', '/(tabs)/informes', '/(tabs)/ajustes'];

  const navigateToNextTab = () => {
    const currentIndex = tabOrder.indexOf('/(tabs)/productos');
    if (currentIndex < tabOrder.length - 1) {
      router.push(tabOrder[currentIndex + 1] as any);
    }
  };

  const navigateToPreviousTab = () => {
    const currentIndex = tabOrder.indexOf('/(tabs)/productos');
    if (currentIndex > 0) {
      router.push(tabOrder[currentIndex - 1] as any);
    }
  };

  const cargarProductos = useCallback(async () => {
    const productosData = getProductos();
    setProductos(productosData);
    try {
      const m = await getMoneda();
      setSimboloMoneda(m.simbolo);
      const convertidos = await Promise.all(
        productosData.map(async (producto) => ({
          ...producto,
          precio: await convertirDeEurosParaMostrar(producto.precio, m.codigo),
        }))
      );
      setProductosConvertidos(convertidos);
    } catch (err) {
      setProductosConvertidos([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarProductos();
    }, [cargarProductos])
  );

  // Re-cargar datos cuando la sincronización completa (lastSync cambia)
  const lastSyncRef = useRef(lastSync);
  useEffect(() => {
    if (lastSync && lastSync !== lastSyncRef.current) {
      lastSyncRef.current = lastSync;
      cargarProductos();
    } else {
      lastSyncRef.current = lastSync;
    }
  }, [lastSync]);

  const productosFiltrados = (productosConvertidos.length > 0 ? productosConvertidos : productos).filter(
    (producto) =>
      producto.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
      producto.unidad?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const productosAgrupados = productosFiltrados.reduce((acc, producto) => {
    const raw = producto.descripcion.trim();
    const primeraLetra = raw.length ? raw.charAt(0).toUpperCase() : "#";
    if (!acc[primeraLetra]) {
      acc[primeraLetra] = [];
    }
    acc[primeraLetra].push(producto);
    return acc;
  }, {} as Record<string, Producto[]>);

  const letrasOrdenadas = Object.keys(productosAgrupados).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  function resetFormulario() {
    setFormulario({
      descripcion: "",
      precio: "",
      unidad: "ud",
    });
    setEditando(null);
  }

  function abrirFormulario(producto?: Producto) {
    if (producto) {
      const original = productos.find((p) => p.id === producto.id) ?? producto;
      setEditando(original);
      setFormulario({
        descripcion: original.descripcion,
        precio: original.precio.toString(),
        unidad: original.unidad,
      });
    } else {
      resetFormulario();
    }
    setMostrarFormulario(true);
  }

  async function guardarProducto() {
    if (!formulario.descripcion.trim()) {
      Alert.alert(t("error"), t("descripcion") + " " + t("es obligatorio"));
      return;
    }

    if (!formulario.precio.trim() || isNaN(parseFloat(formulario.precio))) {
      Alert.alert(t("error"), t("precio") + " " + t("es obligatorio"));
      return;
    }

    const productoData = {
      descripcion: formulario.descripcion.trim(),
      precio: parseFloat(formulario.precio),
      unidad: formulario.unidad.trim() || "ud",
    };

    try {
      if (editando) {
        updateProducto(editando.id, productoData);
      } else {
        insertProducto(productoData);
      }

      // Mostrar anuncio intersticial cada 3 acciones
      await adsService.incrementAction(isPremium);

      void cargarProductos();
      setMostrarFormulario(false);
      resetFormulario();
    } catch (error) {
      Alert.alert(t("error"), t("no_se_pudo_guardar_el_producto"));
    }
  }

  function eliminarProducto(producto: Producto) {
    Alert.alert(t("eliminar_producto"), t("confirmar_eliminar") + ' "' + producto.descripcion + '"?', [
      { text: t("cancelar"), style: "cancel" },
      {
        text: t("eliminar"),
        style: "destructive",
        onPress: async () => {
          try {
            deleteProducto(producto.id);
            // Eliminar también de la nube para que no reaparezca
            syncService.deleteProductFromCloud(producto.id).catch(() => {});
            void cargarProductos();
          } catch (error) {
            Alert.alert(t("error"), t("no_se_pudo_eliminar_el_producto"));
          }
        },
      },
    ]);
  }

  if (mostrarFormulario) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setMostrarFormulario(false)}>
              <Ionicons name="arrow-back" size={24} color={currentTheme.colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{editando ? t("editar_producto") : t("nuevo_producto")}</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>{t("info_basica")}</Text>
              <TextInput
                style={styles.input}
                placeholder={t("descripcion_placeholder")}
                placeholderTextColor="#888"
                value={formulario.descripcion}
                onChangeText={(v) => setFormulario({ ...formulario, descripcion: v })}
              />
              <TextInput
                style={styles.input}
                placeholder={t("precio")}
                placeholderTextColor="#888"
                keyboardType="decimal-pad"
                value={formulario.precio}
                onChangeText={(v) => setFormulario({ ...formulario, precio: v })}
              />
              <TextInput
                style={styles.input}
                placeholder={t("unidad")}
                placeholderTextColor="#888"
                value={formulario.unidad}
                onChangeText={(v) => setFormulario({ ...formulario, unidad: v })}
              />
            </View>

            <TouchableOpacity style={[styles.boton, { backgroundColor: currentTheme.colors.primary }]} onPress={guardarProducto}>
              <Text style={styles.botonTexto}>{editando ? t("actualizar_producto") : t("crear_producto")}</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <SwipeNavigation onSwipeLeft={navigateToNextTab} onSwipeRight={navigateToPreviousTab}>
    <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
      <View style={styles.container}>
        <Text style={[styles.titulo, { color: currentTheme.colors.text }]}>{t("productos_titulo")}</Text>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("buscar_producto_ph")}
            placeholderTextColor="#888"
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>

        {productosFiltrados.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={[styles.emptyState, { flex: undefined }]}>
              <Ionicons name="cube-outline" size={60} color="#ddd" />
              <Text style={styles.emptyTexto}>{busqueda ? t("no_encontrados_productos") : t("no_productos")}</Text>
              <Text style={styles.emptySub}>{busqueda ? t("otra_busqueda") : t("anadir_primer_producto")}</Text>
            </View>
          </View>
        ) : (
          <FlatList
            data={letrasOrdenadas}
            keyExtractor={(letra) => letra}
            renderItem={({ item: letra }) => (
              <View style={styles.seccion}>
                <Text style={[styles.letraTitulo, { color: currentTheme.colors.primary }]}>{letra}</Text>
                {productosAgrupados[letra].map((producto) => (
                  <TouchableOpacity key={producto.id} style={styles.productoCard} onPress={() => abrirFormulario(producto)}>
                    <View style={styles.productoInfo}>
                      <Text style={styles.productoNombre}>{producto.descripcion}</Text>
                      <Text style={styles.productoDato}>
                        {producto.precio.toFixed(2)} {simboloMoneda}/{producto.unidad}
                      </Text>
                    </View>
                    <View style={styles.productoActions}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => abrirFormulario(producto)}>
                        <Ionicons name="create-outline" size={20} color={currentTheme.colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => eliminarProducto(producto)}>
                        <Ionicons name="trash-outline" size={20} color="#FF4757" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={() => <View style={{ paddingVertical: 8 }} />}
            ListFooterComponent={() => <View style={{ paddingVertical: 16 }} />}
          />
        )}
      </View>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: currentTheme.colors.primary, shadowColor: currentTheme.colors.primary }]}
        onPress={() => abrirFormulario()}
      >
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={styles.fabTexto}>{t("nuevo_producto")}</Text>
      </TouchableOpacity>
    </View>
    </SwipeNavigation>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F8F7FF" },
  container: { flex: 1, paddingTop: 55, paddingHorizontal: 20 },
  titulo: { fontSize: 26, fontWeight: "800", color: "#1a1a1a", marginBottom: 20 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
  },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 16, color: "#1a1a1a", paddingVertical: 14 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 100 },
  emptyTexto: { fontSize: 18, fontWeight: "600", color: "#aaa", marginTop: 16 },
  emptySub: { fontSize: 14, color: "#ccc", marginTop: 6, textAlign: "center" },
  seccion: { marginBottom: 24 },
  letraTitulo: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  productoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: "row",
    padding: 16,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    alignItems: "center",
  },
  productoInfo: { flex: 1 },
  productoNombre: { fontSize: 16, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  productoDato: { fontSize: 14, color: "#666", marginBottom: 2 },
  productoActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#f8f9fa", justifyContent: "center", alignItems: "center" },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  fabTexto: { color: "#fff", fontWeight: "700", fontSize: 15 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#EEE9FF", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#1a1a1a", flex: 1, textAlign: "center" },
  formSection: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 16 },
  input: {
    borderWidth: 1.5,
    borderColor: "#aaa",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#1a1a1a",
  },
  boton: { padding: 15, borderRadius: 10, alignItems: "center", marginBottom: 20 },
  botonTexto: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
