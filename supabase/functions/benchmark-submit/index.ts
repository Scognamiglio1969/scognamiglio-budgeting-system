import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from 'jsr:@supabase/server@^1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const finite = (value: unknown, minimum: number, maximum: number) => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, { supabase }) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Invalid session' }, 401);
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ error: 'Server configuration incomplete' }, 500);
    let body: { metrics?: Record<string, unknown> };
    try { body = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }
    const metrics = body.metrics ?? {};
    const countryCode = typeof metrics.countryCode === 'string' ? metrics.countryCode.toUpperCase() : '';
    const productionType = typeof metrics.productionType === 'string' ? metrics.productionType : '';
    const budgetBand = typeof metrics.budgetBand === 'string' ? metrics.budgetBand : '';
    const shares = ['laborShare', 'equipmentShare', 'fringeShare', 'incentiveShare'] as const;
    if (!/^[A-Z]{2}$/.test(countryCode) || !['film', 'tv', 'documentary', 'commercial', 'other'].includes(productionType) || !['micro', 'small', 'medium', 'large'].includes(budgetBand) || !finite(metrics.costPerShootDay, 0, 100_000_000) || shares.some((keyName) => !finite(metrics[keyName], 0, 1))) return json({ error: 'Invalid benchmark metrics' }, 400);
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile } = await admin.from('profiles').select('enabled, must_change_password').eq('id', user.id).single();
    if (!profile?.enabled || profile.must_change_password) return json({ error: 'Active user required' }, 403);
    const row = { country_code: countryCode, production_type: productionType, budget_band: budgetBand, cost_per_shoot_day: metrics.costPerShootDay, labor_share: metrics.laborShare, equipment_share: metrics.equipmentShare, fringe_share: metrics.fringeShare, incentive_share: metrics.incentiveShare, account_shares: Array.isArray(metrics.accountShares) ? metrics.accountShares.slice(0, 30) : [] };
    const { error: insertError } = await admin.from('benchmark_samples').insert(row);
    if (insertError) return json({ error: 'Unable to record benchmark' }, 500);
    const { data: cohort } = await admin.from('benchmark_samples').select('cost_per_shoot_day, labor_share, equipment_share, fringe_share, incentive_share').eq('country_code', countryCode).eq('production_type', productionType).eq('budget_band', budgetBand).limit(500);
    const values = cohort ?? [];
    if (values.length < 5) return json({ cohortSize: values.length, withheld: true });
    const average = (keyName: keyof typeof values[number]) => values.reduce((sum, value) => sum + Number(value[keyName]), 0) / values.length;
    return json({ cohortSize: values.length, withheld: false, averages: { costPerShootDay: average('cost_per_shoot_day'), laborShare: average('labor_share'), equipmentShare: average('equipment_share'), fringeShare: average('fringe_share'), incentiveShare: average('incentive_share') } });
  }),
};
