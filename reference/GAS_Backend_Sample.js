/**
 * GASバックエンド - 面接結果保存サンプル
 * このコードをGoogle Apps Scriptにコピーして使用してください
 */

// スプレッドシートID（実際のIDに変更してください）
const SPREADSHEET_ID = '1-q239hLHhHydeFfd4mE-c9xhOfznlvAaYtp_X5Yx3fg';

// 面接結果保存処理
function saveInterviewResults(requestData) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('InterviewResults') || createInterviewResultsSheet(spreadsheet);
    
    const rowData = [
      requestData.sessionId,
      requestData.candidateName || '匿名',
      new Date(requestData.startTime),
      new Date(requestData.endTime),
      requestData.duration + '分',
      requestData.finalScore + '/10',
      requestData.summary.overallAssessment,
      requestData.totalQuestions + '問',
      requestData.summary.strengths.join(', '),
      requestData.summary.concerns.join(', '),
      JSON.stringify(requestData.questions),
      new Date()
    ];
    
    sheet.appendRow(rowData);
    
    // ログ出力
    console.log('面接結果を保存しました:', {
      sessionId: requestData.sessionId,
      candidateName: requestData.candidateName,
      score: requestData.finalScore
    });
    
    return {
      success: true,
      message: '面接結果をスプレッドシートに保存しました',
      rowNumber: sheet.getLastRow()
    };
    
  } catch (error) {
    console.error('面接結果保存エラー:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 面接結果シート作成
function createInterviewResultsSheet(spreadsheet) {
  const sheet = spreadsheet.insertSheet('InterviewResults');
  
  // ヘッダー設定
  const headers = [
    'セッションID',
    '候補者名',
    '開始時刻',
    '終了時刻',
    '面接時間',
    '最終スコア',
    '総合評価',
    '質問数',
    '良い点',
    '改善点',
    '詳細データ',
    '保存日時'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // ヘッダー装飾
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('white');
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);
  
  return sheet;
}

// WebAppエントリーポイント
function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    
    let result;
    
    switch (action) {
      case 'saveInterviewResults':
        result = saveInterviewResults(requestData);
        break;
      case 'healthCheck':
        result = { success: true, message: 'GAS接続正常' };
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      
  } catch (error) {
    console.error('GAS処理エラー:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// テスト用関数
function testSaveInterviewResults() {
  const testData = {
    action: 'saveInterviewResults',
    sessionId: 'test_session_' + Date.now(),
    candidateName: 'テスト太郎',
    startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30分前
    endTime: new Date().toISOString(),
    duration: 30,
    finalScore: 7,
    totalQuestions: 4,
    summary: {
      overallAssessment: '良好',
      strengths: ['コミュニケーション能力', '経験の具体性'],
      concerns: ['回答の詳細度']
    },
    questions: [
      {
        question: '自己紹介をお願いします',
        response: 'テスト回答です',
        evaluation: { score: 7, keywords: ['経験'] },
        timestamp: new Date().toISOString()
      }
    ]
  };
  
  const result = saveInterviewResults(testData);
  console.log('テスト結果:', result);
} 