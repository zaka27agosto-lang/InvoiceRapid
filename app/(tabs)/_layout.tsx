import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import BannerAdComponent from "../../components/BannerAdComponent";
import { SubscriptionProvider, useSubscription } from "../../contexts/SubscriptionContext";
import { useTheme } from "../../contexts/ThemeContext";
import { getExchangeRates } from "../../utils/currency";

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
            height: 80,
            paddingBottom: 20,
            paddingTop: 10,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen name="index" options={{
          tabBarLabel: t('inicio'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }} />
        <Tabs.Screen name="documentos" options={{
          tabBarLabel: t('documentos'),
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
        }} />
        <Tabs.Screen name="clientes" options={{
          tabBarLabel: t('clientes'),
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }} />
        <Tabs.Screen name="productos" options={{
          tabBarLabel: t('productos'),
          tabBarIcon: ({ color, size }) => <Ionicons name="pricetag-outline" size={size} color={color} />,
        }} />
        <Tabs.Screen name="informes" options={{
          tabBarLabel: t('informes'),
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={color} />,
        }} />
        <Tabs.Screen name="ajustes" options={{
          tabBarLabel: t('ajustes'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }} />
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
