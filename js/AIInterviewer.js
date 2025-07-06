/**
 * AI面接官クラス
 * 質問生成、回答評価、面接進行管理を担当
 */
class AIInterviewer {
  constructor() {
    this.questions = [];
    this.currentQuestionIndex = 0;
    this.interviewHistory = [];
    this.candidateName = '';
    this.sessionId = null;
    this.isInterviewActive = false;
    
    this.loadQuestions();
  }

  /**
   * CSVから質問データを読み込み
   */
  async loadQuestions() {
    try {
      const response = await fetch('ai_interview_questions - シート2.csv');
      const csvText = await response.text();
      this.questions = this.parseCSV(csvText);
      console.log('質問データ読み込み完了:', this.questions.length + '件');
    } catch (error) {
      console.error('質問データ読み込みエラー:', error);
      // フォールバック用のデフォルト質問
      this.questions = this.getDefaultQuestions();
    }
  }

  /**
   * CSVパース処理
   */
  parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    
    return lines.slice(1).map((line, index) => {
      const values = line.split(',');
      return {
        id: index + 1,
        category: values[0] || '',
        content: values[1] || '',
        purpose: values[2] || '',
        asked: false,
        response: null,
        evaluation: null
      };
    });
  }

  /**
   * デフォルト質問（フォールバック用）
   */
  getDefaultQuestions() {
    return [
      {
        id: 1,
        category: '自己紹介',
        content: 'まず、簡単に自己紹介をお願いします。',
        purpose: '緊張をほぐし、基本情報を確認する',
        asked: false,
        response: null,
        evaluation: null
      },
      {
        id: 2,
        category: 'テクニカル',
        content: 'あなたの得意な技術分野について教えてください。',
        purpose: '技術スキルと経験を評価する',
        asked: false,
        response: null,
        evaluation: null
      },
      {
        id: 3,
        category: '経験',
        content: 'これまでで最も挑戦的だったプロジェクトについて教えてください。',
        purpose: '問題解決能力と経験を評価する',
        asked: false,
        response: null,
        evaluation: null
      },
      {
        id: 4,
        category: 'モチベーション',
        content: '当社を志望する理由を教えてください。',
        purpose: '志望動機と企業理解度を評価する',
        asked: false,
        response: null,
        evaluation: null
      }
    ];
  }

  /**
   * 面接開始
   */
  startInterview(candidateName = '') {
    this.candidateName = candidateName;
    this.sessionId = this.generateSessionId();
    this.currentQuestionIndex = 0;
    this.interviewHistory = [];
    this.isInterviewActive = true;

    // 質問をリセット
    this.questions.forEach(q => {
      q.asked = false;
      q.response = null;
      q.evaluation = null;
    });

    console.log('面接開始:', {
      sessionId: this.sessionId,
      candidateName: this.candidateName,
      totalQuestions: this.questions.length
    });

    return {
      sessionId: this.sessionId,
      message: this.generateWelcomeMessage(),
      currentQuestion: this.getCurrentQuestion(),
      progress: this.getProgress()
    };
  }

  /**
   * セッションID生成
   */
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 歓迎メッセージ生成
   */
  generateWelcomeMessage() {
    const greeting = this.candidateName ? 
      `${this.candidateName}さん、こんにちは！` : 
      'こんにちは！';
    
    return `${greeting}本日は面接のお時間をいただき、ありがとうございます。私はAI面接官のDadishです。リラックスして、普段通りにお答えください。それでは、最初の質問から始めさせていただきます。`;
  }

  /**
   * 現在の質問を取得
   */
  getCurrentQuestion() {
    if (this.currentQuestionIndex >= this.questions.length) {
      return null;
    }
    return this.questions[this.currentQuestionIndex];
  }

  /**
   * 進行状況を取得
   */
  getProgress() {
    return {
      current: this.currentQuestionIndex + 1,
      total: this.questions.length,
      percentage: Math.round(((this.currentQuestionIndex + 1) / this.questions.length) * 100)
    };
  }

  /**
   * 回答を処理
   */
  async processResponse(response) {
    if (!this.isInterviewActive) {
      throw new Error('面接が開始されていません');
    }

    const currentQuestion = this.getCurrentQuestion();
    if (!currentQuestion) {
      throw new Error('質問がありません');
    }

    // 回答を記録
    currentQuestion.asked = true;
    currentQuestion.response = response;

    // 回答を評価
    const evaluation = await this.evaluateResponse(currentQuestion, response);
    currentQuestion.evaluation = evaluation;

    // 履歴に追加
    this.interviewHistory.push({
      question: currentQuestion,
      response: response,
      evaluation: evaluation,
      timestamp: new Date()
    });

    // 次の質問に進む
    this.currentQuestionIndex++;

    // 面接終了判定
    if (this.currentQuestionIndex >= this.questions.length) {
      return this.endInterview();
    }

    return {
      message: this.generateNextQuestionMessage(),
      currentQuestion: this.getCurrentQuestion(),
      previousEvaluation: evaluation,
      progress: this.getProgress(),
      isComplete: false
    };
  }

  /**
   * 回答評価
   */
  async evaluateResponse(question, response) {
    // 高度な評価ロジック
    const score = this.calculateAdvancedScore(response, question);
    const keywords = this.extractKeywords(response);
    const analysis = this.analyzeResponse(response, question);
    const sentiment = this.analyzeSentiment(response);

    return {
      score: score,
      keywords: keywords,
      analysis: analysis,
      sentiment: sentiment,
      timestamp: new Date()
    };
  }

  /**
   * 高度なスコア計算
   */
  calculateAdvancedScore(response, question) {
    let score = 5; // 基本スコア

    // 回答の長さによる調整
    if (response.length > 150) score += 1.5;
    else if (response.length > 100) score += 1;
    else if (response.length > 50) score += 0.5;
    else if (response.length < 30) score -= 1;

    // キーワードによる調整
    const positiveKeywords = ['経験', '学習', '成長', '改善', '成功', '解決', 'チーム', '協力', '責任', '達成'];
    const negativeKeywords = ['できない', 'わからない', '難しい', '失敗', '無理', '困る'];
    const technicalKeywords = ['技術', 'プログラミング', '開発', 'システム', 'データ', '分析', '設計'];

    positiveKeywords.forEach(keyword => {
      if (response.includes(keyword)) score += 0.3;
    });

    negativeKeywords.forEach(keyword => {
      if (response.includes(keyword)) score -= 0.5;
    });

    technicalKeywords.forEach(keyword => {
      if (response.includes(keyword)) score += 0.2;
    });

    // 質問カテゴリ別の評価
    switch (question.category) {
      case '自己紹介':
        if (response.includes('経験') || response.includes('仕事')) score += 0.5;
        break;
      case 'テクニカル':
        if (technicalKeywords.some(k => response.includes(k))) score += 1;
        break;
      case '経験':
        if (response.includes('プロジェクト') || response.includes('成果')) score += 0.8;
        break;
      case 'モチベーション':
        if (response.includes('志望') || response.includes('理由')) score += 0.5;
        break;
    }

    // 文章構造の評価
    if (response.includes('。') && response.split('。').length > 2) score += 0.5;
    if (response.includes('、') && response.split('、').length > 3) score += 0.3;

    return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
  }

  /**
   * 感情分析
   */
  analyzeSentiment(response) {
    const positiveWords = ['楽しい', '嬉しい', '充実', 'やりがい', '成長', '成功', '達成'];
    const negativeWords = ['辛い', '大変', '困難', '失敗', '挫折', '不安'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
      if (response.includes(word)) positiveCount++;
    });
    
    negativeWords.forEach(word => {
      if (response.includes(word)) negativeCount++;
    });
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * スコア計算（簡易版）
   */
  calculateScore(response, question) {
    let score = 5; // 基本スコア

    // 回答の長さによる調整
    if (response.length > 100) score += 1;
    if (response.length > 200) score += 1;
    if (response.length < 50) score -= 1;

    // キーワードによる調整
    const positiveKeywords = ['経験', '学習', '成長', '改善', '成功', '解決', 'チーム', '協力'];
    const negativeKeywords = ['できない', 'わからない', '難しい', '失敗'];

    positiveKeywords.forEach(keyword => {
      if (response.includes(keyword)) score += 0.5;
    });

    negativeKeywords.forEach(keyword => {
      if (response.includes(keyword)) score -= 0.5;
    });

    return Math.max(1, Math.min(10, Math.round(score)));
  }

  /**
   * キーワード抽出
   */
  extractKeywords(response) {
    const keywords = [];
    const commonKeywords = ['技術', '経験', 'プロジェクト', 'チーム', '学習', '成長', '改善', '解決'];
    
    commonKeywords.forEach(keyword => {
      if (response.includes(keyword)) {
        keywords.push(keyword);
      }
    });

    return keywords;
  }

  /**
   * 回答分析
   */
  analyzeResponse(response, question) {
    const analysis = {
      strengths: [],
      concerns: [],
      suggestions: []
    };

    // 長所の分析
    if (response.length > 100) {
      analysis.strengths.push('詳細な回答');
    }
    if (response.includes('経験')) {
      analysis.strengths.push('具体的な経験の言及');
    }
    if (response.includes('学習') || response.includes('成長')) {
      analysis.strengths.push('成長意欲の表現');
    }

    // 懸念点の分析
    if (response.length < 50) {
      analysis.concerns.push('回答が短すぎる');
    }
    if (response.includes('できない') || response.includes('わからない')) {
      analysis.concerns.push('消極的な表現');
    }

    // 改善提案
    if (response.length < 100) {
      analysis.suggestions.push('より具体的な例を挙げてください');
    }
    if (!response.includes('経験')) {
      analysis.suggestions.push('具体的な経験を交えて説明してください');
    }

    return analysis;
  }

  /**
   * 次の質問メッセージ生成
   */
  generateNextQuestionMessage() {
    const currentQuestion = this.getCurrentQuestion();
    if (!currentQuestion) return '面接は以上で終了です。';

    return `ありがとうございます。それでは次の質問です。${currentQuestion.content}`;
  }

  /**
   * 面接終了
   */
  endInterview() {
    this.isInterviewActive = false;
    
    const finalScore = this.calculateFinalScore();
    const summary = this.generateInterviewSummary();

    console.log('面接終了:', {
      sessionId: this.sessionId,
      finalScore: finalScore,
      totalQuestions: this.interviewHistory.length
    });

    return {
      message: this.generateEndMessage(),
      finalScore: finalScore,
      summary: summary,
      isComplete: true,
      sessionId: this.sessionId
    };
  }

  /**
   * 最終スコア計算
   */
  calculateFinalScore() {
    if (this.interviewHistory.length === 0) return 0;
    
    const totalScore = this.interviewHistory.reduce((sum, item) => {
      return sum + (item.evaluation.score || 5);
    }, 0);
    
    return Math.round(totalScore / this.interviewHistory.length);
  }

  /**
   * 面接サマリー生成
   */
  generateInterviewSummary() {
    const totalQuestions = this.interviewHistory.length;
    const averageScore = this.calculateFinalScore();
    
    const strengths = [];
    const concerns = [];
    
    this.interviewHistory.forEach(item => {
      if (item.evaluation.analysis.strengths) {
        strengths.push(...item.evaluation.analysis.strengths);
      }
      if (item.evaluation.analysis.concerns) {
        concerns.push(...item.evaluation.analysis.concerns);
      }
    });

    return {
      totalQuestions: totalQuestions,
      averageScore: averageScore,
      strengths: [...new Set(strengths)].slice(0, 3),
      concerns: [...new Set(concerns)].slice(0, 3),
      overallAssessment: this.getOverallAssessment(averageScore)
    };
  }

  /**
   * 総合評価
   */
  getOverallAssessment(score) {
    if (score >= 8) return '優秀';
    if (score >= 6) return '良好';
    if (score >= 4) return '普通';
    return '要改善';
  }

  /**
   * 終了メッセージ生成
   */
  generateEndMessage() {
    const finalScore = this.calculateFinalScore();
    const assessment = this.getOverallAssessment(finalScore);
    
    return `面接は以上で終了です。${this.candidateName ? this.candidateName + 'さん、' : ''}本日はお疲れさまでした。結果は後日ご連絡いたします。`;
  }

  /**
   * 面接状態を取得
   */
  getInterviewStatus() {
    return {
      isActive: this.isInterviewActive,
      sessionId: this.sessionId,
      candidateName: this.candidateName,
      currentQuestion: this.getCurrentQuestion(),
      progress: this.getProgress(),
      history: this.interviewHistory
    };
  }

  /**
   * 面接をリセット
   */
  resetInterview() {
    this.isInterviewActive = false;
    this.sessionId = null;
    this.currentQuestionIndex = 0;
    this.interviewHistory = [];
    this.candidateName = '';
    
    this.questions.forEach(q => {
      q.asked = false;
      q.response = null;
      q.evaluation = null;
    });
  }
}

// グローバルインスタンス
window.AIInterviewer = AIInterviewer; 