# Cómo aplicar las 3 migrations nuevas a Supabase

Fecha: 2026-06-21
Migrations a aplicar:

| # | Archivo | Cambios |
|---|---|---|
| 1 | `supabase/migrations/20260621000000_add_referral_ad_thresholds.sql` | INSERT 2 keys en `app_config`: `referral_required_count`, `interstitial_every_n_actions` |
| 2 | `supabase/migrations/20260621000001_add_monthly_free_invoice_limit.sql` | INSERT 1 key en `app_config`: `monthly_free_invoice_limit` |
| 3 | `supabase/migrations/20260621000002_invoice_rpc_dynamic_limit.sql` | `CREATE OR REPLACE FUNCTION check_and_increment_invoice` → ahora lee el límite dinámico desde `app_config` |

He preparado `scripts/apply-20260621-bundle.sql` con los 3 cambios envueltos en una transacción `BEGIN/COMMIT` para aplicación atómica.

---

## Path A — Pegar en el SQL Editor (recomendado, 30 segundos)

Sin autenticación previa, sin instalar nada. Es el camino más corto.

1. Abre esta URL en tu navegador:
   ```
   https://supabase.com/dashboard/project/rvolqqtlmdyggrhfzwip/sql/new
   ```
2. Abre `scripts/apply-20260621-bundle.sql` en tu editor.
3. Selecciona todo (Ctrl+A) → copia (Ctrl+C).
4. Pega en el editor SQL de Supabase (Ctrl+V).
5. Pulsa **Run** (o Ctrl+Enter).
6. Verás un toast **Success. No rows returned** — eso es correcto.
7. Ejecuta las verificaciones manuales (al final del archivo) para confirmar que las 4 keys existen en `app_config` y que la función fue reemplazada.

**Tiempo total: ~30 segundos.** ✅

---

## Path B — `supabase db push` con CLI (recomendado para próximos migrations)

Una sola configuración y aplica futuros migrations con un comando. Hoy aplica estos 3 y todos los nuevos que añadas.

### Primer uso (una sola vez)

```powershell
# Instalar supabase CLI globalmente (si no está) — Node 20+ requerido
npm install -g supabase

# Autenticarte (abrirá el navegador)
npx supabase login

# Vincular este proyecto a Supabase
npx supabase link --project-ref rvolqqtlmdyggrhfzwip
# Te pedirá la DB password (la encuentras en Supabase Dashboard → Settings → Database)
```

### Aplicar las migrations de hoy

```powershell
# Aplicar TODAS las migrations nuevas que aún no se hayan aplicado
npx supabase db push
```

Esto recorre `supabase/migrations/` en orden cronológico y aplica solo las que aún no se han ejecutado. Verás algo como:

```
Applying migration 20260621000000_add_referral_ad_thresholds.sql... ✅
Applying migration 20260621000001_add_monthly_free_invoice_limit.sql... ✅
Applying migration 20260621000002_invoice_rpc_dynamic_limit.sql... ✅
```

**Tiempo total: ~2 minutos** (1m setup la primera vez, 5s en futuro). ✅

---

## Path C — Dame un `SUPABASE_ACCESS_TOKEN` y lo aplico yo

Si quieres que yo lo aplique desde aquí, necesitas:

1. Generar un **Personal Access Token** (PAT) en
   https://supabase.com/dashboard/account/tokens → "Generate new token".
2. Pegar el token en tu próximo mensaje. **Yo NO guardaré el token; solo lo uso para esta sesión y lo olvido al terminar.**
3. Yo ejecuto:

```bash
SUPABASE_ACCESS_TOKEN=<tu_token> npx supabase link --project-ref rvolqqtlmdyggrhfzwip
SUPABASE_ACCESS_TOKEN=<tu_token> npx supabase db push
```

---

## Antes de aplicar — consejo operativo

Postgres usa MVCC, así que `CREATE OR REPLACE FUNCTION` no rompe las llamadas concurrentes a la RPC antigua — pero puede causar microesperas (lock-wait de unos ms) en transacciones que estén leyendo `invoice_counters` justo en ese momento (la RPC hace `SELECT ... FOR UPDATE`). **Recomendado: aplicar en horas de poco tráfico** (noche UTC), especialmente si tienes usuarios activos. No es exigido para correctness, pero evita sustos innecesarios en una app en producción.

## Después de aplicar — auditoría rápida

Ejecuta una vez después del bundle para confirmar que las 3 keys nuevas tienen valores enteros válidos. Si alguna está vacía, contendrá `value IS NULL` o no-matcheará la regex → emite `RAISE WARNING` en CADA llamada RPC, lo que ensucia los logs de Supabase hasta que la arregles:

```sql
-- Debe devolver 0 filas. Si devuelve alguna, edita el valor con:
--   UPDATE public.app_config SET value = '5' WHERE key = 'monthly_free_invoice_limit';
SELECT key, value FROM public.app_config
 WHERE key IN ('referral_required_count', 'interstitial_every_n_actions', 'monthly_free_invoice_limit')
   AND (value IS NULL OR value !~ '^[0-9]+$');
```

## Si algo falla

### "permission denied for table app_config"

Significa que estás ejecutando el bundle como **anon role**. El SQL Editor de Supabase usa por defecto `postgres` (superuser), así que esto no debería pasar. Si pasa, asegúrate de que estés en el editor SQL del **Dashboard**, no en un script que llame a `postgrest`.

### "function check_and_increment_invoice does not exist"

No problem — `CREATE OR REPLACE` la crea si no existe (es la firma estándar de SQL). Si ves este mensaje, probablemente la migration #3 se ejecutó sin que la #1/#2 se aplicaran primero. La función intentará leer `app_config`, no la encontrará, y caerá al default 5 (por la rama `IF NOT EXISTS`). Aún así aplica #1 y #2 después.

### "policy already exists" o "duplicate key"

Los `INSERT ... ON CONFLICT DO NOTHING` son idempotentes. Si ves este error, simplemente ignóralo — significa que ya se aplicó antes.

---

## Verificación post-aplicación

Ejecuta manualmente estas queries en el SQL Editor para confirmar:

```sql
-- 1. Las 4 keys de app_config están ahí
SELECT key, value FROM public.app_config ORDER BY key;
-- Esperado: interstitial_every_n_actions=3, max_rewarded_ads_per_month=1,
--           monthly_free_invoice_limit=5, referral_required_count=2

-- 2. La RPC tiene SECURITY DEFINER
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'check_and_increment_invoice';
-- Esperado: prosecdef = true (SECURITY DEFINER está activo)

-- 3. Bonus: smoke test de la RPC (sólo si tienes un user válido)
SELECT check_and_increment_invoice(
  (SELECT id FROM auth.users LIMIT 1),
  to_char(now(), 'YYYY-MM'),
  'check'
);
```

---

## Por qué no lo apliqué yo directamente

Lo intenté. La situación:

- ✅ `supabase` CLI v2.102.0 disponible vía `npx`.
- ❌ Ningún `.env` con `SUPABASE_DB_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY` ni `SUPABASE_ACCESS_TOKEN`.
- ❌ `.supabase/` link directory no existe → proyecto no vinculado localmente.
- ❌ No hay navegador con Chrome instalado en el entorno CLI actual → no puedo abrir el SQL editor.

Por eso te dejo los 3 paths anteriores. El **Path A** es el más corto: abrir URL, pegar, Run.
