const CONFIG = {
    // システム設定
    SYSTEM: {
        APP_NAME: 'AI面接システム',
        VERSION: '1.0.0',
        DEBUG_MODE: true, // デバッグモード
    },

    // UI設定
    UI: {
        THEME: 'dark', // dark or light
        SHOW_REALTIME_EVALUATION: true, // リアルタイム評価の表示
    },

    // AI面接官設定
    AI_INTERVIEWER: {
        NAME: 'Dadish',
        AVATAR_VIDEO: 'assets/Avatar.mp4',
        AVATAR_IMAGE: 'assets/Avatar.png',
    },

    // バックエンド設定 (Cloudflare Worker)
    API: {
        // BASE_URLはサイトのルートからの相対パスになります
        BASE_URL: '/api',
    },

    // 録画設定
    RECORDING: {
        ENABLED: true,
        MIME_TYPE: 'video/webm;codecs=vp9,opus',
        AUTO_UPLOAD: true, // 録画の自動アップロード
    },

    // 下方互換性のための古いGAS設定（現在は使用しない）
    GAS: {
        ENABLED: false,
        BASE_URL: '',
        DEPLOY_ID: '',
        SPREADSHEET_ID: '1-q239hLHhHydeFfd4mE-c9xhOfznlvAaYtp_X5Yx3fg',
    },
};

export default CONFIG;