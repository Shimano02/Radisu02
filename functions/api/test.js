export function onRequestGet(context) {
  return new Response(JSON.stringify({
    message: 'GET method works!',
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export function onRequestPost(context) {
  return new Response(JSON.stringify({
    message: 'POST method works!',
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export function onRequest(context) {
  const { request } = context;
  
  if (request.method === 'GET') {
    return onRequestGet(context);
  } else if (request.method === 'POST') {
    return onRequestPost(context);
  }
  
  return new Response('Method not allowed', {
    status: 405,
    headers: {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
    },
  });
}