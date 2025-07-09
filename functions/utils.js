
/**
 * JSONレスポンスを生成するヘルパー関数
 * @param {object} body - レスポンスのボディ
 * @param {number} status - HTTPステータスコード
 * @returns {Response}
 */
export function createJsonResponse(body, status = 200) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * CORSプリフライトリクエストを処理する
 * @param {Request} request
 * @returns {Response}
 */
export function handleOptions(request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  return new Response(null, { headers });
}
