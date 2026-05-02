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
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Introducción</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            InvoiceRapid ("nosotros", "nuestra" o "la aplicación") se compromete a proteger su privacidad. Esta Política de Privacidad explica cómo recopilamos, utilizamos y protegemos su información personal cuando utiliza nuestra aplicación móvil de facturación.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Datos que Recopilamos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Recopilamos la siguiente información:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Datos de la cuenta:</Text> Nombre, correo electrónico, información de perfil.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Datos de facturación:</Text> Información de clientes, facturas, productos, configuraciones de moneda y plantillas.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Datos de uso:</Text> Cómo utiliza la aplicación, funciones activadas, preferencias.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Datos de dispositivo:</Text> Tipo de dispositivo, sistema operativo, identificador único del dispositivo.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Uso de Datos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Utilizamos sus datos para:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Proporcionar y mejorar nuestros servicios de facturación.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Gestionar su cuenta y preferencias.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Procesar pagos y gestionar suscripciones.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Enviar notificaciones importantes sobre su cuenta.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Analizar el uso para mejorar la aplicación.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Compartir de Datos</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            No vendemos sus datos personales. Solo compartimos información con:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Proveedores de servicios:</Text> Procesadores de pagos (Stripe), servicios de autenticación, cuando es necesario para el funcionamiento de la aplicación.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Autoridades legales:</Text> Cuando lo requiera la ley o para proteger nuestros derechos.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Seguridad</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Implementamos medidas de seguridad robustas para proteger su información:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Cifrado de datos en tránsito y en reposo.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Almacenamiento local seguro en su dispositivo.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Acceso restringido a información sensible.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Actualizaciones regulares de seguridad.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Derechos del Usuario</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Usted tiene derecho a:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Acceder:</Text> Solicitar una copia de sus datos personales.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Corregir:</Text> Actualizar información incorrecta.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Eliminar:</Text> Solicitar la eliminación de su cuenta y datos.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Exportar:</Text> Descargar sus datos en un formato legible.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • <Text style={{ fontWeight: '600' }}>Oponerse:</Text> Oponerse al procesamiento de sus datos.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Cookies</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Utilizamos cookies y tecnologías similares para:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Recordar sus preferencias y configuraciones.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Analizar el uso de la aplicación.
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            • Mostrar anuncios personalizados (si corresponde).
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Puede gestionar sus preferencias de cookies en la configuración de la aplicación.
          </Text>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Contacto</Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Si tiene preguntas sobre esta Política de Privacidad o sus derechos, puede contactarnos en:
          </Text>
          <Text style={[styles.text, { color: currentTheme.colors.textSecondary }]}>
            Email: support@invoicerapid.com
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
