var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../.wrangler/tmp/bundle-tPQ1wv/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// api/startInterview.js
function createJsonResponse(body, status = 200) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
  return new Response(JSON.stringify(body), { status, headers });
}
__name(createJsonResponse, "createJsonResponse");
function handleOptions(request) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
  return new Response(null, { headers });
}
__name(handleOptions, "handleOptions");
function onRequestGet(context) {
  return createJsonResponse({
    message: "startInterview endpoint is working",
    method: "GET",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    available_methods: ["POST", "OPTIONS"]
  });
}
__name(onRequestGet, "onRequestGet");
function onRequestOptions(context) {
  return handleOptions(context.request);
}
__name(onRequestOptions, "onRequestOptions");
function onRequestPost(context) {
  const { request, env } = context;
  return handlePostRequest(request, env);
}
__name(onRequestPost, "onRequestPost");
function onRequest(context) {
  const { request, env } = context;
  console.log(`startInterview called with method: ${request.method}`);
  if (request.method === "OPTIONS") {
    return handleOptions(request);
  }
  if (request.method === "GET") {
    return onRequestGet(context);
  }
  if (request.method === "POST") {
    return handlePostRequest(request, env);
  }
  return createJsonResponse({
    error: "Method not allowed",
    method: request.method,
    allowed_methods: ["GET", "POST", "OPTIONS"]
  }, 405);
}
__name(onRequest, "onRequest");
async function handlePostRequest(request, env) {
  try {
    console.log("Processing POST request to startInterview");
    const requestData = await request.json();
    const candidateName = requestData.candidateName || "\u533F\u540D";
    console.log(`Candidate name: ${candidateName}`);
    let generatedQuestion;
    if (env.OPENAI_API_KEY) {
      try {
        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `\u3042\u306A\u305F\u306FAI\u9762\u63A5\u5B98\u300CDadish\u300D\u3067\u3059\u3002\u89AA\u3057\u307F\u3084\u3059\u304F\u3001\u30D7\u30ED\u30D5\u30A7\u30C3\u30B7\u30E7\u30CA\u30EB\u306A\u9762\u63A5\u5B98\u3068\u3057\u3066\u632F\u308B\u821E\u3063\u3066\u304F\u3060\u3055\u3044\u3002

\u3010\u9762\u63A5\u306E\u6D41\u308C\u3011
1. \u81EA\u5DF1\u7D39\u4ECB
2. \u5F97\u610F\u306A\u6280\u8853\u5206\u91CE
3. \u6700\u3082\u6311\u6226\u7684\u3060\u3063\u305F\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8
4. \u5FD7\u671B\u7406\u7531
5. \u8CEA\u554F\uFF08\u9762\u63A5\u8005\u304B\u3089\uFF09

\u3010\u5FDC\u7B54\u30EB\u30FC\u30EB\u3011
- \u7C21\u6F54\u3067\u5206\u304B\u308A\u3084\u3059\u3044\u8CEA\u554F\u3092\u3059\u308B
- \u9762\u63A5\u8005\u306E\u540D\u524D\u3092\u4F7F\u3063\u3066\u89AA\u3057\u307F\u3084\u3059\u304F\u8A71\u3059
- 1\u3064\u306E\u8CEA\u554F\u306B\u3064\u304D1-2\u6587\u3067\u7D42\u308F\u3089\u305B\u308B
- \u6280\u8853\u9762\u63A5\u3068\u3057\u3066\u9069\u5207\u306A\u30EC\u30D9\u30EB\u306E\u8CEA\u554F\u3092\u3059\u308B`
              },
              {
                role: "user",
                content: `\u9762\u63A5\u3092\u958B\u59CB\u3057\u307E\u3059\u3002\u9762\u63A5\u8005\u306E\u540D\u524D\u306F\u300C${candidateName}\u300D\u3067\u3059\u3002\u6700\u521D\u306E\u81EA\u5DF1\u7D39\u4ECB\u306E\u8CEA\u554F\u3092\u304A\u9858\u3044\u3057\u307E\u3059\u3002`
              }
            ],
            max_tokens: 150,
            temperature: 0.7
          })
        });
        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          generatedQuestion = openaiData.choices[0].message.content.trim();
        } else {
          console.error("OpenAI API Error:", openaiResponse.status);
          generatedQuestion = "\u307E\u305A\u306F\u81EA\u5DF1\u7D39\u4ECB\u3092\u304A\u9858\u3044\u3057\u307E\u3059\u3002\u304A\u540D\u524D\u3001\u7D4C\u9A13\u3001\u5FD7\u671B\u52D5\u6A5F\u306A\u3069\u3092\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u3002";
        }
      } catch (error) {
        console.error("OpenAI API Error:", error);
        generatedQuestion = "\u307E\u305A\u306F\u81EA\u5DF1\u7D39\u4ECB\u3092\u304A\u9858\u3044\u3057\u307E\u3059\u3002\u304A\u540D\u524D\u3001\u7D4C\u9A13\u3001\u5FD7\u671B\u52D5\u6A5F\u306A\u3069\u3092\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u3002";
      }
    } else {
      generatedQuestion = "\u307E\u305A\u306F\u81EA\u5DF1\u7D39\u4ECB\u3092\u304A\u9858\u3044\u3057\u307E\u3059\u3002\u304A\u540D\u524D\u3001\u7D4C\u9A13\u3001\u5FD7\u671B\u52D5\u6A5F\u306A\u3069\u3092\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u3002";
    }
    const sessionId = crypto.randomUUID();
    const firstQuestion = {
      id: 1,
      category: "\u81EA\u5DF1\u7D39\u4ECB",
      content: generatedQuestion
    };
    const response_data = {
      sessionId,
      message: `${candidateName}\u3055\u3093\u3001\u3053\u3093\u306B\u3061\u306F\uFF01AI\u9762\u63A5\u5B98\u306EDadish\u3067\u3059\u3002${generatedQuestion}`,
      currentQuestion: firstQuestion,
      progress: { current: 1, total: 5 }
    };
    console.log("Sending response:", response_data);
    return createJsonResponse({ success: true, data: response_data });
  } catch (error) {
    console.error("Error in startInterview:", error);
    return createJsonResponse({
      success: false,
      error: {
        message: error.message,
        stack: error.stack
      }
    }, 500);
  }
}
__name(handlePostRequest, "handlePostRequest");

// api/test.js
function onRequestGet2(context) {
  return new Response(JSON.stringify({
    message: "GET method works!",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(onRequestGet2, "onRequestGet");
function onRequestPost2(context) {
  return new Response(JSON.stringify({
    message: "POST method works!",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(onRequestPost2, "onRequestPost");
function onRequest2(context) {
  const { request } = context;
  if (request.method === "GET") {
    return onRequestGet2(context);
  } else if (request.method === "POST") {
    return onRequestPost2(context);
  }
  return new Response("Method not allowed", {
    status: 405,
    headers: {
      "Content-Type": "text/plain",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(onRequest2, "onRequest");

// api/recordingControl.js
function createJsonResponse2(body, status = 200) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
  return new Response(JSON.stringify(body), { status, headers });
}
__name(createJsonResponse2, "createJsonResponse");
function handleOptions2(request) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
  return new Response(null, { headers });
}
__name(handleOptions2, "handleOptions");
async function onRequest3({ request, env, ctx }) {
  if (request.method === "OPTIONS") {
    return handleOptions2(request);
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  try {
    const requestData = await request.json();
    const { status, sessionId } = requestData;
    console.log(`Recording status changed to: ${status} for session: ${sessionId}`);
    const response_data = { message: `Recording status changed to ${status}` };
    return createJsonResponse2({ success: true, data: response_data });
  } catch (error) {
    return createJsonResponse2({ success: false, error: { message: error.message } }, 500);
  }
}
__name(onRequest3, "onRequest");

// api/saveResults.js
function createJsonResponse3(body, status = 200) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
  return new Response(JSON.stringify(body), { status, headers });
}
__name(createJsonResponse3, "createJsonResponse");
function handleOptions3(request) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
  return new Response(null, { headers });
}
__name(handleOptions3, "handleOptions");
async function onRequest4({ request, env, ctx }) {
  if (request.method === "OPTIONS") {
    return handleOptions3(request);
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  try {
    const requestData = await request.json();
    const { sessionId } = requestData;
    console.log(`Interview results saved for session: ${sessionId}`);
    const response_data = { message: "Interview results saved successfully" };
    return createJsonResponse3({ success: true, data: response_data });
  } catch (error) {
    return createJsonResponse3({ success: false, error: { message: error.message } }, 500);
  }
}
__name(onRequest4, "onRequest");

// api/submitResponse.js
function createJsonResponse4(body, status = 200) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
  return new Response(JSON.stringify(body), { status, headers });
}
__name(createJsonResponse4, "createJsonResponse");
function handleOptions4(request) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
  return new Response(null, { headers });
}
__name(handleOptions4, "handleOptions");
var interviewQuestions = {
  1: {
    category: "\u81EA\u5DF1\u7D39\u4ECB",
    systemPrompt: "\u3042\u306A\u305F\u306FAI\u9762\u63A5\u5B98\u300CDadish\u300D\u3067\u3059\u3002\u9762\u63A5\u8005\u306E\u81EA\u5DF1\u7D39\u4ECB\u3092\u805E\u3044\u3066\u3001\u5F97\u610F\u306A\u6280\u8853\u5206\u91CE\u306B\u3064\u3044\u3066\u8CEA\u554F\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
    nextCategory: "\u6280\u8853\u30FB\u7D4C\u9A13"
  },
  2: {
    category: "\u6280\u8853\u30FB\u7D4C\u9A13",
    systemPrompt: "\u3042\u306A\u305F\u306FAI\u9762\u63A5\u5B98\u300CDadish\u300D\u3067\u3059\u3002\u9762\u63A5\u8005\u306E\u6280\u8853\u5206\u91CE\u3092\u805E\u3044\u3066\u3001\u6700\u3082\u6311\u6226\u7684\u3060\u3063\u305F\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306B\u3064\u3044\u3066\u8CEA\u554F\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
    nextCategory: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u7D4C\u9A13"
  },
  3: {
    category: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u7D4C\u9A13",
    systemPrompt: "\u3042\u306A\u305F\u306FAI\u9762\u63A5\u5B98\u300CDadish\u300D\u3067\u3059\u3002\u9762\u63A5\u8005\u306E\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u7D4C\u9A13\u3092\u805E\u3044\u3066\u3001\u5FD7\u671B\u7406\u7531\u306B\u3064\u3044\u3066\u8CEA\u554F\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
    nextCategory: "\u5FD7\u671B\u7406\u7531"
  },
  4: {
    category: "\u5FD7\u671B\u7406\u7531",
    systemPrompt: "\u3042\u306A\u305F\u306FAI\u9762\u63A5\u5B98\u300CDadish\u300D\u3067\u3059\u3002\u9762\u63A5\u8005\u306E\u5FD7\u671B\u7406\u7531\u3092\u805E\u3044\u3066\u3001\u9762\u63A5\u8005\u304B\u3089\u8CEA\u554F\u304C\u3042\u308B\u304B\u3069\u3046\u304B\u805E\u3044\u3066\u304F\u3060\u3055\u3044\u3002",
    nextCategory: "\u8CEA\u554F\u30BF\u30A4\u30E0"
  },
  5: {
    category: "\u8CEA\u554F\u30BF\u30A4\u30E0",
    systemPrompt: "\u3042\u306A\u305F\u306FAI\u9762\u63A5\u5B98\u300CDadish\u300D\u3067\u3059\u3002\u9762\u63A5\u8005\u306E\u8CEA\u554F\u306B\u7B54\u3048\u3066\u3001\u9762\u63A5\u3092\u7DE0\u3081\u304F\u304F\u3063\u3066\u304F\u3060\u3055\u3044\u3002",
    nextCategory: "\u5B8C\u4E86"
  }
};
async function onRequest5(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") {
    return handleOptions4(request);
  }
  if (request.method !== "POST") {
    return createJsonResponse4({
      error: "Method not allowed",
      method: request.method,
      allowed_methods: ["POST", "OPTIONS"]
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
      return createJsonResponse4({
        success: true,
        data: {
          message: "\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3057\u305F\uFF01\u9762\u63A5\u3092\u7D42\u4E86\u3044\u305F\u3057\u307E\u3059\u3002\u304A\u75B2\u308C\u69D8\u3067\u3057\u305F\uFF01",
          isComplete: true,
          finalScore: 8,
          summary: {
            totalQuestions: 5,
            averageScore: 8,
            strengths: ["\u8A73\u7D30\u306A\u56DE\u7B54", "\u5177\u4F53\u7684\u306A\u7D4C\u9A13\u306E\u8A00\u53CA", "\u6210\u9577\u610F\u6B32\u306E\u8868\u73FE"],
            concerns: [],
            overallAssessment: "\u826F\u597D"
          },
          progress: { current: 5, total: 5 }
        }
      });
    }
    let nextQuestionContent;
    const nextQuestion = interviewQuestions[nextQuestionId];
    if (env.OPENAI_API_KEY) {
      try {
        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `${currentQuestion.systemPrompt}

\u3010\u9762\u63A5\u306E\u6D41\u308C\u3011
1. \u81EA\u5DF1\u7D39\u4ECB
2. \u5F97\u610F\u306A\u6280\u8853\u5206\u91CE
3. \u6700\u3082\u6311\u6226\u7684\u3060\u3063\u305F\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8
4. \u5FD7\u671B\u7406\u7531
5. \u8CEA\u554F\uFF08\u9762\u63A5\u8005\u304B\u3089\uFF09

\u3010\u5FDC\u7B54\u30EB\u30FC\u30EB\u3011
- \u9762\u63A5\u8005\u306E\u56DE\u7B54\u306B\u5BFE\u3057\u3066\u7C21\u6F54\u306B\u30B3\u30E1\u30F3\u30C8\u3059\u308B
- \u6B21\u306E\u8CEA\u554F\u3092\u81EA\u7136\u306B\u7D9A\u3051\u308B
- 1\u3064\u306E\u56DE\u7B54\u306B\u3064\u304D2-3\u6587\u3067\u7D42\u308F\u3089\u305B\u308B
- \u89AA\u3057\u307F\u3084\u3059\u304F\u3001\u30D7\u30ED\u30D5\u30A7\u30C3\u30B7\u30E7\u30CA\u30EB\u306B\u5BFE\u5FDC\u3059\u308B`
              },
              {
                role: "user",
                content: `\u9762\u63A5\u8005\u306E\u56DE\u7B54: \u300C${response}\u300D

\u3053\u306E\u56DE\u7B54\u306B\u5BFE\u3057\u3066\u30B3\u30E1\u30F3\u30C8\u3057\u3001\u6B21\u306E\u300C${nextQuestion.nextCategory}\u300D\u306B\u3064\u3044\u3066\u8CEA\u554F\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
              }
            ],
            max_tokens: 200,
            temperature: 0.7
          })
        });
        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          nextQuestionContent = openaiData.choices[0].message.content.trim();
        } else {
          console.error("OpenAI API Error:", openaiResponse.status);
          nextQuestionContent = getDefaultQuestion(nextQuestionId);
        }
      } catch (error) {
        console.error("OpenAI API Error:", error);
        nextQuestionContent = getDefaultQuestion(nextQuestionId);
      }
    } else {
      nextQuestionContent = getDefaultQuestion(nextQuestionId);
    }
    const nextQuestionData = {
      id: nextQuestionId,
      category: nextQuestion.nextCategory,
      content: nextQuestionContent
    };
    const response_data = {
      message: nextQuestionContent,
      currentQuestion: nextQuestionData,
      progress: { current: nextQuestionId, total: 5 },
      isComplete: false
    };
    return createJsonResponse4({ success: true, data: response_data });
  } catch (error) {
    console.error("Error in submitResponse:", error);
    return createJsonResponse4({
      success: false,
      error: {
        message: error.message,
        stack: error.stack
      }
    }, 500);
  }
}
__name(onRequest5, "onRequest");
function getDefaultQuestion(questionId) {
  const defaults = {
    2: "\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002\u6B21\u306B\u3001\u3042\u306A\u305F\u306E\u5F97\u610F\u306A\u6280\u8853\u5206\u91CE\u306B\u3064\u3044\u3066\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u3002",
    3: "\u306A\u308B\u307B\u3069\u3002\u3067\u306F\u3001\u3053\u308C\u307E\u3067\u3067\u6700\u3082\u6311\u6226\u7684\u3060\u3063\u305F\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306B\u3064\u3044\u3066\u8A73\u3057\u304F\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u3002",
    4: "\u7D20\u6674\u3089\u3057\u3044\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3067\u3059\u306D\u3002\u6700\u5F8C\u306B\u3001\u5F0A\u793E\u3078\u306E\u5FD7\u671B\u7406\u7531\u3092\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u3002",
    5: "\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002\u4F55\u304B\u3054\u8CEA\u554F\u306F\u3054\u3056\u3044\u307E\u3059\u304B\uFF1F"
  };
  return defaults[questionId] || "\u6B21\u306E\u8CEA\u554F\u306B\u9032\u307F\u307E\u3059\u3002";
}
__name(getDefaultQuestion, "getDefaultQuestion");

// api/uploadRecording.js
function createJsonResponse5(body, status = 200) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
  return new Response(JSON.stringify(body), { status, headers });
}
__name(createJsonResponse5, "createJsonResponse");
function handleOptions5(request) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
  return new Response(null, { headers });
}
__name(handleOptions5, "handleOptions");
async function onRequest6({ request, env, ctx }) {
  if (request.method === "OPTIONS") {
    return handleOptions5(request);
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  try {
    const formData = await request.formData();
    const sessionId = formData.get("sessionId");
    const file = formData.get("file");
    if (!file) {
      return createJsonResponse5({ success: false, error: { message: "No file uploaded" } }, 400);
    }
    console.log(`Uploading file: ${file.name} for session: ${sessionId}`);
    const response_data = { message: `File ${file.name} uploaded successfully for session ${sessionId}` };
    return createJsonResponse5({ success: true, data: response_data });
  } catch (error) {
    return createJsonResponse5({ success: false, error: { message: error.message } }, 500);
  }
}
__name(onRequest6, "onRequest");

// ../.wrangler/tmp/pages-TSmlYe/functionsRoutes-0.6412235922433338.mjs
var routes = [
  {
    routePath: "/api/startInterview",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/startInterview",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions]
  },
  {
    routePath: "/api/startInterview",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/test",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/test",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/recordingControl",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  },
  {
    routePath: "/api/saveResults",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest4]
  },
  {
    routePath: "/api/startInterview",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/submitResponse",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest5]
  },
  {
    routePath: "/api/test",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/uploadRecording",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest6]
  }
];

// ../../../../.nvm/versions/node/v22.17.0/lib/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../.nvm/versions/node/v22.17.0/lib/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../../../../.nvm/versions/node/v22.17.0/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../.nvm/versions/node/v22.17.0/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-tPQ1wv/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../../../../.nvm/versions/node/v22.17.0/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-tPQ1wv/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.4521811247881804.mjs.map
