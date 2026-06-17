// ============================================================
// app.config.ts — Configuración dinámica de Expo
//
// Los valores sensibles se leen de variables de entorno para
// no hardcodearlos en el repositorio:
//   - GOOGLE_ADS_ANDROID_APP_ID  → AdMob Android App ID
//   - GOOGLE_ADS_IOS_APP_ID      → AdMob iOS App ID (debe ser DISTINTO del de Android)
//   - EAS_PROJECT_ID              → Proyecto en EAS Build
//   - BUNDLE_IDENTIFIER           → Bundle ID de la app
//
// ⚠️ Antes del build de producción iOS:
//    Ir a AdMob → Aplicaciones → crear app iOS y obtener su propio ID
//    (el actual es un placeholder que debe sustituirse)
// ============================================================

import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'InvoiceRapid',
  slug: 'invoicerapid-pro',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'invoicerapid',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,

  ios: {
    supportsTablet: false, // Solo móviles, no tablets
    bundleIdentifier: process.env.BUNDLE_IDENTIFIER || '',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  android: {
    icon: './assets/icon.png',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    versionCode: 28,
    package: process.env.BUNDLE_IDENTIFIER || 'com.zkrstudio.invoicerapidpro',
    googleServicesFile: './google-services.json',
  },

  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },

  plugins: [
    './plugins/withSupportsScreens',
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          backgroundColor: '#000000',
        },
      },
    ],
    'expo-secure-store',
    'expo-sqlite',
    [
      'react-native-google-mobile-ads',
      {
        androidAppId: 'ca-app-pub-3758182602063783~1918923220',
        iosAppId: process.env.GOOGLE_ADS_IOS_APP_ID || '',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 35,
          minSdkVersion: 24,
        },
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  extra: {
    router: {},
    eas: {
      projectId: process.env.EAS_PROJECT_ID || '45ccc530-324d-40e6-8434-15dae44a992c',
    },
  },

  owner: 'zkr-studio',
};

export default config;
