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
    // FormDataをパース
    const formData = await request.formData();
    const sessionId = formData.get('sessionId');
    const file = formData.get('file');

    if (!file) {
      return createJsonResponse({ success: false, error: { message: 'No file uploaded' } }, 400);
    }

    console.log(`Uploading file: ${file.name} for session: ${sessionId}`);
    // ここでCloudflare R2などにファイルを保存するロジックを実装
    // 現時点ではダミーの成功レスポンスを返します
    const response_data = { message: `File ${file.name} uploaded successfully for session ${sessionId}` };

    return createJsonResponse({ success: true, data: response_data });

  } catch (error) {
    return createJsonResponse({ success: false, error: { message: error.message } }, 500);
  }
}