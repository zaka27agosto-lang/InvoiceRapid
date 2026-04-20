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
      </Stack>
    </ThemeProvider>
  );
}