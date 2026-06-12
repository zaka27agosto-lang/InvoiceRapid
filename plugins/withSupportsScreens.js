const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin: añade <supports-screens> al AndroidManifest.xml
 * para limitar la app solo a móviles (no tablets) en Google Play.
 *
 * Sobrevive a `npx expo prebuild --clean` porque se ejecuta
 * durante el proceso de prebuild de Expo.
 */
const withSupportsScreens = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    androidManifest['supports-screens'] = [
      {
        $: {
          'android:smallScreens': 'true',
          'android:normalScreens': 'true',
          'android:largeScreens': 'false',
          'android:xlargeScreens': 'false',
          'android:requiresSmallestWidthDp': '320',
        },
      },
    ];

    return config;
  });
};

module.exports = withSupportsScreens;
