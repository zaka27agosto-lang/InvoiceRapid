import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SERVICE_ROLE_KEY') || ''
)

serve(async (req) => {
  try {

    // Buscar todas las eliminaciones pendientes que han expirado
    const { data: expiredDeletions, error: lookupError } = await supabaseAdmin
      .from('account_deletions')
      .select('*')
      .eq('status', 'pending')
      .lte('expires_at', new Date().toISOString())

    if (lookupError) {
      return new Response(
        JSON.stringify({ error: lookupError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!expiredDeletions || expiredDeletions.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending deletions to finalize' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }


    const results = []

    for (const deletion of expiredDeletions) {
      const userId = deletion.user_id
      const userEmail = deletion.email
      try {
        // 1. Eliminar datos del usuario en orden (FK constraints)
        const tables = [
          'factura_items',
          'facturas',
          'clientes',
          'productos',
          'subscriptions',
          'customers',
        ]

        for (const table of tables) {
          const { error: deleteError } = await supabaseAdmin
            .from(table)
            .delete()
            .eq('user_id', userId)

          if (deleteError) {
          } else {
          }
        }

        // 2. Eliminar usuario de Auth
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (authDeleteError) {
          // Continuar de todas formas — el registro en account_deletions es la fuente de verdad
        } else {
        }

        // 3. Insertar en deleted_emails (bloqueo permanente)
        const { error: insertEmailError } = await supabaseAdmin
          .from('deleted_emails')
          .insert({
            email: userEmail,
            deleted_at: new Date().toISOString(),
          })

        if (insertEmailError) {
          // Podría ser un duplicado — no es crítico
        } else {
        }

        // 4. Marcar account_deletion como finalizada
        const { error: updateError } = await supabaseAdmin
          .from('account_deletions')
          .update({
            status: 'finalized',
            finalized_at: new Date().toISOString(),
          })
          .eq('id', deletion.id)

        if (updateError) {
        }

        results.push({ userId, email: userEmail, status: 'finalized' })
      } catch (innerError) {
        results.push({ userId, email: userEmail, status: 'error', error: innerError.message })
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
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
