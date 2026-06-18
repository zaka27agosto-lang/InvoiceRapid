import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export default function Terms() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={currentTheme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: currentTheme.colors.text }]}>{t('terminos_condiciones')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>Términos y Condiciones — InvoiceRapid PRO</Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>1. Introducción</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Bienvenido a InvoiceRapid PRO ("la Aplicación"). Estos Términos y Condiciones rigen el uso de nuestra aplicación móvil de facturación. Al descargar, instalar o utilizar InvoiceRapid PRO, usted acepta estos Términos en su totalidad. Si no está de acuerdo, no utilice la Aplicación.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>2. Uso del Servicio</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid PRO le permite crear, gestionar y enviar facturas y albaranes. Usted acepta utilizar el servicio únicamente para fines legítimos. No está permitido:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Utilizar la aplicación para actividades fraudulentas o ilegales.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Crear facturas o albaranes falsos o engañosos.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Intentar acceder a cuentas o datos de otros usuarios sin autorización.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Interferir con el funcionamiento normal de la aplicación.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Realizar ingeniería inversa, descompilar o modificar la aplicación.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>3. Cuenta de Usuario</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Para acceder a funciones como la sincronización en la nube y las suscripciones premium, debe crear una cuenta. Usted es responsable de:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Mantener la confidencialidad de su contraseña.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Proporcionar información veraz, precisa y actualizada.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Notificarnos inmediatamente de cualquier uso no autorizado de su cuenta.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            La aplicación puede utilizarse sin crear una cuenta, en cuyo caso los datos se almacenan únicamente en el dispositivo.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>4. Propiedad Intelectual</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid PRO y todo su contenido, diseño, funcionalidades, código fuente, logotipos y marcas son propiedad exclusiva de ZKR Studio. Está prohibido:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Copiar, modificar, distribuir o crear obras derivadas de la aplicación.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Utilizar las marcas registradas o logotipos sin autorización previa por escrito.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Extraer o reutilizar partes sustanciales del contenido de la aplicación.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>5. Suscripciones y Pagos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid PRO ofrece planes de suscripción premium (mensual, anual o de por vida) que desbloquean funciones adicionales como facturas ilimitadas, PDF sin marca de agua, plantillas premium y eliminación de anuncios.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Las suscripciones se procesan a través de Google Play Billing y son gestionadas por RevenueCat. Al suscribirse, usted:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Autoriza los cargos recurrentes según el plan seleccionado (mensual, anual o pago único).
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Acepta los términos y condiciones de Google Play.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Entiende que los pagos no son reembolsables por el periodo ya facturado, salvo lo dispuesto por Google Play.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Puede gestionar o cancelar su suscripción desde Ajustes → Gestionar suscripción en la aplicación, o desde Google Play → Suscripciones.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>6. Versión Gratuita y Anuncios</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            La versión gratuita de la aplicación muestra anuncios publicitarios a través de Google AdMob y tiene un límite mensual de facturas. Los usuarios premium no ven anuncios y disfrutan de facturas ilimitadas. Al utilizar la versión gratuita, usted acepta la visualización de anuncios y el uso de identificadores de dispositivo para personalización publicitaria, de acuerdo con nuestra Política de Privacidad y la Política de Cookies.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>7. Limitación de Responsabilidad</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid PRO se proporciona "tal cual" sin garantías de ningún tipo, expresas o implícitas. En la máxima medida permitida por la ley, ZKR Studio no será responsable de:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Pérdidas de datos, ingresos o beneficios derivados del uso de la aplicación.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Errores técnicos, interrupciones del servicio o fallos de conexión.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} Daños indirectos, incidentales, especiales o consecuentes.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            {'\u2022'} La exactitud fiscal o legal de las facturas y albaranes generados. El usuario es responsable de verificar el cumplimiento normativo de sus documentos.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>8. Cancelación</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Puede cancelar su suscripción premium en cualquier momento desde Ajustes → Gestionar suscripción en la aplicación o desde Google Play → Suscripciones. La cancelación surtirá efecto al final del periodo de facturación actual. No se otorgarán reembolsos parciales por el periodo ya facturado.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>9. Modificaciones de los Términos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Nos reservamos el derecho de modificar estos Términos en cualquier momento. Le notificaremos de cambios significativos mediante la aplicación. El uso continuado de la aplicación después de dichos cambios constituye su aceptación de los nuevos Términos.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>10. Ley Aplicable y Jurisdicción</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Estos Términos se rigen por las leyes de España. Cualquier disputa derivada de estos Términos o del uso de la aplicación se resolverá en los tribunales competentes de Madrid, España.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>11. Contacto</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Para cualquier cuestión relacionada con estos Términos, puede contactarnos a través de la aplicación (Ajustes → Privacidad y Datos).
          </Text>
          <Text style={{ fontSize: 11, color: currentTheme.colors.textSecondary, opacity: 0.4, marginTop: 20 }}>
            zkrstudio.contact@gmail.com
          </Text>

          <Text style={[styles.updateDate, { color: currentTheme.colors.textSecondary }]}>
            Última actualización: 18/06/2026
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
  headerTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  text: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  updateDate: { fontSize: 12, marginTop: 24, textAlign: 'center' },
});
