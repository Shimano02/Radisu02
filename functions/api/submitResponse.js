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

// 面接の質問フロー
const interviewQuestions = {
  1: {
    category: '自己紹介',
    systemPrompt: 'あなたはAI面接官「Dadish」です。面接者の自己紹介を聞いて、得意な技術分野について質問してください。',
    nextCategory: '技術・経験'
  },
  2: {
    category: '技術・経験',
    systemPrompt: 'あなたはAI面接官「Dadish」です。面接者の技術分野を聞いて、最も挑戦的だったプロジェクトについて質問してください。',
    nextCategory: 'プロジェクト経験'
  },
  3: {
    category: 'プロジェクト経験',
    systemPrompt: 'あなたはAI面接官「Dadish」です。面接者のプロジェクト経験を聞いて、志望理由について質問してください。',
    nextCategory: '志望理由'
  },
  4: {
    category: '志望理由',
    systemPrompt: 'あなたはAI面接官「Dadish」です。面接者の志望理由を聞いて、面接者から質問があるかどうか聞いてください。',
    nextCategory: '質問タイム'
  },
  5: {
    category: '質問タイム',
    systemPrompt: 'あなたはAI面接官「Dadish」です。面接者の質問に答えて、面接を締めくくってください。',
    nextCategory: '完了'
  }
};

export async function onRequest(context) {
  const { request, env, ctx } = context;
  
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }
  
  if (request.method !== 'POST') {
    return createJsonResponse({
      error: 'Method not allowed',
      method: request.method,
      allowed_methods: ['POST', 'OPTIONS']
    }, 405);
  }

  try {
    const requestData = await request.json();
    const { sessionId, response, questionId } = requestData;
    
    console.log(`Processing response for question ${questionId}:`, response);
    
    const currentQuestion = interviewQuestions[questionId];
    if (!currentQuestion) {
      throw new Error(`Invalid question ID: ${questionId}`);
    }
    
    const nextQuestionId = questionId + 1;
    const isComplete = nextQuestionId > 5;
    
    if (isComplete) {
      // 面接完了
      return createJsonResponse({
        success: true,
        data: {
          message: 'ありがとうございました！面接を終了いたします。お疲れ様でした！',
          isComplete: true,
          finalScore: 8,
          summary: {
            totalQuestions: 5,
            averageScore: 8,
            strengths: ['詳細な回答', '具体的な経験の言及', '成長意欲の表現'],
            concerns: [],
            overallAssessment: '良好'
          },
          progress: { current: 5, total: 5 }
        }
      });
    }
    
    // 次の質問を生成
    let nextQuestionContent;
    const nextQuestion = interviewQuestions[nextQuestionId];
    
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
                content: `${currentQuestion.systemPrompt}

【面接の流れ】
1. 自己紹介
2. 得意な技術分野
3. 最も挑戦的だったプロジェクト
4. 志望理由
5. 質問（面接者から）

【応答ルール】
- 面接者の回答に対して簡潔にコメントする
- 次の質問を自然に続ける
- 1つの回答につき2-3文で終わらせる
- 親しみやすく、プロフェッショナルに対応する`
              },
              { 
                role: 'user', 
                content: `面接者の回答: 「${response}」

この回答に対してコメントし、次の「${nextQuestion.nextCategory}」について質問してください。` 
              }
            ],
            max_tokens: 200,
            temperature: 0.7,
          }),
        });

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          nextQuestionContent = openaiData.choices[0].message.content.trim();
        } else {
          console.error('OpenAI API Error:', openaiResponse.status);
          nextQuestionContent = getDefaultQuestion(nextQuestionId);
        }
      } catch (error) {
        console.error('OpenAI API Error:', error);
        nextQuestionContent = getDefaultQuestion(nextQuestionId);
      }
    } else {
      nextQuestionContent = getDefaultQuestion(nextQuestionId);
    }
    
    const nextQuestionData = {
      id: nextQuestionId,
      category: nextQuestion.nextCategory,
      content: nextQuestionContent,
    };

    const response_data = {
      message: nextQuestionContent,
      currentQuestion: nextQuestionData,
      progress: { current: nextQuestionId, total: 5 },
      isComplete: false
    };

    return createJsonResponse({ success: true, data: response_data });

  } catch (error) {
    console.error('Error in submitResponse:', error);
    return createJsonResponse({ 
      success: false, 
      error: { 
        message: error.message,
        stack: error.stack
      } 
    }, 500);
  }
}

function getDefaultQuestion(questionId) {
  const defaults = {
    2: 'ありがとうございます。次に、あなたの得意な技術分野について教えてください。',
    3: 'なるほど。では、これまでで最も挑戦的だったプロジェクトについて詳しく教えてください。',
    4: '素晴らしいプロジェクトですね。最後に、弊社への志望理由を教えてください。',
    5: 'ありがとうございます。何かご質問はございますか？'
  };
  return defaults[questionId] || '次の質問に進みます。';
}