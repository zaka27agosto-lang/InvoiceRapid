import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

export default function Legal() {
  const router = useRouter();
  const { currentTheme } = useTheme();

  const legalOptions = [
    {
      id: 'privacy',
      title: 'Política de privacidad',
      icon: 'document-text-outline',
      route: '/legal/privacy',
    },
    {
      id: 'terms',
      title: 'Términos y condiciones',
      icon: 'document-outline',
      route: '/legal/terms',
    },
    {
      id: 'cookies',
      title: 'Política de cookies',
      icon: 'restaurant-outline',
      route: '/legal/cookies',
    },
    {
      id: 'contact',
      title: 'Contacto',
      icon: 'mail-outline',
      action: () => {
        // TODO: Implementar contacto
      },
    },
    {
      id: 'support',
      title: 'Soporte',
      icon: 'headset-outline',
      action: () => {
        // TODO: Implementar soporte
      },
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={currentTheme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>Legal</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: currentTheme.colors.text }]}>Información Legal</Text>
        <Text style={[styles.subtitle, { color: currentTheme.colors.textSecondary }]}>
          Consulta nuestros documentos legales y obtén ayuda
        </Text>

        {legalOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.option, { backgroundColor: currentTheme.colors.card }]}
            onPress={() => option.route ? router.push(option.route as any) : option.action?.()}
          >
            <View style={[styles.optionIcon, { backgroundColor: currentTheme.colors.primaryLight }]}>
              <Ionicons name={option.icon as any} size={24} color={currentTheme.colors.primary} />
            </View>
            <Text style={[styles.optionTitle, { color: currentTheme.colors.text }]}>{option.title}</Text>
            <Ionicons name="chevron-forward" size={20} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 22,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
});
