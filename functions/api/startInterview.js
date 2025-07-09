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

// GET method handler for testing
export function onRequestGet(context) {
  return createJsonResponse({
    message: 'startInterview endpoint is working',
    method: 'GET',
    timestamp: new Date().toISOString(),
    available_methods: ['POST', 'OPTIONS']
  });
}

// OPTIONS method handler
export function onRequestOptions(context) {
  return handleOptions(context.request);
}

// POST method handler
export function onRequestPost(context) {
  const { request, env } = context;
  
  return handlePostRequest(request, env);
}

// Main onRequest handler
export async function onRequest(context) {
  const { request, env, ctx } = context;
  
  console.log(`startInterview called with method: ${request.method}`);
  
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }
  
  if (request.method === 'GET') {
    return onRequestGet(context);
  }
  
  if (request.method === 'POST') {
    return handlePostRequest(request, env);
  }
  
  return createJsonResponse({
    error: 'Method not allowed',
    method: request.method,
    allowed_methods: ['GET', 'POST', 'OPTIONS']
  }, 405);
}

async function handlePostRequest(request, env) {
  try {
    console.log('Processing POST request to startInterview');
    
    const requestData = await request.json();
    const candidateName = requestData.candidateName || '匿名';
    
    console.log(`Candidate name: ${candidateName}`);
    
    // OpenAI APIを使用してAI面接官の質問を生成
    let generatedQuestion;
    
    if (env.OPENAI_API_KEY) {
      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { 
                role: 'system', 
                content: `あなたはAI面接官「Dadish」です。親しみやすく、プロフェッショナルな面接官として振る舞ってください。

【面接の流れ】
1. 自己紹介
2. 得意な技術分野
3. 最も挑戦的だったプロジェクト
4. 志望理由
5. 質問（面接者から）

【応答ルール】
- 簡潔で分かりやすい質問をする
- 面接者の名前を使って親しみやすく話す
- 1つの質問につき1-2文で終わらせる
- 技術面接として適切なレベルの質問をする`
              },
              { 
                role: 'user', 
                content: `面接を開始します。面接者の名前は「${candidateName}」です。最初の自己紹介の質問をお願いします。` 
              }
            ],
            max_tokens: 150,
            temperature: 0.7,
          }),
        });

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          generatedQuestion = openaiData.choices[0].message.content.trim();
        } else {
          console.error('OpenAI API Error:', openaiResponse.status);
          generatedQuestion = 'まずは自己紹介をお願いします。お名前、経験、志望動機などを教えてください。';
        }
      } catch (error) {
        console.error('OpenAI API Error:', error);
        generatedQuestion = 'まずは自己紹介をお願いします。お名前、経験、志望動機などを教えてください。';
      }
    } else {
      generatedQuestion = 'まずは自己紹介をお願いします。お名前、経験、志望動機などを教えてください。';
    }
    
    const sessionId = crypto.randomUUID();
    
    const firstQuestion = {
      id: 1,
      category: '自己紹介',
      content: generatedQuestion,
    };

    const response_data = {
      sessionId: sessionId,
      message: `${candidateName}さん、こんにちは！AI面接官のDadishです。${generatedQuestion}`,
      currentQuestion: firstQuestion,
      progress: { current: 1, total: 5 }
    };

    console.log('Sending response:', response_data);
    
    return createJsonResponse({ success: true, data: response_data });

  } catch (error) {
    console.error('Error in startInterview:', error);
    return createJsonResponse({ 
      success: false, 
      error: { 
        message: error.message,
        stack: error.stack
      } 
    }, 500);
  }
}