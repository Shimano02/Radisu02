// モックAPIサーバー
import http from 'http';
import url from 'url';

const mockResponses = {
  startInterview: {
    success: true,
    data: {
      sessionId: 'mock-session-123',
      message: 'こんにちは！AI面接官のDadishです。まずは自己紹介をお願いします。',
      currentQuestion: {
        id: 1,
        category: '自己紹介',
        content: '自己紹介をお願いします。'
      },
      progress: { current: 1, total: 5 }
    }
  },
  submitResponse: {
    success: true,
    data: {
      message: 'ありがとうございます。次に、あなたの得意な技術分野について教えてください。',
      currentQuestion: {
        id: 2,
        category: '技術',
        content: '得意な技術分野について教えてください。'
      },
      progress: { current: 2, total: 5 }
    }
  },
  uploadRecording: {
    success: true,
    data: {
      message: '録画が正常にアップロードされました。'
    }
  }
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname.replace('/api/', '');

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      console.log(`Mock API called: ${path}`);
      
      let response = { success: false, error: 'Unknown endpoint' };
      
      if (mockResponses[path]) {
        response = mockResponses[path];
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    });
  } else {
    res.writeHead(405);
    res.end('Method Not Allowed');
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
}); 