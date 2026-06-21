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
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>Política de Cookies — InvoiceRapid PRO</Text>

          <Text style={[styles.updateDate, { color: currentTheme.colors.textSecondary }]}>
            Última actualización: 18/06/2026
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>1. ¿Qué son las Cookies e Identificadores?</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            En aplicaciones móviles, el equivalente funcional de las cookies son los identificadores de dispositivo y el almacenamiento local. Estos mecanismos permiten recordar preferencias, mantener sesiones activas y ofrecer anuncios personalizados en la versión gratuita.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>2. Tipos de Cookies e Identificadores que utilizamos</Text>

          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>2.1. Cookies Esenciales (almacenamiento local)</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Necesarias para el funcionamiento básico de la aplicación:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} <Text style={{ fontWeight: '600' }}>Sesión:</Text> Almacenamiento seguro de tokens de autenticación con Supabase.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} <Text style={{ fontWeight: '600' }}>Preferencias:</Text> Guarda idioma, tema, moneda, formato de fecha, plantilla PDF y configuraciones en el almacenamiento local del dispositivo.
          </Text>

          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>2.2. Cookies de Rendimiento</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Recopilan información sobre el uso de la aplicación para mejorar su estabilidad:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Registros de fallos (crash logs) a través de Expo y Firebase Crashlytics.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Datos de diagnóstico y rendimiento de la aplicación.
          </Text>

          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>2.3. Cookies de Funcionalidad</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Recuerdan sus preferencias y configuraciones para personalizar la experiencia:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Formato de fecha y moneda seleccionados.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Plantilla de PDF y color del tema.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Configuración de numeración de facturas y albaranes.
          </Text>

          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>2.4. Cookies de Marketing (Publicidad)</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Se utilizan para mostrar anuncios personalizados en la versión gratuita:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} <Text style={{ fontWeight: '600' }}>Google AdMob:</Text> Utiliza el identificador de publicidad de Android (AAID) para mostrar anuncios personalizados basados en los intereses del usuario.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} <Text style={{ fontWeight: '600' }}>RevenueCat:</Text> Identificador anónimo para gestionar el estado de suscripción premium.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>3. Servicios de Terceros</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid PRO utiliza los siguientes servicios de terceros que pueden emplear identificadores propios:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} <Text style={{ fontWeight: '600' }}>Google Play Billing y RevenueCat:</Text> Para gestionar suscripciones y pagos.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} <Text style={{ fontWeight: '600' }}>Google AdMob:</Text> Para mostrar anuncios en la versión gratuita.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} <Text style={{ fontWeight: '600' }}>Supabase:</Text> Para autenticación de cuentas y almacenamiento de datos.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} <Text style={{ fontWeight: '600' }}>Expo / Firebase Crashlytics:</Text> Para recopilación de datos de rendimiento y fallos.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Estos terceros tienen sus propias políticas de privacidad que puede consultar en sus sitios web.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>4. Consentimiento de Anuncios (UMP)</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            La aplicación utiliza el SDK UMP (User Messaging Platform) de Google para solicitar el consentimiento de anuncios a usuarios en el Espacio Económico Europeo (EEE), cumpliendo con los requisitos del RGPD. Al iniciar la aplicación por primera vez, se mostrará un diálogo de consentimiento donde el usuario puede aceptar o rechazar anuncios personalizados.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            El usuario puede cambiar su preferencia en cualquier momento desde Ajustes → Consentimiento de anuncios dentro de la aplicación.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>5. Cómo Gestionar las Cookies e Identificadores</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Puede gestionar sus preferencias de las siguientes formas:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Desde Ajustes → Privacidad y Datos en la aplicación.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Desde Ajustes → Google → Anuncios en su dispositivo Android (desactivar personalización de anuncios).
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Desde la configuración de su dispositivo móvil (Ajustes → Aplicaciones → InvoiceRapid → Almacenamiento → Borrar datos).
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Tenga en cuenta que deshabilitar cookies esenciales o borrar el almacenamiento puede afectar el funcionamiento de la aplicación y requerir que vuelva a iniciar sesión.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>6. Actualizaciones de esta Política</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Podemos actualizar esta Política de Cookies periódicamente para reflejar cambios en nuestras prácticas o por requisitos legales. La fecha de la última actualización se muestra al inicio de esta página.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>7. Contacto</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Para cualquier pregunta sobre esta política, utilice las opciones disponibles en Ajustes → Privacidad y Datos dentro de la aplicación.
          </Text>
          <Text style={{ fontSize: 11, color: currentTheme.colors.textSecondary, opacity: 0.4, marginTop: 20 }}>
            zkrstudio.contact@gmail.com
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
