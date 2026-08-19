// Supabase Edge Function: supabase/functions/homefix-ai/index.ts
// Deploy with: supabase functions deploy homefix-ai
// Store OPENAI_API_KEY as a Supabase secret. Never put the secret in VITE_* or browser code.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const { message, context } = await req.json();
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return Response.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500 });

  const system = `You are HOMEFIX AI, an assistant for an Indian home-services and ride-hailing platform. Help users diagnose household/vehicle problems safely, choose a service, explain booking steps, and summarize ride details. Do not claim a driver or technician is actually available unless backend data says so. For dangerous electrical, gas, fire, medical, or road emergencies, advise appropriate emergency services. Keep answers concise and actionable.`;
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-5-mini', instructions: system, input: JSON.stringify({ message, context }) })
  });
  const data = await r.json();
  if (!r.ok) return Response.json({ error: data?.error?.message || 'AI request failed' }, { status: r.status });
  const reply = data.output_text || data.output?.map(x => x.content?.map(y => y.text).join('')).join('') || 'I could not generate a response.';
  return Response.json({ reply });
});
