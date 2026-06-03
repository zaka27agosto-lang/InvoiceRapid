import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SERVICE_ROLE_KEY') || ''
)

serve(async (req) => {
  try {
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
    const userEmail = user.email
    `)

    // Verificar si ya existe una solicitud pendiente
    const { data: existing } = await supabaseAdmin
      .from('account_deletions')
      .select('id, status')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Ya existe una solicitud de eliminación pendiente' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Insertar en account_deletions (soft delete)
    // NO eliminamos los datos ni el usuario de Auth todavía
    const { error: insertError } = await supabaseAdmin
      .from('account_deletions')
      .insert({
        user_id: userId,
        email: userEmail,
        status: 'pending',
        deleted_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })

    if (insertError) {
      return new Response(
        JSON.stringify({ error: 'Error al procesar la solicitud: ' + insertError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }


    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cuenta marcada para eliminación. Tienes 30 días para restaurarla.',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
