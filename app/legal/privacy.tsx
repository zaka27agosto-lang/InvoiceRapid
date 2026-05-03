import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export default function Privacy() {
  const router = useRouter();
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={currentTheme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: currentTheme.colors.text }]}>Política de Privacidad</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>🟩 POLÍTICA DE PRIVACIDAD — InvoiceRapid PRO</Text>
          
          <Text style={[styles.updateDate, { color: currentTheme.colors.textSecondary }]}>
            Última actualización: 02/05/2026
          </Text>

          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid PRO ("la Aplicación"), desarrollada por ZKR Studio, se compromete a proteger la privacidad de los usuarios. Esta Política de Privacidad explica qué datos se recopilan, cómo se utilizan y qué derechos tiene el usuario.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>1. Datos que recopilamos</Text>
          
          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>1.1. Datos proporcionados por el usuario</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Correo electrónico y contraseña para crear una cuenta.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Datos introducidos manualmente en la aplicación: clientes, productos, facturas y configuraciones.
          </Text>

          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>1.2. Datos técnicos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Tipo de dispositivo
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Sistema operativo
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Información básica de uso para mejorar la aplicación
          </Text>

          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>1.3. Servicios externos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            La aplicación utiliza Supabase como servicio de autenticación y base de datos.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>2. Uso de los datos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Los datos se utilizan para:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Crear y gestionar la cuenta del usuario
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Guardar y sincronizar facturas
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Mejorar la estabilidad y funcionamiento de la aplicación
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>3. Compartición de datos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid PRO no vende datos personales.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Los datos solo se comparten con:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Supabase, para autenticación y almacenamiento
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Autoridades legales si fuera requerido
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>4. Seguridad</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Implementamos medidas para proteger los datos:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Conexiones cifradas (HTTPS)
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Acceso restringido mediante autenticación
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Almacenamiento seguro en Supabase
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>5. Derechos del usuario</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            El usuario puede:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Acceder a sus datos
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Rectificar información incorrecta
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Solicitar la eliminación de su cuenta y datos enviando un correo a:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            📧 zkrstudio.contact@gmail.com
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>6. Eliminación de datos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Cuando el usuario solicite la eliminación de su cuenta, sus datos serán eliminados manualmente de Supabase.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>7. Cambios en esta política</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Podemos actualizar esta política ocasionalmente.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            La fecha de la última actualización se mostrará arriba.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>8. Contacto</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Para dudas sobre esta política:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            📧 zkrstudio.contact@gmail.com
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 55, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '800' },
  scroll: { flex: 1, paddingHorizontal: 16 },
  content: { padding: 20, borderRadius: 16, marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  subsectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  text: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  updateDate: { fontSize: 12, marginTop: 16, marginBottom: 20, textAlign: 'center' },
});
