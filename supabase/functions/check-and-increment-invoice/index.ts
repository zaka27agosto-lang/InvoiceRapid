import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || ''
)

interface EdgeResponse {
  canCreate: boolean
  isPro: boolean
  currentCount: number
  limit: number
}

// Límite "ilimitado" para usuarios Pro (compatibilidad con UI legacy).
// El real enforcement para free users ocurre en la RPC `check_and_increment_invoice`
// que lee `monthly_free_invoice_limit` desde `app_config` (single source of truth).
const PREMIUM_LIMIT = 999

serve(async (req) => {
  try {
    // 1. Autenticar al usuario mediante el JWT del request.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id
    const { month, mode } = await req.json()

    if (!month) {
      return new Response(
        JSON.stringify({ error: 'month es requerido (formato YYYY-MM)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 2. Verificar si el usuario es Pro (subscriptions.status === 'active')
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('status')
      .eq('user_id', userId)
      .maybeSingle()

    const isPro = subscription?.status === 'active'

    if (isPro) {
      const result: EdgeResponse = {
        canCreate: true,
        isPro: true,
        currentCount: 0,
        limit: PREMIUM_LIMIT,
      }
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 3. Para usuarios free: delegar al RPC atómico que hace SELECT ... FOR UPDATE.
    //    El RPC lee `monthly_free_invoice_limit` desde `app_config` en cada
    //    llamada, así que si el admin cambia el límite desde la dashboard de
    //    Supabase, el enforcing se actualiza sin recompilar la app ni esta
    //    Edge Function. No leemos app_config aquí para evitar desincronización
    //    cliente/servidor.
    const { data: rpcResult, error: rpcError } = await supabaseAdmin
      .rpc('check_and_increment_invoice', {
        p_user_id: userId,
        p_month: month,
        p_mode: mode || 'increment',
      })

    if (rpcError || !rpcResult) {
      return new Response(
        JSON.stringify({ error: 'Error al verificar el límite de facturas' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Defensa: si la RPC por algún motivo devolvió `limit` corrupto o null
    // (futura migración mal escrita), no serializamos `undefined` a la app
    // (eso haría que la UI muestre "NaN/N restantes"). Mejor 500 con
    // mensaje claro que un retorno silenciosamente roto.
    if (!Number.isFinite(rpcResult.limit)) {
      return new Response(
        JSON.stringify({ error: 'Límite de facturas inválido (configuración remota corrupta)' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Pasar la respuesta del RPC tal cual: canCreate + limit vienen del
    // enforcing real en SQL.
    const result: EdgeResponse = {
      canCreate: rpcResult.canCreate,
      isPro: rpcResult.isPro,
      currentCount: rpcResult.currentCount,
      limit: rpcResult.limit,
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
