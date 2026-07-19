import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from 'jsr:@supabase/server@^1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function generateTemporaryPassword(length = 18) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const required = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%'];
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  const chars = required.map((set, index) => set[bytes[index] % set.length]);
  for (let index = required.length; index < length; index += 1) {
    chars.push(alphabet[bytes[index] % alphabet.length]);
  }
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = bytes[index] % (index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }
  return chars.join('');
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, { supabase: caller }) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
  const appUrl = Deno.env.get('APP_URL');

  if (!supabaseUrl || !serviceRoleKey || !appUrl) {
    return json({ error: 'Server configuration is incomplete' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: userError } = await caller.auth.getUser();
  if (userError || !user) return json({ error: 'Invalid session' }, 401);

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role, enabled, must_change_password')
    .eq('id', user.id)
    .single();
  if (!callerProfile || callerProfile.role !== 'admin' || !callerProfile.enabled || callerProfile.must_change_password) {
    return json({ error: 'Administrator access required' }, 403);
  }

  let payload: { email?: string; fullName?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  const email = payload.email?.trim().toLowerCase();
  const fullName = payload.fullName?.trim() ?? '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Valid email required' }, 400);

  const temporaryPassword = generateTemporaryPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) return json({ error: createError?.message ?? 'Unable to create user' }, 400);

  const { error: profileError } = await admin
    .from('profiles')
    .update({ full_name: fullName, enabled: true, must_change_password: true })
    .eq('id', created.user.id);
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: 'Unable to activate the user profile' }, 500);
  }

  if (resendKey && fromEmail) {
    const safeName = escapeHtml(fullName || email);
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: 'Accesso a Scognamiglio Budgeting System',
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#24222d">
          <h1 style="font-size:22px">Benvenuto in SBS</h1>
          <p>Ciao ${safeName}, il tuo accesso a Scognamiglio Budgeting System è stato abilitato.</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}<br><strong>Password provvisoria:</strong> <code style="font-size:16px">${escapeHtml(temporaryPassword)}</code></p>
          <p>Al primo accesso dovrai scegliere una nuova password prima di vedere i progetti.</p>
          <p><a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:11px 16px;background:#6550e8;color:white;text-decoration:none;border-radius:8px">Apri SBS</a></p>
          <p style="color:#777482;font-size:12px">Non inoltrare questa email. Se non ti aspettavi l'invito, contatta l'amministratore.</p>
        </div>`,
      }),
    });

    if (!emailResponse.ok) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: 'Email delivery failed; the user was not created' }, 502);
    }

    return json({ ok: true, userId: created.user.id, email, emailMode: 'temporary-password' });
  }

  const { error: recoveryError } = await caller.auth.resetPasswordForEmail(email, { redirectTo: appUrl });
  if (recoveryError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: `Email delivery failed: ${recoveryError.message}` }, 502);
  }

  return json({
    ok: true,
    userId: created.user.id,
    email,
    emailMode: 'password-reset',
    temporaryPassword,
  });
  }),
};
