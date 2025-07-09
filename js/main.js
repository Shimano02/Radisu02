
import UIController from './UIController.js';
import APIConnector from './APIConnector.js';
import VideoController from './VideoController.js';
import RecordingController from './RecordingController.js';
import InterviewSystem from './InterviewSystem.js';

// アプリケーション名前空間
const app = {};

// 初期化関数
function initializeSystem() {
    try {
        // 各コントローラーの初期化
        app.ui = new UIController();
        app.apiConnector = new APIConnector();
        app.videoController = new VideoController(app.ui);
        app.recordingController = new RecordingController(app.ui, app.apiConnector);
        app.interviewSystem = new InterviewSystem(app.ui, app.apiConnector, app.videoController, app.recordingController);

        // UIの初期化
        app.ui.initialize();

        // イベントリスナーの設定
        setupEventListeners();

        console.log('AI面接システムが正常に初期化されました');
        
        // 開発者向け機能
        setupDeveloperTools();
        
    } catch (error) {
        console.error('システム初期化エラー:', error);
        if (app.ui) {
            app.ui.showError('システムの初期化に失敗しました: ' + error.message);
        }
    }
}

// イベントリスナーの設定
function setupEventListeners() {
    const startBtn = document.getElementById('start-interview-btn');
    const sendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const recordBtn = document.getElementById('record-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const candidateNameInput = document.getElementById('candidateName');

    // 開始ボタン
    if (startBtn) {
        startBtn.addEventListener('click', () => app.interviewSystem.startInterview(candidateNameInput.value));
    }
    if (candidateNameInput) {
        candidateNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                app.interviewSystem.startInterview(candidateNameInput.value);
            }
        });
    }

    // 送信ボタン
    if (sendBtn) {
        sendBtn.addEventListener('click', () => app.interviewSystem.submitResponse());
    }
    if (userInput) {
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                app.interviewSystem.submitResponse();
            }
        });
    }

    // 録画ボタン
    if (recordBtn) {
        recordBtn.addEventListener('click', () => app.recordingController.startRecording());
    }
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => app.recordingController.pauseRecording());
    }
    if (stopBtn) {
        stopBtn.addEventListener('click', () => app.recordingController.stopRecording());
    }

    // ページ離脱時の処理
    window.addEventListener('beforeunload', (e) => {
        if (app.interviewSystem.isInterviewActive()) {
            e.preventDefault();
            e.returnValue = '面接中です。本当にページを離れますか？';
            return e.returnValue;
        }
    });
}

// 開発者ツール用のグローバル関数
function setupDeveloperTools() {
    window.app = app; // コンソールからアクセス可能にする
    window.resetSystem = () => app.interviewSystem.resetInterview();
    window.checkSystemStatus = () => {
        console.log({
            interview: app.interviewSystem.getInterviewState(),
            recording: app.recordingController.getRecordingState(),
            video: app.videoController.getVideoState(),
            api: app.apiConnector.getEndpoint(),
        });
    };
}

// DOM読み込み完了時の初期化
document.addEventListener('DOMContentLoaded', initializeSystem);
