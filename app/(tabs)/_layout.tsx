import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SubscriptionProvider } from "../../contexts/SubscriptionContext";
import { useTheme } from "../../contexts/ThemeContext";
import { getExchangeRates } from "../../utils/currency";

export default function TabsLayout() {
  const { t } = useTranslation();
  const { currentTheme } = useTheme();

  useEffect(() => {
    // Actualizar tipos de cambio al abrir la app
    getExchangeRates().catch(err => {
      console.error('Error al actualizar tipos de cambio al iniciar la app:', err);
    });
  }, []);

  return (
    <SubscriptionProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: currentTheme.colors.primary,
          tabBarInactiveTintColor: "#aaa",
          tabBarStyle: {
            backgroundColor: "#fff",
            borderTopWidth: 1,
            borderTopColor: "#f0f0f0",
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
        <Tabs.Screen name="facturas" options={{ href: null }} />
      </Tabs>
    </SubscriptionProvider>
  );
}
