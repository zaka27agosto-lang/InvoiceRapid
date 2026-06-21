import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export default function Privacy() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={currentTheme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: currentTheme.colors.text }]}>{t('politica_privacidad')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>Política de Privacidad — InvoiceRapid PRO</Text>

          <Text style={[styles.updateDate, { color: currentTheme.colors.textSecondary }]}>
            Última actualización: 18/06/2026
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>1. Introducción</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid PRO ("la Aplicación") respeta la privacidad de los usuarios y se compromete a proteger sus datos personales. Esta Política de Privacidad explica qué datos se recopilan, cómo se utilizan, con quién se comparten y qué derechos tiene el usuario.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            La aplicación puede utilizarse sin crear una cuenta. La creación de cuenta es opcional y sirve para guardar datos en la nube, como facturas, clientes y productos.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>2. Datos que recopilamos</Text>

          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>2.1. Datos proporcionados voluntariamente</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Estos datos solo se recopilan si el usuario decide crear una cuenta o realizar compras:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Dirección de correo electrónico.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Contraseña.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Datos introducidos manualmente: clientes, productos, facturas, albaranes y configuraciones.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Historial de compras (suscripciones o pagos).
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Códigos de referido y relaciones de referidos (cuando se utilizan).
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Firmas manuscritas capturadas en albaranes (solo si el usuario utiliza esta función).
          </Text>

          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>2.2. Datos recopilados automáticamente</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            La aplicación y los servicios externos pueden recopilar automáticamente:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Registros de fallos (crash logs).
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Datos de diagnóstico y rendimiento.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} IDs de dispositivo e identificadores (incluyendo AAID).
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Información básica del dispositivo y sistema operativo.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Consentimiento de anuncios (UMP): La aplicación utiliza el SDK UMP de Google para solicitar el consentimiento de anuncios a usuarios en el EEE, cumpliendo con el RGPD. Al iniciar la aplicación por primera vez, se mostrará un diálogo de consentimiento.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Publicidad personalizada: Google AdMob puede utilizar el ID de publicidad (AAID) para mostrar anuncios personalizados. El usuario puede desactivarlo desde Ajustes → Google → Anuncios → Desactivar personalización de anuncios.
          </Text>

          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>2.3. Servicios externos utilizados</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Supabase: autenticación y base de datos.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} RevenueCat: gestión de suscripciones.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Google Play Billing: procesamiento de compras.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Google AdMob: publicación de anuncios.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Expo: framework que puede recopilar datos de rendimiento y fallos.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Firebase Crashlytics: recopilación de registros de fallos y datos de diagnóstico.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>3. Uso de los datos</Text>

          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>3.1. Datos de cuenta y compras</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            El correo electrónico, contraseña, ID de usuario e historial de compras se utilizan para proporcionar y mantener las funciones de la aplicación, crear y autenticar la cuenta, sincronizar datos y prevenir fraudes.
          </Text>

          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>3.2. Datos de referidos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Los códigos de referido y las relaciones de referidos se utilizan exclusivamente para gestionar el programa de invitación de amigos, permitiendo a los usuarios compartir la aplicación y obtener beneficios. Estos datos se almacenan en Supabase y no se comparten con terceros.
          </Text>

          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>3.3. Datos automáticos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Se utilizan para analizar rendimiento y estabilidad, detectar y corregir errores, mejorar la experiencia de uso y prevenir fraudes.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>4. Compartición de datos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid PRO no vende datos personales a terceros. Los datos solo se comparten con los servicios externos mencionados (Supabase, RevenueCat, Google Play Billing, Google AdMob, Expo, Firebase Crashlytics) para los fines descritos. También podrán divulgarse si lo exige la ley o una autoridad competente.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>5. Retención de datos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Los datos se conservan mientras la cuenta esté activa. Al solicitar la eliminación, la cuenta entra en un período de gracia de 30 días. Transcurrido ese plazo sin restauración, los datos se eliminan permanentemente. Las firmas de albaranes se eliminan junto con los datos de la cuenta. El historial de compras se conserva por obligaciones fiscales (hasta 6 años según legislación española).
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>6. Seguridad</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Se aplican medidas técnicas razonables: transmisión cifrada (HTTPS), almacenamiento en servicios seguros y acceso restringido mediante autenticación para proteger el acceso a la aplicación.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>7. Eliminación de datos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            El usuario puede solicitar la eliminación desde Ajustes → Privacidad y Datos → Borrar cuenta. Se inicia un período de gracia de 30 días durante el cual puede restaurar su cuenta iniciando sesión. Transcurrido ese plazo, los datos se eliminan de forma permanente e irreversible, y el email queda bloqueado para nuevos registros.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Más información en:{' '}
            https://zaka27agosto-lang.github.io/InvoiceRapid/account-deletion.html
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>8. Derechos del usuario</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            El usuario tiene derecho a acceder, rectificar, eliminar y exportar sus datos, así como a retirar el consentimiento en cualquier momento. También puede usar la aplicación sin crear cuenta. La exportación de datos (RGPD) está disponible desde Ajustes → Privacidad y Datos → Exportar datos.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>9. Cumplimiento normativo</Text>

          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>9.1. RGPD / GDPR (Europa)</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Para usuarios del EEE, el tratamiento se basa en: ejecución del contrato, consentimiento, interés legítimo y obligación legal. Los usuarios del EEE pueden presentar reclamaciones ante su autoridad de protección de datos local.
          </Text>

          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>9.2. CCPA (California, EE.UU.)</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Los residentes de California tienen derecho a saber qué datos se recopilan, solicitar su eliminación y no ser discriminados por ejercer sus derechos. InvoiceRapid PRO no vende datos personales según la definición de la CCPA.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>10. Privacidad de menores</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid PRO no está dirigido a menores de 13 años. No recopilamos conscientemente datos de menores. Si un padre o tutor descubre que su hijo nos ha proporcionado datos, puede contactarnos para eliminarlos.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>11. Cambios en esta política</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Esta política puede actualizarse ocasionalmente. La versión más reciente estará siempre disponible en:{' '}
            https://zaka27agosto-lang.github.io/InvoiceRapid/privacy-policy.html
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>12. Contacto</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Para ejercer sus derechos de privacidad, utilice las opciones disponibles en Ajustes → Privacidad y Datos dentro de la aplicación.
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
