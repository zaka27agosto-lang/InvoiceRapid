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

    // Verificar que existe una solicitud pendiente
    const { data: deletion, error: lookupError } = await supabaseAdmin
      .from('account_deletions')
      .select('id, status, expires_at')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle()

    if (lookupError || !deletion) {
      return new Response(
        JSON.stringify({ error: 'No se encontró una solicitud de eliminación pendiente para esta cuenta' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verificar que no hayan pasado 30 días
    if (deletion.expires_at && new Date(deletion.expires_at) < new Date()) {
      // La cuenta ya expiró — marcar como finalizada en vez de restaurar
      await supabaseAdmin
        .from('account_deletions')
        .update({ status: 'finalized' })
        .eq('id', deletion.id)

      return new Response(
        JSON.stringify({ error: 'El período de restauración de 30 días ha expirado. Esta cuenta no puede ser restaurada.', permanent: true }),
        { status: 410, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Restaurar: marcar el registro como 'restored'
    const { error: updateError } = await supabaseAdmin
      .from('account_deletions')
      .update({
        status: 'restored',
        restored_at: new Date().toISOString(),
      })
      .eq('id', deletion.id)

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Error al restaurar la cuenta' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }


    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tu cuenta ha sido restaurada exitosamente. Todos tus datos están intactos.',
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
