import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export default function Terms() {
  const router = useRouter();
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={currentTheme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: currentTheme.colors.text }]}>Términos y Condiciones</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Introducción</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Bienvenido a InvoiceRapid. Estos Términos y Condiciones ("Términos") rigen el uso de nuestra aplicación móvil de facturación. Al descargar, instalar o utilizar InvoiceRapid, usted acepta estos Términos.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Uso del Servicio</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid le permite crear, gestionar y enviar facturas. Usted acepta utilizar el servicio únicamente para fines legítimos y de conformidad con estos Términos. No está permitido:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Utilizar la aplicación para actividades fraudulentas o ilegales.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Crear facturas falsas o engañosas.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Intentar acceder a cuentas o datos de otros usuarios sin autorización.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Interferir con el funcionamiento de la aplicación.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Cuenta de Usuario</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Para acceder a ciertas funciones, debe crear una cuenta. Usted es responsable de:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Mantener la confidencialidad de su contraseña.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Proporcionar información veraz y actualizada.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Notificarnos inmediatamente de cualquier uso no autorizado de su cuenta.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Propiedad Intelectual</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid y todo su contenido, diseño, funcionalidades y código son propiedad exclusiva de InvoiceRapid. Está prohibido:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Copiar, modificar o distribuir la aplicación.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Utilizar marcas registradas o logotipos sin autorización.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Realizar ingeniería inversa de la aplicación.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Limitación de Responsabilidad</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid se proporciona "tal cual" sin garantías de ningún tipo. No somos responsables de:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Pérdidas de datos o ingresos derivados del uso de la aplicación.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Errores técnicos o interrupciones del servicio.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Daños indirectos, incidentales o consecuentes.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Pagos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Los pagos de suscripciones Premium se procesan a través de Stripe. Al suscribirse, usted:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Autoriza los cargos recurrentes según el plan seleccionado.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Acepta los términos y condiciones de Stripe.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Entiende que los pagos no son reembolsables por el periodo ya facturado.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Cancelación</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Puede cancelar su suscripción Premium en cualquier momento desde la configuración de la aplicación. La cancelación surtirá efecto al final del periodo de facturación actual. No se otorgarán reembolsos parciales.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Modificaciones</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Nos reservamos el derecho de modificar estos Términos en cualquier momento. Le notificaremos de cambios importantes mediante la aplicación. El uso continuado de la aplicación después de dichos cambios constituye su aceptación.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Ley Aplicable</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Estos Términos se rigen por las leyes de España. Cualquier disputa se resolverá en los tribunales competentes de Madrid, España.
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
