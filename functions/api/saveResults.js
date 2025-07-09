// ユーティリティ関数
function createJsonResponse(body, status = 200) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  return new Response(JSON.stringify(body), { status, headers });
}

function handleOptions(request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  return new Response(null, { headers });
}

export async function onRequest({ request, env, ctx }) {
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const requestData = await request.json();
    const { sessionId } = requestData;
    console.log(`Interview results saved for session: ${sessionId}`);
    const response_data = { message: 'Interview results saved successfully' };

    return createJsonResponse({ success: true, data: response_data });

  } catch (error) {
    return createJsonResponse({ success: false, error: { message: error.message } }, 500);
  }
}