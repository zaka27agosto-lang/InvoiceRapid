import { Stack } from "expo-router";
import { useEffect } from "react";
import { ThemeProvider } from "../contexts/ThemeContext";
import '../utils/i18n';
import { cargarIdioma } from '../utils/i18n';
import { initDB } from "./db/database";

export default function RootLayout() {
  useEffect(() => {
    initDB();
    cargarIdioma();
  }, []);

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="auth/forgot-password" />
        <Stack.Screen name="auth/profile" />
        <Stack.Screen name="legal" />
        <Stack.Screen name="legal/privacy" />
        <Stack.Screen name="legal/terms" />
        <Stack.Screen name="legal/cookies" />
        <Stack.Screen name="(tabs)/checkout" />
      </Stack>
    </ThemeProvider>
  );
}