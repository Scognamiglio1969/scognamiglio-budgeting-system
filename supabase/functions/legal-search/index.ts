import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from 'jsr:@supabase/server@^1';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const portals: Record<string, { name: string; url: string }> = {
  FR: { name: 'Légifrance', url: 'https://www.legifrance.gouv.fr/search/all' },
  DE: { name: 'Gesetze im Internet', url: 'https://www.gesetze-im-internet.de/' },
  ES: { name: 'Boletín Oficial del Estado', url: 'https://www.boe.es/buscar/' },
  GB: { name: 'legislation.gov.uk', url: 'https://www.legislation.gov.uk/' },
  US: { name: 'eCFR', url: 'https://www.ecfr.gov/search' },
  CA: { name: 'Justice Laws Website', url: 'https://laws-lois.justice.gc.ca/' },
};

const kindSlug = (value: string) => ({
  LEGGE: 'legge', 'DECRETO-LEGGE': 'decreto.legge', 'DECRETO LEGISLATIVO': 'decreto.legislativo',
  'DECRETO DEL PRESIDENTE DELLA REPUBBLICA': 'decreto.del.presidente.della.repubblica',
}[value] ?? 'decreto');

interface NormattivaAct {
  numeroAtto?: string;
  dataGU?: string;
  numeroGU?: string;
  codiceRedazionale?: string;
  titoloAtto?: string;
  dataEmanazione?: string;
  descrizioneAtto?: string;
  denominazioneAtto?: string;
}

interface LegalSearchResult {
  id: string;
  title: string;
  description: string;
  authority: string;
  sourceUrl: string;
  actDate: string | null;
  publicationDate: string | null;
  officialGazette: string | null;
  countryCode: string;
}

interface LegalSearchResponse {
  query: string;
  countryCode: string;
  checkedAt: string;
  source: { name: string; url: string; official: true; mode: 'api' | 'portal' };
  results: LegalSearchResult[];
  total: number;
  disclaimer: string;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, { supabase }) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Invalid session' }, 401);

    let body: { countryCode?: string; query?: string; projectId?: string };
    try { body = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }
    const countryCode = body.countryCode?.trim().toUpperCase() ?? '';
    const query = body.query?.trim().replace(/\s+/g, ' ') ?? '';
    if (!['IT', ...Object.keys(portals)].includes(countryCode)) return json({ error: 'Unsupported country' }, 400);
    if (query.length < 3 || query.length > 160) return json({ error: 'Query must contain 3–160 characters' }, 400);
    if (body.projectId && !/^[0-9a-f-]{36}$/i.test(body.projectId)) return json({ error: 'Invalid project' }, 400);

    const checkedAt = new Date().toISOString();
    let response: LegalSearchResponse;

    if (countryCode === 'IT') {
      const upstream = await fetch('https://api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/ricerca/semplice', {
        method: 'POST', signal: AbortSignal.timeout(12_000),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ testoRicerca: query, orderType: 'recente', paginazione: { paginaCorrente: 1, numeroElementiPerPagina: 10 } }),
      });
      if (!upstream.ok) return json({ error: 'Normattiva is temporarily unavailable' }, 502);
      const payload = await upstream.json() as { listaAtti?: NormattivaAct[]; numeroAttiTrovati?: number };
      const results = (payload.listaAtti ?? []).slice(0, 10).map((act, index) => {
        const date = act.dataEmanazione?.slice(0, 10) ?? act.dataGU ?? '';
        const urn = `urn:nir:stato:${kindSlug(act.denominazioneAtto ?? '')}:${date};${act.numeroAtto ?? ''}`;
        return {
          id: act.codiceRedazionale ?? `${date}-${act.numeroAtto ?? index}`,
          title: (act.titoloAtto ?? '').replace(/^\[|\]$/g, '').trim(),
          description: act.descrizioneAtto ?? act.denominazioneAtto ?? 'Atto normativo',
          authority: 'Normattiva — Presidenza del Consiglio dei Ministri',
          sourceUrl: `https://www.normattiva.it/uri-res/N2Ls?${urn}`,
          actDate: date || null,
          publicationDate: act.dataGU ?? null,
          officialGazette: act.numeroGU ? `G.U. n. ${act.numeroGU} del ${act.dataGU ?? ''}`.trim() : null,
          countryCode,
        };
      });
      response = {
        query, countryCode, checkedAt,
        source: { name: 'Normattiva Open Data', url: 'https://dati.normattiva.it/', official: true, mode: 'api' },
        results, total: payload.numeroAttiTrovati ?? results.length,
        disclaimer: 'I testi digitali hanno carattere informativo; prevale la pubblicazione ufficiale in Gazzetta Ufficiale.',
      };
    } else {
      const portal = portals[countryCode]!;
      response = {
        query, countryCode, checkedAt,
        source: { name: portal.name, url: portal.url, official: true, mode: 'portal' },
        results: [{ id: `${countryCode}-portal`, title: `Cerca “${query}” nel portale ufficiale`, description: portal.name, authority: portal.name, sourceUrl: portal.url, actDate: null, publicationDate: null, officialGazette: null, countryCode }],
        total: 1,
        disclaimer: 'Connettore strutturato non ancora validato per questo paese. Verificare i risultati sul portale ufficiale.',
      };
    }

    if (body.projectId) {
      await supabase.from('legal_search_audit').insert({
        project_id: body.projectId, user_id: user.id, country_code: countryCode, query,
        source_name: response.source.name,
        result_count: response.total, result_metadata: response.results, searched_at: checkedAt,
      });
    }
    return json(response);
  }),
};
