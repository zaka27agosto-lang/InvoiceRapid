import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { deleteCliente, getClientes, insertCliente, updateCliente } from "../db/clientes";

type Cliente = {
  id: number;
  nombre: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  pais?: string;
  calle?: string;
  piso?: string;
  ciudad?: string;
  cp?: string;
  provincia?: string;
  nif?: string;
  persona_contacto?: string;
  movil?: string;
};

export default function Clientes() {
  const { t } = useTranslation();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [formulario, setFormulario] = useState({
    nombre: "",
    email: "",
    telefono: "",
    movil: "",
    pais: "",
    calle: "",
    piso: "",
    ciudad: "",
    cp: "",
    provincia: "",
    nif: "",
    persona_contacto: "",
    direccion: ""
  });
  const router = useRouter();

  useFocusEffect(useCallback(() => {
    setClientes(getClientes() as Cliente[]);
  }, []));

  const clientesFiltrados = clientes.filter(cliente => 
    cliente.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    cliente.email?.toLowerCase().includes(busqueda.toLowerCase()) ||
    cliente.telefono?.includes(busqueda)
  );

  const clientesAgrupados = clientesFiltrados.reduce((acc, cliente) => {
    const primeraLetra = cliente.nombre.charAt(0).toUpperCase();
    if (!acc[primeraLetra]) {
      acc[primeraLetra] = [];
    }
    acc[primeraLetra].push(cliente);
    return acc;
  }, {} as Record<string, Cliente[]>);

  const letrasOrdenadas = Object.keys(clientesAgrupados).sort();

  function resetFormulario() {
    setFormulario({
      nombre: "",
      email: "",
      telefono: "",
      movil: "",
      pais: "",
      calle: "",
      piso: "",
      ciudad: "",
      cp: "",
      provincia: "",
      nif: "",
      persona_contacto: "",
      direccion: ""
    });
    setEditando(null);
  }

  function abrirFormulario(cliente?: Cliente) {
    if (cliente) {
      setEditando(cliente);
      setFormulario({
        nombre: cliente.nombre,
        email: cliente.email || "",
        telefono: cliente.telefono || "",
        movil: cliente.movil || "",
        pais: cliente.pais || "",
        calle: cliente.calle || "",
        piso: cliente.piso || "",
        ciudad: cliente.ciudad || "",
        cp: cliente.cp || "",
        provincia: cliente.provincia || "",
        nif: cliente.nif || "",
        persona_contacto: cliente.persona_contacto || "",
        direccion: cliente.direccion || ""
      });
    } else {
      resetFormulario();
    }
    setMostrarFormulario(true);
  }

  function guardarCliente() {
    if (!formulario.nombre.trim()) {
      Alert.alert(t('error'), t('nombre') + ' ' + t('es obligatorio'));
      return;
    }

    const direccionCompleta = [
      formulario.calle,
      formulario.piso,
      formulario.ciudad,
      formulario.cp,
      formulario.provincia,
      formulario.pais
    ].filter(Boolean).join(", ");

    const clienteData = {
      ...formulario,
      direccion: direccionCompleta
    };

    try {
      if (editando) {
        updateCliente(editando.id, clienteData);
        Alert.alert(t('exito'), t('cliente_actualizado'));
      } else {
        insertCliente(clienteData);
        Alert.alert(t('exito'), t('cliente_creado'));
      }
      
      setClientes(getClientes() as Cliente[]);
      setMostrarFormulario(false);
      resetFormulario();
    } catch (error) {
      Alert.alert(t('error'), t('no_se_pudo_guardar_el_cliente'));
    }
  }

  function eliminarCliente(cliente: Cliente) {
    Alert.alert(t('eliminar_cliente'),
      `¿Estás seguro de eliminar a ${cliente.nombre}?`,
      [
        { text: t('cancelar'), style: "cancel" },
        {
          text: t('eliminar'),
          style: "destructive",
          onPress: () => {
            try {
              deleteCliente(cliente.id);
              setClientes(getClientes() as Cliente[]);
              Alert.alert(t('exito'), t('cliente_eliminado'));
            } catch (error) {
              Alert.alert(t('error'), t('no_se_pudo_eliminar_el_cliente'));
            }
          }
        }
      ]
    );
  }

  if (mostrarFormulario) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setMostrarFormulario(false)}>
              <Ionicons name="arrow-back" size={24} color="#6C47FF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{editando ? t('editar_cliente') : t('nuevo_cliente')}</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>{t('info_basica')}</Text>
              <TextInput style={styles.input} placeholder={t('nombre')} placeholderTextColor="#888" value={formulario.nombre} onChangeText={v => setFormulario({...formulario, nombre: v})} />
              <TextInput style={styles.input} placeholder={t('email')} placeholderTextColor="#888" value={formulario.email} onChangeText={v => setFormulario({...formulario, email: v})} keyboardType="email-address" />
              <TextInput style={styles.input} placeholder={t('telefono')} placeholderTextColor="#888" value={formulario.telefono} onChangeText={v => setFormulario({...formulario, telefono: v})} keyboardType="phone-pad" />
              <TextInput style={styles.input} placeholder={t('movil')} placeholderTextColor="#888" value={formulario.movil} onChangeText={v => setFormulario({...formulario, movil: v})} keyboardType="phone-pad" />
              <TextInput style={styles.input} placeholder={t('persona_contacto')} placeholderTextColor="#888" value={formulario.persona_contacto} onChangeText={v => setFormulario({...formulario, persona_contacto: v})} />
              <TextInput style={styles.input} placeholder={t('nif_cif')} placeholderTextColor="#888" value={formulario.nif} onChangeText={v => setFormulario({...formulario, nif: v})} />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>{t('direccion')}</Text>
              <TextInput style={styles.input} placeholder={t('pais')} placeholderTextColor="#888" value={formulario.pais} onChangeText={v => setFormulario({...formulario, pais: v})} />
              <TextInput style={styles.input} placeholder={t('calle')} placeholderTextColor="#888" value={formulario.calle} onChangeText={v => setFormulario({...formulario, calle: v})} />
              <TextInput style={styles.input} placeholder={t('piso')} placeholderTextColor="#888" value={formulario.piso} onChangeText={v => setFormulario({...formulario, piso: v})} />
              <TextInput style={styles.input} placeholder={t('ciudad')} placeholderTextColor="#888" value={formulario.ciudad} onChangeText={v => setFormulario({...formulario, ciudad: v})} />
              <TextInput style={styles.input} placeholder={t('cp')} placeholderTextColor="#888" value={formulario.cp} onChangeText={v => setFormulario({...formulario, cp: v})} />
              <TextInput style={styles.input} placeholder={t('provincia')} placeholderTextColor="#888" value={formulario.provincia} onChangeText={v => setFormulario({...formulario, provincia: v})} />
            </View>

            <TouchableOpacity style={styles.boton} onPress={guardarCliente}>
              <Text style={styles.botonTexto}>{editando ? t('actualizar_cliente') : t('crear_cliente')}</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <Text style={styles.titulo}>{t('clientes_titulo')}</Text>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('buscar_cliente_ph')}
            placeholderTextColor="#888"
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>

        {clientesFiltrados.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={60} color="#ddd" />
            <Text style={styles.emptyTexto}>
              {busqueda ? t('no_encontrados') : t('no_clientes')}
            </Text>
            <Text style={styles.emptySub}>
              {busqueda ? t('otra_busqueda') : t('anadir_primer_cliente')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={letrasOrdenadas}
            keyExtractor={(letra) => letra}
            renderItem={({ item: letra }) => (
              <View style={styles.seccion}>
                <Text style={styles.letraTitulo}>{letra}</Text>
                {clientesAgrupados[letra].map(cliente => (
                  <TouchableOpacity 
                    key={cliente.id} 
                    style={styles.clienteCard}
                    onPress={() => abrirFormulario(cliente)}
                  >
                    <View style={styles.clienteInfo}>
                      <Text style={styles.clienteNombre}>{cliente.nombre}</Text>
                      {cliente.email && <Text style={styles.clienteDato}>{cliente.email}</Text>}
                      {(cliente.telefono || cliente.movil) && (
                        <Text style={styles.clienteDato}>
                          {cliente.telefono || cliente.movil}
                        </Text>
                      )}
                      {cliente.direccion && <Text style={styles.clienteDato}>{cliente.direccion}</Text>}
                    </View>
                    <View style={styles.clienteActions}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => abrirFormulario(cliente)}>
                        <Ionicons name="create-outline" size={20} color="#6C47FF" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => eliminarCliente(cliente)}>
                        <Ionicons name="trash-outline" size={20} color="#FF4757" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <TouchableOpacity style={styles.fab} onPress={() => abrirFormulario()}>
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={styles.fabTexto}>{t('nuevo_cliente')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F8F7FF" },
  container: { flex: 1, paddingTop: 55, paddingHorizontal: 20 },
  titulo: { fontSize: 26, fontWeight: "800", color: "#1a1a1a", marginBottom: 20 },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1.5, borderColor: "#e0e0e0" },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 16, color: "#1a1a1a", paddingVertical: 14 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 100 },
  emptyTexto: { fontSize: 18, fontWeight: "600", color: "#aaa", marginTop: 16 },
  emptySub: { fontSize: 14, color: "#ccc", marginTop: 6, textAlign: "center" },
  seccion: { marginBottom: 24 },
  letraTitulo: { fontSize: 20, fontWeight: "700", color: "#6C47FF", marginBottom: 12 },
  clienteCard: { backgroundColor: "#fff", borderRadius: 12, marginBottom: 12, flexDirection: "row", padding: 16, borderWidth: 1, borderColor: "#f0f0f0" },
  clienteInfo: { flex: 1 },
  clienteNombre: { fontSize: 16, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  clienteDato: { fontSize: 14, color: "#666", marginBottom: 2 },
  clienteActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#f8f9fa", justifyContent: "center", alignItems: "center" },
  fab: { position: "absolute", bottom: 30, right: 20, backgroundColor: "#6C47FF", borderRadius: 30, paddingHorizontal: 22, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 8, shadowColor: "#6C47FF", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  fabTexto: { color: "#fff", fontWeight: "700", fontSize: 15 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#EEE9FF", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#1a1a1a", flex: 1, textAlign: "center" },
  formSection: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 16 },
  input: { borderWidth: 1.5, borderColor: "#aaa", borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 16, backgroundColor: "#fff", color: "#1a1a1a" },
  boton: { backgroundColor: "#6C47FF", padding: 15, borderRadius: 10, alignItems: "center", marginBottom: 20 },
  botonTexto: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
