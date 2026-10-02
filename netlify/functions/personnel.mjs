import { getStore } from '@netlify/blobs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const store = getStore({ name: 'personnel', consistency: 'strong' });

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const id = url.searchParams.get('id') || 'default';
      const raw = await store.get(id, { type: 'json' });
      return Response.json(raw || [], { headers: corsHeaders });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const id = body.id || 'default';
      const data = Array.isArray(body.data) ? body.data : [];
      await store.setJSON(id, data);
      return Response.json({ ok: true, count: data.length }, { headers: corsHeaders });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
};

export const config = {
  path: '/api/personnel',
};