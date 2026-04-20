import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { getMoneda } from "../../utils/settings";
import { deleteProducto, getProductos, insertProducto, updateProducto } from "../db/productos";

type Producto = {
  id: number;
  descripcion: string;
  precio: number;
  unidad: string;
};

export default function Productos() {
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [formulario, setFormulario] = useState({
    descripcion: "",
    precio: "",
    unidad: "ud"
  });
  const [simboloMoneda, setSimboloMoneda] = useState('€');

  useFocusEffect(useCallback(() => {
    setProductos(getProductos());
    getMoneda().then(m => {
      setSimboloMoneda(m.simbolo);
    }).catch(err => {
      console.error('Error al cargar moneda en productos:', err);
    });
  }, []));

  const productosFiltrados = productos.filter(producto => 
    producto.descripcion.toLowerCase().includes(busqueda.toLowerCase())
  );

  function resetFormulario() {
    setFormulario({
      descripcion: "",
      precio: "",
      unidad: "ud"
    });
    setEditando(null);
  }

  function abrirFormulario(producto?: Producto) {
    if (producto) {
      setEditando(producto);
      setFormulario({
        descripcion: producto.descripcion,
        precio: producto.precio.toString(),
        unidad: producto.unidad
      });
    } else {
      resetFormulario();
    }
    setMostrarFormulario(true);
  }

  function guardarProducto() {
    if (!formulario.descripcion.trim()) {
      Alert.alert(t('error'), t('descripcion') + ' ' + t('es obligatorio'));
      return;
    }

    if (!formulario.precio.trim() || isNaN(parseFloat(formulario.precio))) {
      Alert.alert(t('error'), t('precio') + ' ' + t('es obligatorio'));
      return;
    }

    const productoData = {
      descripcion: formulario.descripcion.trim(),
      precio: parseFloat(formulario.precio),
      unidad: formulario.unidad
    };

    try {
      if (editando) {
        updateProducto(editando.id, productoData);
        Alert.alert(t('exito'), t('producto_actualizado'));
      } else {
        insertProducto(productoData);
        Alert.alert(t('exito'), t('producto_creado'));
      }
      
      setProductos(getProductos());
      setMostrarFormulario(false);
      resetFormulario();
    } catch (error) {
      Alert.alert(t('error'), t('no_se_pudo_guardar_el_producto'));
    }
  }

  function eliminarProducto(producto: Producto) {
    Alert.alert(t('eliminar_producto'),
      t('confirmar_eliminar') + ' "' + producto.descripcion + '"?',
      [
        { text: t('cancelar'), style: 'cancel' },
        { 
          text: t('eliminar'), 
          style: 'destructive',
          onPress: () => {
            try {
              deleteProducto(producto.id);
              setProductos(getProductos());
              Alert.alert(t('exito'), t('producto_eliminado'));
            } catch (error) {
              Alert.alert(t('error'), t('no_se_pudo_eliminar_el_producto'));
            }
          }
        }
      ]
    );
  }

  function renderProducto({ item }: { item: Producto }) {
    return (
      <View style={[styles.productoCard, { backgroundColor: currentTheme.colors.card }]}>
        <View style={styles.productoInfo}>
          <Text style={[styles.productoNombre, { color: currentTheme.colors.text }]}>{item.descripcion}</Text>
          <View style={styles.productoDetalles}>
            <Text style={[styles.productoPrecio, { color: currentTheme.colors.primary }]}>
              {item.precio.toFixed(2)} {simboloMoneda}/{item.unidad}
            </Text>
          </View>
        </View>
        <View style={styles.productoAcciones}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: currentTheme.colors.primaryLight }]}
            onPress={() => abrirFormulario(item)}
          >
            <Ionicons name="create-outline" size={18} color={currentTheme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: '#fee2e2' }]}
            onPress={() => eliminarProducto(item)}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (mostrarFormulario) {
    return (
      <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: currentTheme.colors.card }]}>
          <TouchableOpacity onPress={() => setMostrarFormulario(false)}>
            <Ionicons name="arrow-back" size={24} color={currentTheme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitulo, { color: currentTheme.colors.text }]}>
            {editando ? t('editar_producto') : t('nuevo_producto')}
          </Text>
          <TouchableOpacity onPress={guardarProducto}>
            <Text style={[styles.headerGuardar, { color: currentTheme.colors.primary }]}>
              {t('guardar')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll}>
          <View style={[styles.formContainer, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.label, { color: currentTheme.colors.textSecondary }]}>{t('descripcion')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: currentTheme.colors.background, color: currentTheme.colors.text }]}
              placeholder={t('descripcion_placeholder')}
              placeholderTextColor={currentTheme.colors.textSecondary}
              value={formulario.descripcion}
              onChangeText={v => setFormulario(prev => ({ ...prev, descripcion: v }))}
            />

            <Text style={[styles.label, { color: currentTheme.colors.textSecondary }]}>{t('precio')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: currentTheme.colors.background, color: currentTheme.colors.text }]}
              placeholder="0.00"
              placeholderTextColor={currentTheme.colors.textSecondary}
              keyboardType="decimal-pad"
              value={formulario.precio}
              onChangeText={v => setFormulario(prev => ({ ...prev, precio: v }))}
            />

            <Text style={[styles.label, { color: currentTheme.colors.textSecondary }]}>{t('unidad')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: currentTheme.colors.background, color: currentTheme.colors.text }]}
              placeholder="ud"
              placeholderTextColor={currentTheme.colors.textSecondary}
              value={formulario.unidad}
              onChangeText={v => setFormulario(prev => ({ ...prev, unidad: v }))}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: currentTheme.colors.card }]}>
        <Text style={[styles.headerTitulo, { color: currentTheme.colors.text }]}>{t('productos_titulo')}</Text>
        <TouchableOpacity onPress={() => abrirFormulario()}>
          <Ionicons name="add-circle" size={28} color={currentTheme.colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: currentTheme.colors.card }]}>
        <Ionicons name="search" size={20} color={currentTheme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: currentTheme.colors.text }]}
          placeholder={t('buscar_producto')}
          placeholderTextColor={currentTheme.colors.textSecondary}
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      {productosFiltrados.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="pricetag-outline" size={64} color={currentTheme.colors.textSecondary} />
          <Text style={[styles.emptyText, { color: currentTheme.colors.textSecondary }]}>
            {busqueda ? t('no_encontrados') : t('no_productos')}
          </Text>
          {!busqueda && (
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: currentTheme.colors.primary }]}
              onPress={() => abrirFormulario()}
            >
              <Text style={styles.emptyBtnText}>{t('anadir_primer_producto')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={productosFiltrados}
          renderItem={renderProducto}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 55,
  },
  headerTitulo: { fontSize: 20, fontWeight: '800' },
  headerGuardar: { fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1 },
  formContainer: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    gap: 16,
  },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchIcon: {},
  searchInput: { flex: 1, fontSize: 15 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  emptyText: { fontSize: 16, textAlign: 'center' },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  list: { paddingHorizontal: 16 },
  separator: { height: 12 },
  productoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  productoInfo: { flex: 1 },
  productoNombre: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  productoDetalles: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  productoPrecio: { fontSize: 15, fontWeight: '700' },
  productoAcciones: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
