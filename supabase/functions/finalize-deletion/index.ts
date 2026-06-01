import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SERVICE_ROLE_KEY') || ''
)

serve(async (req) => {
  try {
    console.log('⏰ Iniciando finalize-deletion cron job...')

    // Buscar todas las eliminaciones pendientes que han expirado
    const { data: expiredDeletions, error: lookupError } = await supabaseAdmin
      .from('account_deletions')
      .select('*')
      .eq('status', 'pending')
      .lte('expires_at', new Date().toISOString())

    if (lookupError) {
      console.error('Error buscando eliminaciones expiradas:', lookupError)
      return new Response(
        JSON.stringify({ error: lookupError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!expiredDeletions || expiredDeletions.length === 0) {
      console.log('✅ No hay eliminaciones pendientes para finalizar')
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending deletions to finalize' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔍 Encontradas ${expiredDeletions.length} eliminaciones expiradas`)

    const results = []

    for (const deletion of expiredDeletions) {
      const userId = deletion.user_id
      const userEmail = deletion.email
      console.log(`🗑️ Finalizando eliminación para: ${userId} (${userEmail})`)

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
            console.error(`Error eliminando ${table} para ${userId}:`, deleteError)
          } else {
            console.log(`  ✅ ${table} eliminados`)
          }
        }

        // 2. Eliminar usuario de Auth
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (authDeleteError) {
          console.error(`Error eliminando auth user ${userId}:`, authDeleteError)
          // Continuar de todas formas — el registro en account_deletions es la fuente de verdad
        } else {
          console.log(`  ✅ Usuario Auth eliminado`)
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
          console.error(`Error insertando en deleted_emails para ${userEmail}:`, insertEmailError)
        } else {
          console.log(`  ✅ Email ${userEmail} bloqueado permanentemente`)
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
          console.error(`Error actualizando account_deletion ${deletion.id}:`, updateError)
        }

        results.push({ userId, email: userEmail, status: 'finalized' })
        console.log(`  ✅ Eliminación finalizada para ${userEmail}`)
      } catch (innerError) {
        console.error(`Error procesando eliminación para ${userId}:`, innerError)
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
    console.error('Error en finalize-deletion:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
