import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BannerAdComponent from "../../components/BannerAdComponent";
import { useModernAlert } from "../../components/ModernAlert";
import { SubscriptionProvider, useSubscription } from "../../contexts/SubscriptionContext";
import { useTheme } from "../../contexts/ThemeContext";
import { getExchangeRates } from "../../utils/currency";
import { formGuard } from "../../utils/formGuard";

/** Banner persistente que sobrevive a cambios de pestaña.
 *  SIN key=isPremium: mantener el componente montado evita que el
 *  BannerAd nativo pierda su referencia al alternar premium. */
function PersistentBanner() {
  const { isPremium } = useSubscription();
  return <BannerAdComponent isPremium={isPremium} />;
}

function TabsContent() {
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const modernAlert = useModernAlert();

  // Listener que bloquea el cambio de tab si hay cambios sin guardar en un formulario.
  // Ahora usa ModernAlert (mismo estilo que el botón X) en vez de Alert.alert nativo.
  const makeTabPressListener = (navigation: any, routeName: string) => ({
    tabPress: (e: any) => {
      if (formGuard.hasUnsaved) {
        e.preventDefault();
        modernAlert.showConfirm(
          '',
          t('confirmar_salir_factura_cambios'),
          () => {
            formGuard.hasUnsaved = false;
            navigation.navigate(routeName);
          },
          t('salir'),
          t('cancelar')
        );
      }
    },
  });

  useEffect(() => {
    // Actualizar tipos de cambio al abrir la app
    if (__DEV__) getExchangeRates().catch(err => console.log('[Currency] Error al actualizar tipos de cambio:', err));
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <PersistentBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: currentTheme.colors.primary,
          tabBarInactiveTintColor: currentTheme.colors.textSecondary,
          tabBarStyle: {
            backgroundColor: currentTheme.colors.card,
            borderTopWidth: 1,
            borderTopColor: currentTheme.colors.border,
            height: 70 + insets.bottom,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
            paddingTop: 10,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen name="index" options={{
          tabBarLabel: t('inicio'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }} listeners={({ navigation }) => makeTabPressListener(navigation, 'index')} />
        <Tabs.Screen name="documentos" options={{
          tabBarLabel: t('documentos'),
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
        }} listeners={({ navigation }) => makeTabPressListener(navigation, 'documentos')} />
        <Tabs.Screen name="clientes" options={{
          tabBarLabel: t('clientes'),
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }} listeners={({ navigation }) => makeTabPressListener(navigation, 'clientes')} />
        <Tabs.Screen name="productos" options={{
          tabBarLabel: t('productos'),
          tabBarIcon: ({ color, size }) => <Ionicons name="pricetag-outline" size={size} color={color} />,
        }} listeners={({ navigation }) => makeTabPressListener(navigation, 'productos')} />
        <Tabs.Screen name="informes" options={{
          tabBarLabel: t('informes'),
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={color} />,
        }} listeners={({ navigation }) => makeTabPressListener(navigation, 'informes')} />
        <Tabs.Screen name="ajustes" options={{
          tabBarLabel: t('ajustes'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }} listeners={({ navigation }) => makeTabPressListener(navigation, 'ajustes')} />
        <Tabs.Screen name="nueva-factura" options={{ href: null }} />
        <Tabs.Screen name="nuevo-albaran" options={{ href: null }} />
        <Tabs.Screen name="facturas" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <SubscriptionProvider>
      <TabsContent />
    </SubscriptionProvider>
  );
}
