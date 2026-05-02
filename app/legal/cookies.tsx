import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export default function Cookies() {
  const router = useRouter();
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={currentTheme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: currentTheme.colors.text }]}>Política de Cookies</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Qué son las Cookies</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Las cookies son pequeños archivos de texto que se almacenan en su dispositivo cuando visita una aplicación o sitio web. Se utilizan para recordar sus preferencias y mejorar su experiencia de usuario.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Tipos de Cookies</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Utilizamos diferentes tipos de cookies:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Cookies esenciales:</Text> Necesarias para el funcionamiento básico de la aplicación.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Cookies de rendimiento:</Text> Recopilan información sobre el uso de la aplicación.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Cookies de funcionalidad:</Text> Recuerdan sus preferencias y configuraciones.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Cookies de marketing:</Text> Se utilizan para mostrar anuncios personalizados.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Cookies que Utiliza la App</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid utiliza las siguientes cookies:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Sesión:</Text> Mantiene su sesión activa mientras navega.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Preferencias:</Text> Guarda su idioma, tema y configuraciones.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Analíticas:</Text> Ayuda a mejorar la aplicación analizando el uso.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Publicidad:</Text> Permite mostrar anuncios relevantes (si corresponde).
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Cómo Gestionar Cookies</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Puede gestionar sus preferencias de cookies:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Desde la configuración de la aplicación en la sección "Privacidad y Datos".
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Desde la configuración de su dispositivo móvil.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Eliminando las cookies de la aplicación desde la configuración del sistema.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Tenga en cuenta que deshabilitar cookies esenciales puede afectar el funcionamiento de la aplicación.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Cookies de Terceros</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid puede utilizar servicios de terceros que utilizan cookies:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Stripe:</Text> Para procesar pagos de forma segura.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Google Analytics:</Text> Para analizar el uso de la aplicación.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Google AdMob:</Text> Para mostrar anuncios (versión gratuita).
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Estos terceros tienen sus propias políticas de privacidad que puede consultar en sus sitios web.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Actualizaciones</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Podemos actualizar esta Política de Cookies periódicamente para reflejar cambios en nuestras prácticas o por requisitos legales. Le recomendamos revisar esta política regularmente.
          </Text>

          <Text style={[styles.updateDate, { color: currentTheme.colors.textSecondary }]}>
            Última actualización: 25 de abril de 2026
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
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  text: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  updateDate: { fontSize: 12, marginTop: 24, textAlign: 'center' },
});
