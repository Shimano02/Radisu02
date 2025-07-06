/**
 * AI面接システム設定ファイル
 */

const CONFIG = {
    // システム設定
    SYSTEM: {
        NAME: 'AI面接システム',
        VERSION: '2.0.0',
        DEBUG_MODE: true,
        AUTO_SAVE: true
    },

    // AI面接官設定
    INTERVIEWER: {
        NAME: 'Dadish',
        AVATAR_VIDEO: 'assets/Avatar.mp4',
        AVATAR_IMAGE: 'assets/Avatar.png',
        DEFAULT_QUESTIONS: 4,
        MAX_QUESTIONS: 14,
        THINKING_TIME: 2000, // 思考時間（ミリ秒）
        SPEAKING_TIME: 3000  // 発話時間（ミリ秒）
    },

    // 評価設定
    EVALUATION: {
        MIN_SCORE: 1,
        MAX_SCORE: 10,
        PASS_THRESHOLD: 6,
        EXCELLENT_THRESHOLD: 8,
        POSITIVE_KEYWORDS: ['経験', '学習', '成長', '改善', '成功', '解決', 'チーム', '協力', '責任', '達成'],
        NEGATIVE_KEYWORDS: ['できない', 'わからない', '難しい', '失敗', '無理', '困る'],
        TECHNICAL_KEYWORDS: ['技術', 'プログラミング', '開発', 'システム', 'データ', '分析', '設計']
    },

    // GAS設定
    GAS: {
        ENABLED: false,
        BASE_URL: 'https://script.google.com/macros/s/YOUR_GAS_SCRIPT_ID/exec',
        SPREADSHEET_ID: '1-q239hLHhHydeFfd4mE-c9xhOfznlvAaYtp_X5Yx3fg',
        TIMEOUT: 10000,
        RETRY_COUNT: 3,
        AUTO_SAVE_RESULTS: true  // 面接完了時に自動保存
    },

    // 録画設定
    RECORDING: {
        ENABLED: true,
        MAX_DURATION: 3600, // 最大録画時間（秒）
        QUALITY: 'high',
        FORMAT: 'webm',
        AUTO_UPLOAD: true
    },

    // UI設定
    UI: {
        THEME: 'dark',
        ANIMATIONS: true,
        SOUND_EFFECTS: false,
        AUTO_SCROLL: true,
        SHOW_TIMER: true,
        SHOW_PROGRESS: true,
        SHOW_REALTIME_EVALUATION: false  // リアルタイム評価表示（デフォルト: 無効）
        // リアルタイム評価を有効にする場合: SHOW_REALTIME_EVALUATION: true
    },

    // 質問カテゴリ
    QUESTION_CATEGORIES: {
        '自己紹介': { weight: 1.0, required: true },
        '職歴・経験': { weight: 1.2, required: true },
        '転職理由': { weight: 1.1, required: true },
        '志望動機': { weight: 1.3, required: true },
        'スキル・能力': { weight: 1.2, required: true },
        'チームワーク': { weight: 1.0, required: false },
        '働き方・条件': { weight: 0.8, required: false },
        'キャリアビジョン': { weight: 1.1, required: false },
        '学習・成長': { weight: 1.0, required: false },
        'ストレス・課題対応': { weight: 0.9, required: false },
        '価値観・動機': { weight: 1.0, required: false },
        '逆質問対応': { weight: 0.7, required: false }
    },

    // メッセージテンプレート
    MESSAGES: {
        WELCOME: (name) => `${name ? name + 'さん、' : ''}こんにちは！本日は面接のお時間をいただき、ありがとうございます。`,
        NEXT_QUESTION: 'ありがとうございます。それでは次の質問です。',
        COMPLETE: (name) => `面接は以上で終了です。${name ? name + 'さん、' : ''}本日はお疲れさまでした。`,
        ERROR: {
            NETWORK: 'ネットワークエラーが発生しました。',
            CAMERA: 'カメラへのアクセスに失敗しました。',
            MICROPHONE: 'マイクへのアクセスに失敗しました。',
            RECORDING: '録画の開始に失敗しました。',
            UPLOAD: 'アップロードに失敗しました。'
        }
    },

    // 評価メッセージ
    ASSESSMENT_MESSAGES: {
        EXCELLENT: '優秀 - 非常に高い評価です',
        GOOD: '良好 - 期待以上の評価です',
        AVERAGE: '普通 - 標準的な評価です',
        NEEDS_IMPROVEMENT: '要改善 - 改善が必要です'
    }
};

// 設定の取得
function getConfig(path) {
    const keys = path.split('.');
    let value = CONFIG;
    
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return null;
        }
    }
    
    return value;
}

// 設定の設定
function setConfig(path, value) {
    const keys = path.split('.');
    let current = CONFIG;
    
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current) || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
}

// グローバルに公開
window.CONFIG = CONFIG;
window.getConfig = getConfig;
window.setConfig = setConfig; 