import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SERVICE_ROLE_KEY') || ''
)

serve(async (req) => {
  try {
    const { email } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email es requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()
    console.log(`🔍 Verificando estado de cuenta para: ${normalizedEmail}`)

    // 1. Verificar si el email está en deleted_emails (bloqueo permanente)
    const { data: permanentlyDeleted } = await supabaseAdmin
      .from('deleted_emails')
      .select('email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (permanentlyDeleted) {
      return new Response(
        JSON.stringify({
          status: 'permanently_deleted',
          message: 'Esta cuenta fue eliminada permanentemente y no puede ser restaurada ni registrada de nuevo.',
          canRestore: false,
          canRegister: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 2. Verificar si el email está en account_deletions como 'pending'
    const { data: pendingDeletion } = await supabaseAdmin
      .from('account_deletions')
      .select('deleted_at, expires_at, status')
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
      .order('deleted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (pendingDeletion) {
      // Verificar si el período de gracia ya expiró
      const now = new Date()
      const expiresAt = new Date(pendingDeletion.expires_at)

      if (now >= expiresAt) {
        // Ya expiró — esta función no finaliza (eso lo hace finalize-deletion),
        // pero informamos que la cuenta ya no se puede restaurar
        return new Response(
          JSON.stringify({
            status: 'grace_period_expired',
            message: 'El período de restauración de 30 días ha expirado.',
            canRestore: false,
            canRegister: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Período de gracia activo
      return new Response(
        JSON.stringify({
          status: 'pending_deletion',
          message: 'Tu cuenta está pendiente de eliminación. Puedes restaurarla antes de que expire el plazo.',
          canRestore: true,
          canRegister: false,
          expiresAt: pendingDeletion.expires_at,
          deletedAt: pendingDeletion.deleted_at,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 3. Todo limpio — la cuenta puede usarse normalmente
    return new Response(
      JSON.stringify({
        status: 'active',
        message: 'La cuenta no tiene restricciones.',
        canRestore: false,
        canRegister: true,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error en check-account-status:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
