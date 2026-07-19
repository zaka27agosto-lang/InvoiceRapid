# 📋 Checklist de publicación en Play Store — InvoiceRapid Pro

> **Última actualización:** 21/06/2026
> **Objetivo:** Tener la app lista para subir a Google Play Store sin rechazos.

---

## ✅ Tareas que YO puedo hacer (código) — YA COMPLETADAS

- [x] **README.md** branded (no el template de Expo)
- [x] **`app_config` para umbrales configurables** (referidos, interstitial, límite mensual) con hot-reload
- [x] **Cache unificado** en `utils/remoteConfig.ts` (eliminado cache dual en `subscription.ts`)
- [x] **`privacyPolicyUrl` + `termsUrl`** añadidos a `app.config.ts` (env-driven, default a GitHub Pages)
- [x] **Botón "Abrir online"** en `app/legal/index.tsx` para acosar a los usuarios con la versión online
- [x] **Checkbox `infoPlist.ITSAppUsesNonExemptEncryption = false`** ya configurado (evita preguntas extra en App Store)

---

## 🟠 Tareas REQUERIDAS antes de subir a Play Store (no automatizables)

### 1. Verificar el cron `finalize-deletion` en Supabase

**Problema:** Si la Edge Function `finalize-deletion` no está programada por cron, las cuentas marcadas para eliminación NUNCA se borran ⇒ incumple Account Deletion requirement de Google (rechazo seguro).

**Cómo verificar:**

1. Ve a Supabase Dashboard → tu proyecto → **Database** → **Cron Jobs** (menú izquierdo)
2. Busca un cron llamado `finalize-account-deletions` (o similar)
3. SU NO EXISTE → créalo con esta SQL:

```sql
-- Ejecutar en SQL Editor
SELECT cron.schedule(
  'finalize-account-deletions',
  '0 3 * * *',  -- 3 AM diario
  $$SELECT finalize_deletion();$$
);
```

4. Para probar manualmente:

```sql
-- Ver cuántas eliminaciones pendientes hay
SELECT COUNT(*) FROM account_deletions WHERE status = 'pending' AND expires_at < NOW();

-- Forzar manualmente la función (idempotente)
SELECT finalize_deletion();

-- Verificar que las filas expiradas se procesaron
SELECT * FROM account_deletions ORDER BY expires_at DESC LIMIT 10;
```

5. **Verificar que la función borra usuarios de `auth.users`**. Mira el código en `supabase/functions/finalize-deletion/index.ts` — debe llamar a `supabaseAdmin.auth.admin.deleteUser(userId)`.

---

### 2. Completar el Data Safety Form en Play Console

Antes de la primera submission, Google te obliga a declarar qué datos recoge/comparte la app. Entra en **Play Console → Policy → App Content → Data safety** y rellena:

**Data collected (YES):**
| Category | Data type | Purpose | Sharing |
|---|---|---|---|
| Account info · Email address | App functionality, Account management | No |
| Account info · User IDs | App functionality | No |
| Personal info · Name | App functionality | No |
| Financial info · Purchase history | App functionality | RevenueCat (server-side) |
| Financial info · Other financial data (invoices) | App functionality | No |

**Data collected automatically (YES):**
| Category | Data type | Purpose | Sharing |
|---|---|---|---|
| App activity · App interactions | Analytics | Crashlytics |
| Device info · Device IDs (AAID) | Advertising, Fraud prevention | Google AdMob |
| Crash logs | Analytics | Crashlytics |

**Data sharing (YES):**
- Crashlytics: Crash logs (analytics)
- Google AdMob: AAID (advertising)
- RevenueCat: Purchase receipts (server-side processing)

Copy-paste guidance: las URLs exactas de las políticas de cada tercero:
- RevenueCat: https://revenuecat.com/privacy
- Crashlytics: https://firebase.google.com/support/privacy
- AdMob: https://policies.google.com/privacy

---

### 3. Hospedar las páginas legales en una URL pública

**Problema:** Google Play Console pide URL de "Privacy policy" accesible públicamente (sin login). Las pantallas in-app no cuentan.

**Páginas existentes en `docs/`:**
- `docs/privacy-policy.html`
- `docs/terms.html`
- `docs/cookies.html`
- `docs/account-deletion.html`
- `docs/index.html`

**Opciones (gratis):**

a) **GitHub Pages** (ya mencionado en `privacy.tsx`): subir los HTML a la rama `gh-pages` de tu repo, o a una carpeta `/docs/` activada en Settings → Pages. URL: `https://<usuario>.github.io/InvoiceRapid/<archivo>`
   - Ventaja: cero config extra.
   - Desventaja: si tu repo es privado, GitHub Pages también lo es (no bueno para Play Console público).

b) **Netlify / Vercel**: drag & drop de la carpeta `docs/` a https://app.netlify.com/drop. Te da URL instantánea tipo `https://invoicerapid-pro.netlify.app`.
   - Ventaja: setup 5 min.
   - Desventaja: URL fea hasta configurar dominio.

c) **Cloudflare Pages** + dominio custom: si tienes `tudominio.com`, configura `https://app.tudominio.com/legal/privacy` etc.

**Recomendado:** opción (b) para empezar y migrar a opción (c) si tienes dominio.

Tras subir, actualiza estas URLs en `app.config.ts` (o vía EAS Secret):

```
LEGAL_PRIVACY_URL=https://<tu-url>/privacy-policy.html
LEGAL_TERMS_URL=https://<tu-url>/terms.html
LEGAL_COOKIES_URL=https://<tu-url>/cookies.html
LEGAL_DELETION_URL=https://<tu-url>/account-deletion.html
```

---

### 4. Crear página de "Account deletion" accesible públicamente

Además de la URL anterior, Google Play requiere una URL dedicada al account deletion process (no solo "ver política de privacidad"). Debe explicar:
- Cómo el usuario puede eliminar su cuenta desde la app (Ajustes → Borrar cuenta)
- Qué pasa con sus datos (eliminación tras 30 días)
- Qué datos se eliminan / qué no (facturas por obligación fiscal si aplica)
- Un email de contacto

`docs/account-deletion.html` ya existe. Solo necesitas **hospedarlo en URL pública** (paso 3).

---

### 5. Configurar credenciales de AdMob iOS para iOS (si vas a publicar también en App Store)

`app.config.ts` tiene esta línea:

```ts
iosAppId: process.env.GOOGLE_ADS_IOS_APP_ID || '',
```

Si `GOOGLE_ADS_IOS_APP_ID` no está configurado en EAS Secrets, iOS no compilará correctamente con AdMob.

**Cómo:**
1. Ve a https://apps.admob.com → crear aplicación iOS
2. Copia el `ca-app-pub-...~XXXX` AdMob App ID
3. Añade como EAS Secret: `eas secret:create --name GOOGLE_ADS_IOS_APP_ID --value "ca-app-pub-..."`

---

## ✅ Quick checklist (copiar a tu tracker)

```
[ ] Cron finalize-deletion verificado en Supabase
[ ] Data Safety Form completado en Play Console
[ ] Privacy Policy hosted en URL pública
[ ] Account Deletion page hosted en URL pública
[ ] AdMob iOS App ID configurado (solo si publicas iOS)
[ ] Screenshot, icono 512×512, feature graphic 1024×500 subidos a Play Console
[ ] Descripción, short description, "What's new" escritos
[ ] Content rating completado (IARC questionnaire)
[ ] Target audience (no children) declarado
[ ] App access (sin login para versión sin sync funciona, sí login para sync)
[ ] Ads declaration (YES, contiene ads)
[ ] Beta testers (Internal testing track) verificado
```

---

## 🛟 Si Google rechaza tu submission

**Probable si olvidaste algo:**
- "Privacy policy URL not accessible" → paso 3
- "Account deletion not implemented" → paso 1 + paso 4
- "Data safety form inconsistent with actual data collection" → paso 2
- "App not functioning in tested devices" → instala en al menos 5 devices reales antes de submit

**Otros rechazos comunes:**
- Icono / screenshots no en resolución correcta
- Descripción con referencias a "competencia"
- Falta "What's new" en idioma nativo del país target

---

## 🚨 Después de publicar

- Monitorear `Play Console → Crashes & ANRs` durante las primeras 72 h. Google puede suspender la app si el crash-free < 95 %.
- Responder a los reviews < 48 h. Reviews negativas sin respuesta bajan tu rating.
- Mantén `app_config` actualizado: si ves churn por el límite de 5 facturas, prueba con 8 y mide.
