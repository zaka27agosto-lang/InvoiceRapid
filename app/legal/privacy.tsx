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
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>🟩 POLÍTICA DE PRIVACIDAD — InvoiceRapid PRO</Text>
          
          <Text style={[styles.updateDate, { color: currentTheme.colors.textSecondary }]}>
            Última actualización: 01/06/2026
          </Text>

          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid PRO ({'"'}la Aplicaci{'\u00F3'}n{'"'}), desarrollada por ZKR Studio, se compromete a proteger la privacidad de los usuarios. Esta Pol{'\u00ED'}tica de Privacidad explica qu{'\u00E9'} datos se recopilan, c{'\u00F3'}mo se utilizan y qu{'\u00E9'} derechos tiene el usuario, cumpliendo con el Reglamento General de Protecci{'\u00F3'}n de Datos (RGPD) de la Uni{'\u00F3'}n Europea.
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

          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>1.3. Publicidad</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            La versión gratuita de la aplicación muestra anuncios a través de Google AdMob. Se utiliza el SDK UMP (User Messaging Platform) de Google para solicitar el consentimiento de anuncios personalizados a usuarios en el EEE, cumpliendo con el RGPD. Los usuarios premium no ven anuncios. Consulte la Política de Privacidad de Google: https://policies.google.com/privacy
          </Text>

          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>1.4. Suscripciones y pagos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Las suscripciones premium se gestionan a través de Google Play Billing y RevenueCat. RevenueCat procesa la información de suscripción para verificar el estado premium del usuario. No almacenamos datos de tarjetas de crédito ni métodos de pago. Consulte la Política de Privacidad de RevenueCat: https://www.revenuecat.com/privacy
          </Text>

          <Text style={[styles.subsectionTitle, { color: currentTheme.colors.text }]}>1.5. Servicios externos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            La aplicación utiliza Supabase como servicio de autenticación y base de datos. Consulte la Política de Privacidad de Supabase: https://supabase.com/privacy
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

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>4. Retención de datos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Conservamos los datos personales mientras la cuenta permanezca activa. Al solicitar la eliminación, los datos se conservan durante un período de gracia de 30 días y luego se eliminan permanentemente. Ciertos registros de transacciones pueden conservarse por obligaciones legales (hasta 6 años según legislación fiscal española) de forma anonimizada.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>5. Seguridad</Text>
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

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>6. Derechos del usuario (RGPD)</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            De acuerdo con el RGPD, el usuario tiene derecho a:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Acceder a sus datos personales
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Rectificar información incorrecta
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Exportar sus datos en formato PDF desde la secci{'\u00F3'}n {'"'}Privacidad y Datos{'"'} en Ajustes
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Solicitar la eliminación de su cuenta y todos sus datos desde Ajustes {'>'} Privacidad y Datos {'>'} Borrar cuenta.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Retirar el consentimiento para anuncios personalizados desde Ajustes {'>'} Consentimiento de anuncios
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>7. Eliminación de datos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Al solicitar la eliminación de la cuenta, se inicia un período de gracia de 30 días durante el cual el usuario puede restaurar su cuenta simplemente iniciando sesión. Transcurrido este período, todos los datos personales se eliminan de forma permanente de Supabase. Consulte la página de eliminación de cuenta para más detalles.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>8. Menores de edad</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid PRO no está dirigido a menores de 13 años. No recopilamos conscientemente datos personales de menores. Si un padre o tutor descubre que su hijo nos ha proporcionado datos personales sin consentimiento, puede contactarnos para eliminarlos.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>9. Cambios en esta política</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Podemos actualizar esta política ocasionalmente.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            La fecha de la última actualización se mostrará arriba.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>10. Contacto</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Para ejercer sus derechos de privacidad, utilice las opciones disponibles en Ajustes {'>'} Privacidad y Datos dentro de la aplicación.
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
