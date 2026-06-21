import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || ''
)

const REVENUECAT_SECRET_KEY = Deno.env.get('REVENUECAT_SECRET_KEY') || ''
const REVENUECAT_API = 'https://api.revenuecat.com/v1'

// Rate limiting: Map con TTL manual (no shared state entre instancias de Deno Deploy,
// pero efectivo para ráfagas dentro de la misma instancia)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

// ─── Configuración remota desde app_config ───
// Estos valores se pueden cambiar desde el dashboard de Supabase sin recompilar.
// Si la query falla o el valor es inválido, usamos defaults conservadores.
// Cachear module-level es SEGURO aquí: cada invocación es stateless, pero un
// valor se cachea para el siguiente request en la misma instancia Deno Deploy
// caliente (reduce queries en ráfagas). Invalidamos con una edad máxima de 60s.
const REMOTE_CONFIG_TTL_MS = 60_000
const remoteConfigCache: { referral_required_count: number; loadedAt: number } = {
  referral_required_count: 2,
  loadedAt: 0,
}

async function getReferralRequiredCount(): Promise<number> {
  if (Date.now() - remoteConfigCache.loadedAt < REMOTE_CONFIG_TTL_MS) {
    return remoteConfigCache.referral_required_count
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('app_config')
      .select('value')
      .eq('key', 'referral_required_count')
      .maybeSingle()
    if (!error && data?.value) {
      const n = parseInt(data.value, 10)
      if (!isNaN(n) && n > 0) {
        remoteConfigCache.referral_required_count = n
        remoteConfigCache.loadedAt = Date.now()
        return n
      }
    }
  } catch {
    // Silencioso — usamos cache o default
  }
  // Si había un valor previo cacheado pero expiró y falló la query,
  // devolvemos el último valor conocido. Si nunca hemos cargado nada,
  // devolvemos el default.
  if (remoteConfigCache.loadedAt > 0) {
    return remoteConfigCache.referral_required_count
  }
  return 2
}

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= maxRequests) return false
  entry.count++
  return true
}

serve(async (req) => {
  try {
    // ====================================================================
    // PASO 0: Autenticación + Rate limiting
    // ====================================================================

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { referred_user_id } = await req.json()

    if (!referred_user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'referred_user_id es requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (authUser.id !== referred_user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado: el token no coincide con el usuario referido' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Rate limiting por IP + user_id (5 peticiones por minuto)
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
    const rateLimitKey = `${clientIp}:${referred_user_id}`
    if (!checkRateLimit(rateLimitKey, 5, 60_000)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Demasiadas peticiones. Inténtalo de nuevo en un minuto.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!REVENUECAT_SECRET_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'REVENUECAT_SECRET_KEY no configurada' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ====================================================================
    // PASO 1: Leer estado actual (sin side effects)
    // ====================================================================

    // 1a. Verificar referral_used (lectura rápida para early exit)
    const { data: profileCheck } = await supabaseAdmin
      .from('profiles')
      .select('referral_used, device_id')
      .eq('id', referred_user_id)
      .maybeSingle()

    if (profileCheck?.referral_used) {
      return new Response(
        JSON.stringify({ success: false, error: 'Este usuario ya ha usado un código de referido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const referredProfileDeviceId = profileCheck?.device_id || null

    // 1b. Buscar el evento pending para este usuario
    const { data: event, error: eventError } = await supabaseAdmin
      .from('referral_events')
      .select('*')
      .eq('referred_id', referred_user_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se encontró un código de referido pendiente para este usuario' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const referrer_id = event.referrer_id

    // ====================================================================
    // PASO 2: Validaciones anti-abuso (solo lecturas, sin side effects permanentes)
    //   Si alguna falla, el usuario puede reintentar con otro código.
    //   Marcar eventos como 'rejected' es un side effect aceptable (cleanup).
    // ====================================================================

    // 2a. No auto-referido
    if (referrer_id === referred_user_id) {
      await supabaseAdmin
        .from('referral_events')
        .update({ status: 'rejected' })
        .eq('id', event.id)

      return new Response(
        JSON.stringify({ success: false, error: 'No puedes usar tu propio código' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 2b. El referidor debe tener menos de N referidos activados
    //    (N viene de app_config.referral_required_count, default 2)
    const REFERRAL_REQUIRED_COUNT = await getReferralRequiredCount()

    const { count: activatedCount, error: countError } = await supabaseAdmin
      .from('referral_events')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', referrer_id)
      .eq('status', 'activated')

    if (!countError && activatedCount !== null && activatedCount >= REFERRAL_REQUIRED_COUNT) {
      await supabaseAdmin
        .from('referral_events')
        .update({ status: 'rejected' })
        .eq('id', event.id)

      return new Response(
        JSON.stringify({
          success: false,
          error: `El referidor ya ha alcanzado el límite de ${REFERRAL_REQUIRED_COUNT} referidos`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 2c. Protección anti-abuso: mismo dispositivo
    const { data: referrerProfile } = await supabaseAdmin
      .from('profiles')
      .select('device_id')
      .eq('id', referrer_id)
      .maybeSingle()

    if (referredProfileDeviceId && referrerProfile?.device_id && referredProfileDeviceId === referrerProfile.device_id) {
      await supabaseAdmin
        .from('referral_events')
        .update({ status: 'rejected' })
        .eq('id', event.id)

      return new Response(
        JSON.stringify({ success: false, error: 'No puedes usar un código de referido desde el mismo dispositivo' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 2d. El referidor debe llevar más de 24h registrado
    const { data: referrerUser } = await supabaseAdmin
      .from('profiles')
      .select('created_at')
      .eq('id', referrer_id)
      .maybeSingle()

    if (referrerUser?.created_at) {
      const hoursSinceCreation =
        (Date.now() - new Date(referrerUser.created_at).getTime()) / (1000 * 60 * 60)

      if (hoursSinceCreation < 24) {
        // No rechazamos el evento — puede reintentarse cuando pasen 24h
        return new Response(
          JSON.stringify({
            success: false,
            error: 'El referidor debe llevar al menos 24h registrado. Inténtalo más tarde.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // ====================================================================
    // PASO 3: BLOQUEO ATÓMICO — referral_used = true
    //   Solo UNA llamada concurrente gana este UPDATE.
    //   Si falla, abortamos: la otra llamada procesó (o está procesando) el referido.
    //   Si tiene éxito, procedemos a activar el evento.
    //
    //   ⚠️ A partir de aquí, referral_used es IRREVERSIBLE (trigger 00012).
    //   Si algo falla después, el usuario no puede reintentar con otro código.
    //   Por eso todas las validaciones están ANTES de este punto.
    // ====================================================================

    const { data: lockedProfile } = await supabaseAdmin
      .from('profiles')
      .update({ referral_used: true })
      .eq('id', referred_user_id)
      .eq('referral_used', false)
      .select('id')
      .maybeSingle()

    if (!lockedProfile) {
      // Otra llamada concurrente ganó el lock
      // El evento sigue pending; no lo tocamos (la ganadora lo procesará)
      return new Response(
        JSON.stringify({ success: false, error: 'Este usuario ya ha usado un código de referido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ====================================================================
    // PASO 4: Activar el evento (solo si sigue 'pending' — MVCC guard)
    // ====================================================================

    const { data: updatedEvents, error: updateEventErr } = await supabaseAdmin
      .from('referral_events')
      .update({
        status: 'activated',
        activated_at: new Date().toISOString(),
      })
      .eq('id', event.id)
      .eq('status', 'pending')
      .select('id')

    if (updateEventErr) {
      console.error('[activate-referral] Error actualizando referral_events:', updateEventErr)
    }

    if (!updatedEvents || updatedEvents.length === 0) {
      // El evento ya no es pending — otra llamada concurrente lo activó antes
      // Esto no debería pasar porque nosotros ganamos el lock del paso 3,
      // pero puede ocurrir si hay dos eventos pending para distintos referrers
      // y la otra llamada activó este evento antes de que llegáramos al paso 4.
      return new Response(
        JSON.stringify({ success: false, error: 'Este código ya fue procesado' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ====================================================================
    // PASO 5: Conceder entitlement en RevenueCat al alcanzar el umbral
    //   (REFERRAL_REQUIRED_COUNT viene de app_config, default 2)
    // ====================================================================

    const newCount = (activatedCount || 0) + 1

    if (newCount === REFERRAL_REQUIRED_COUNT) {
      const rcHeaders = {
        'Authorization': `Bearer ${REVENUECAT_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }

      const grantBody = { duration: 'monthly' }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const referrerRcRes = await fetch(
        `${REVENUECAT_API}/subscribers/${referrer_id}/entitlements/pro/promotional`,
        { method: 'POST', headers: rcHeaders, body: JSON.stringify(grantBody), signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (!referrerRcRes.ok) {
        const rcErr = await referrerRcRes.text()
        console.error('[activate-referral] Error RevenueCat (referrer):', rcErr)
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
