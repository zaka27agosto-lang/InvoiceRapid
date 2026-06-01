import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export default function Cookies() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={currentTheme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: currentTheme.colors.text }]}>{t('politica_cookies')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Qué son las Cookies e Identificadores</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            En aplicaciones móviles, el equivalente funcional de las cookies son los identificadores de dispositivo y el almacenamiento local. Estos mecanismos permiten recordar preferencias, mantener sesiones activas y ofrecer anuncios personalizados en la versión gratuita.
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

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Identificadores que Utiliza la App</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid utiliza los siguientes mecanismos equivalentes a cookies:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Sesión:</Text> Almacenamiento seguro de tokens de autenticación con Supabase.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Preferencias:</Text> Guarda idioma, tema, moneda y configuraciones en el almacenamiento local.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Publicidad (Google AdMob):</Text> Identificador de publicidad de Android para mostrar anuncios personalizados en la versión gratuita. El usuario puede gestionar su consentimiento desde Ajustes {'>'} Consentimiento de anuncios.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>RevenueCat:</Text> Identificador anónimo para gestionar el estado de suscripción premium.
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

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Servicios de Terceros</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid utiliza los siguientes servicios de terceros que pueden emplear identificadores propios:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Google Play Billing y RevenueCat:</Text> Para gestionar suscripciones y pagos.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Google AdMob:</Text> Para mostrar anuncios en la versión gratuita. Utiliza el identificador de publicidad de Android.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Supabase:</Text> Para autenticación de cuentas y almacenamiento de datos.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Estos terceros tienen sus propias políticas de privacidad que puede consultar en sus sitios web.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Consentimiento de Anuncios (UMP)</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            La aplicación utiliza el SDK UMP (User Messaging Platform) de Google para solicitar el consentimiento de anuncios a usuarios en el Espacio Económico Europeo, cumpliendo con los requisitos del RGPD. Al iniciar la aplicación por primera vez, se mostrará un diálogo de consentimiento donde el usuario puede aceptar o rechazar anuncios personalizados.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Actualizaciones</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Podemos actualizar esta Política de Cookies periódicamente para reflejar cambios en nuestras prácticas o por requisitos legales. Le recomendamos revisar esta política regularmente.
          </Text>

          <Text style={[styles.updateDate, { color: currentTheme.colors.textSecondary }]}>
            Última actualización: 01/06/2026
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
