# Guía de Hardening — Supabase Dashboard (Producción)

> **Fecha**: 18/06/2026
> **Objetivo**: Aplicar los mismos settings de seguridad del `config.toml` local en el proyecto de Supabase en producción.

---

## Paso 1: Aplicar migración SQL

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto
2. Ve a **SQL Editor** (menú izquierdo)
3. Pega el contenido de `supabase/migrations/20260618000000_security_hardening.sql`
4. Haz clic en **Run**

Esto asegura que la tabla `customers` tenga RLS activo con las políticas correctas.

---

## Paso 2: Configurar requisitos de contraseña

1. Ve a **Authentication** → **Settings** (menú izquierdo)
2. En la sección **Passwords**:
   - **Minimum password length**: cambiar de `6` a **`8`**
   - **Password requirements**: seleccionar **`letters_digits`** (requiere al menos 1 letra + 1 número)
3. Haz clic en **Save**

---

## Paso 3: Ajustar rate limit de email

1. En **Authentication** → **Settings**
2. En la sección **Rate Limits**:
   - **Email sent**: cambiar de `2` a **`5`** por hora
3. Haz clic en **Save**

---

## Paso 4: CAPTCHA (⚠️ NO habilitar aún)

> **IMPORTANTE**: NO habilites CAPTCHA en producción todavía. Requiere que el cliente React Native integre el widget Turnstile primero. Si lo habilitas sin el cliente actualizado, **todos los registros e inicios de sesión fallarán**.

Cuando el cliente esté listo:
1. Ve a **Authentication** → **Settings** → **Enable Captcha**
2. Selecciona **Turnstile** como provider
3. Introduce el **Site Key** (del dashboard de Cloudflare Turnstile)
4. Introduce el **Secret Key** (del dashboard de Cloudflare Turnstile)
5. Haz clic en **Save**

---

## Paso 5: Verificar RLS activo en todas las tablas

1. Ve a **SQL Editor**
2. Ejecuta esta consulta para verificar que todas las tablas tienen RLS activo:

```sql
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE '_prisma%'
  AND tablename NOT LIKE 'pg_%'
ORDER BY rowsecurity, tablename;
```

Todas las tablas deberían mostrar `rowsecurity = true`.

---

## Paso 6: Redeploy de Edge Functions (opcional)

Si quieres desplegar la versión actualizada de `check-account-status` (sin validación de anon key):

```bash
cd supabase
npx supabase functions deploy check-account-status
```

O desde el dashboard: **Edge Functions** → **check-account-status** → **Deploy**

---

## Resumen de cambios en producción

| Setting | Antes | Después |
|---|---|---|
| Min password length | 6 | **8** |
| Password requirements | (ninguno) | **letters_digits** |
| Email rate limit | 2/h | **5/h** |
| CAPTCHA | Desactivado | **Desactivado** (documentado para activar tras integrar cliente) |
| customers RLS | Posiblemente sin RLS | **RLS activo** (SELECT own, INSERT/UPDATE solo service_role) |
