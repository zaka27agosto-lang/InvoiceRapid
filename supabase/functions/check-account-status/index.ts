import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || ''
)

// Rate limiting: Map con TTL manual para prevenir enumeración de emails
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

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
    // Rate limiting por IP: 10 peticiones por minuto (previene enumeración masiva)
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
    if (!checkRateLimit(clientIp, 10, 60_000)) {
      return new Response(
        JSON.stringify({ error: 'Demasiadas peticiones. Inténtalo de nuevo en un minuto.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verificar autorización: solo la app (con anon key) puede llamar esta función
    const authHeader = req.headers.get('Authorization') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (!authHeader.startsWith('Bearer ') || authHeader.replace('Bearer ', '') !== anonKey) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { email } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email es requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
