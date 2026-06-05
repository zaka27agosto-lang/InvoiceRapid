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

serve(async (req) => {
  try {
    // 1. Autenticar al usuario mediante el JWT
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

    // 2. Verificar si el usuario es Pro (RevenueCat stripe_customer_id en subscriptions)
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
        limit: 5,
      }
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 3. Para usuarios free: llamar al RPC atómico (SELECT ... FOR UPDATE)
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

    return new Response(
      JSON.stringify(rpcResult),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
