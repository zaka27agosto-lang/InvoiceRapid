# InvoiceRapid Pro

App profesional de facturación y albaranes para Android — desde el móvil, sin conexión forzada.

**[📲 Descargar en Google Play](https://play.google.com/store/apps/details?id=com.zkrstudio.invoicerapidpro)** *(próximamente)*

---

## ✨ Qué hace

- **Crea facturas y albaranes** en segundos, con IVA/IRPF, descuentos y múltiples líneas.
- **Personaliza**: 7 colores principales, modo claro/oscuro, plantillas PDF estándar/premium.
- **Sin conexión permanente**: datos en local (SQLite). La sincronización con la nube es opcional.
- **Suscripciones** vía RevenueCat (mensual / anual / lifetime).
- **Anuncios** vía Google AdMob (versión gratuita).
- **Programa de referidos**: invita a 2 amigos y obtén 1 mes Pro gratis.
- **5 idiomas**: Español, Inglés, Francés, Alemán, Italiano.

## 🛠 Stack técnico

- **Mobile:** Expo SDK 54 · React Native 0.81 (`newArchEnabled`) · Expo Router 6
- **Estado / datos:** AsyncStorage + SQLite local + Supabase (sincronización opcional)
- **Auth + DB:** Supabase (Postgres, RLS, Edge Functions)
- **Pagos:** RevenueCat + Google Play Billing
- **Anuncios:** Google Mobile Ads SDK (AdMob) + UMP (RGPD)
- **Crash reporting:** Firebase Crashlytics
- **i18n:** i18next + react-i18next (5 locales)
- **Realtime config:** Supabase `app_config` con hot-reload (polling 60 s foreground / 5 min background)

## 📁 Estructura del proyecto

```
app/                    # Rutas (expo-router)
  (tabs)/               # Tabs principales (Inicio, Documentos, Clientes… etc.)
  auth/                 # Login, registro, recuperación
  legal/                # Políticas legales (in-app)
  onboarding/           # Primera vez
  settings/             # Configuración secundaria
components/             # Componentes reutilizables
contexts/               # Auth, Sync, Subscription, Theme
hooks/                  # Custom hooks
services/               # adsService, crashlytics, secureStorage, supabase, syncService
supabase/
  functions/            # Edge Functions Deno Deploy
  migrations/           # SQL migrations versionadas
utils/                  # currency, deviceId, i18n, pdf, remoteConfig, subscription, themes
```

## 🚀 Desarrollo local

```bash
# 1. Instalar dependencias
npm install

# 2. Crear .env con tus claves (o usar las de EAS)
# EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=...

# 3. Iniciar Metro
npx expo start

# 4. Build desarrollo (Android)
npx expo run:android
```

## 🔨 Build de producción

```bash
# Configurar EAS secrets en https://expo.dev/accounts/[owner]/projects/[slug]/secrets
#   EXPO_PUBLIC_SUPABASE_URL
#   EXPO_PUBLIC_SUPABASE_ANON_KEY
#   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
#   GOOGLE_ADS_IOS_APP_ID

# Compilar APK (production)
eas build --platform android --profile production

# Submit a Play Store automático
eas submit --platform android --latest
```

## 🧪 Calidad

- **TypeScript estricto:** `npx tsc --noEmit`
- **Lint:** `npx expo lint`
- **Edge Functions:** desplegar individualmente con `supabase functions deploy <name>`

## 🔐 Seguridad

- RLS en todas las tablas Supabase (ver `supabase/rls-policies.sql`)
- Rate limits en Edge Functions sensibles (referidos, auth, account actions)
- Migración de soft-delete → hard-delete tras 30 días (cron `finalize-deletion`)
- Campos sensibles (`referral_used`, `device_id`) protegidos por trigger SQL
- Hardening de passwords (min 8 + letters_digits) configurado en dashboard
- Ver guía completa: `supabase/SECURITY_HARDENING_GUIDE.md`

## 📝 Documentación adicional

- `supabase/SECURITY_HARDENING_GUIDE.md` — checklist de seguridad pre-producción
- `docs/PUBLISHING_CHECKLIST.md` — checklist de publicación en Play Store
- `BUILD.md` — instrucciones detalladas de build
- `programa-completo.txt` — snapshot completo del código (regenerado por IA)

## 📄 Licencia

Privativa — © ZKR Studio. Todos los derechos reservados.

## 📬 Contacto

- Soporte in-app: Ajustes → Privacidad y Datos
- Email: zkrstudio.contact@gmail.com
- Política de privacidad: https://zaka27agosto-lang.github.io/InvoiceRapid/privacy-policy.html
- Términos y condiciones: https://zaka27agosto-lang.github.io/InvoiceRapid/terms.html
