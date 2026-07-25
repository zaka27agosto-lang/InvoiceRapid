import { Ionicons } from "@expo/vector-icons";
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useModernAlert } from "../../components/ModernAlert";

export default function Legal() {
  const router = useRouter();
  const { t } = useTranslation();
  const modernAlert = useModernAlert();
  const { currentTheme } = useTheme();

  // Las URLs legales vienen de app.config.ts → extra.legalUrls (env-driven).
  const legalUrls = (Constants.expoConfig?.extra as any)?.legalUrls ?? {};
  const PRIVACY_URL: string = legalUrls.privacy;
  const TERMS_URL: string = legalUrls.terms;
  const COOKIES_URL: string = legalUrls.cookies;
  const DELETION_URL: string = legalUrls.accountDeletion;
  const SUPPORT_EMAIL: string = legalUrls.support ?? 'zkrstudio.contact@gmail.com';

  async function openExternal(url: string, label: string) {
    if (!url) {
      modernAlert.showError(t('error'), 'URL no configurada todavía')
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        modernAlert.showError(t('error'), `No se puede abrir ${label} en este dispositivo`)
        return;
      }
      await Linking.openURL(url);
    } catch (err: any) {
      modernAlert.showError(t('error'), err?.message ?? `Error abriendo ${label}`)
    }
  }

  const legalOptions = [
    {
      id: 'privacy',
      title: t('politica_privacidad'),
      icon: 'document-text-outline',
      route: '/legal/privacy',
      externalUrl: PRIVACY_URL,
      externalLabel: 'Política de privacidad (online)',
    },
    {
      id: 'terms',
      title: t('terminos_condiciones'),
      icon: 'document-outline',
      route: '/legal/terms',
      externalUrl: TERMS_URL,
      externalLabel: 'Términos y condiciones (online)',
    },
    {
      id: 'cookies',
      title: t('politica_cookies'),
      icon: 'restaurant-outline',
      route: '/legal/cookies',
      externalUrl: COOKIES_URL,
      externalLabel: 'Política de cookies (online)',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={currentTheme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>{t('legal')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: currentTheme.colors.text }]}>{t('informacion_legal')}</Text>
        <Text style={[styles.subtitle, { color: currentTheme.colors.textSecondary }]}>
          {t('consulta_documentos')}
        </Text>

        {legalOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.option, { backgroundColor: currentTheme.colors.card }]}
            onPress={() => router.push(option.route as any)}
          >
            <View style={[styles.optionIcon, { backgroundColor: currentTheme.colors.primaryLight }]}>
              <Ionicons name={option.icon as any} size={24} color={currentTheme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { color: currentTheme.colors.text }]}>{option.title}</Text>
              <TouchableOpacity onPress={() => openExternal(option.externalUrl, option.externalLabel)}>
                <Text style={[styles.openExternal, { color: currentTheme.colors.primary }]}>
                  <Ionicons name="open-outline" size={12} color={currentTheme.colors.primary} />{' '}
                  {option.externalLabel}
                </Text>
              </TouchableOpacity>
            </View>
            <Ionicons name="chevron-forward" size={20} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>
        ))}

        {/* Bloque "Eliminar cuenta" — requerido por Google Play */}
        <TouchableOpacity
          style={[styles.option, { backgroundColor: currentTheme.colors.card }]}
          onPress={() => openExternal(DELETION_URL, 'Account deletion')}
        >
          <View style={[styles.optionIcon, { backgroundColor: currentTheme.colors.primaryLight }]}>
            <Ionicons name="trash-outline" size={24} color={currentTheme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.optionTitle, { color: currentTheme.colors.text }]}>
              {t('cuenta_eliminada_titulo')}
            </Text>
            <Text style={[styles.openExternal, { color: currentTheme.colors.primary }]}>
              <Ionicons name="open-outline" size={12} color={currentTheme.colors.primary} />{' '}
              Cómo eliminar tu cuenta (online)
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={currentTheme.colors.textSecondary} />
        </TouchableOpacity>

        {/* Soporte email */}
        <TouchableOpacity
          style={[styles.supportRow]}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}
        >
          <Ionicons name="mail-outline" size={20} color={currentTheme.colors.primary} />
          <Text style={[styles.supportText, { color: currentTheme.colors.text }]}>{SUPPORT_EMAIL}</Text>
        </TouchableOpacity>

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
  openExternal: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  supportText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
