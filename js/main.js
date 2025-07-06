// メインJavaScript - AI面接システム

// グローバル変数
let gasConnector = null;
let videoController = null;
let recordingController = null;
let interviewSystem = null;

// 初期化関数
function initializeSystem() {
    try {
        // 各コントローラーの初期化
        gasConnector = new GASConnector();
        videoController = new VideoController();
        recordingController = new RecordingController();
        interviewSystem = new InterviewSystem();

        // グローバル変数に設定
        window.gasConnector = gasConnector;
        window.videoController = videoController;
        window.recordingController = recordingController;
        window.interviewSystem = interviewSystem;

        // イベントリスナーの設定
        setupEventListeners();

        console.log('AI面接システムが正常に初期化されました');
        
        // 初期状態の設定
        updateStatus('面接を開始してください');
        updateProgress(0, 0);
        
        // 動作確認用のテスト機能を追加
        setupTestFunctions();
        
    } catch (error) {
        console.error('システム初期化エラー:', error);
        showError('システムの初期化に失敗しました: ' + error.message);
    }
}

// 動作確認用のテスト機能
function setupTestFunctions() {
    // Dadishの状態テスト関数
    window.testDadishStates = async function() {
        console.log('=== Dadish状態テスト開始 ===');
        
        const states = ['idle', 'speaking', 'listening', 'thinking'];
        
        for (let i = 0; i < states.length; i++) {
            const state = states[i];
            console.log(`状態変更: ${state}`);
            await window.videoController.changeState(state);
            await delay(2000); // 2秒待機
        }
        
        // 最後にidleに戻す
        await window.videoController.changeState('idle');
        console.log('=== Dadish状態テスト完了 ===');
        showError('Dadish状態テストが完了しました', 'success');
    };
    
    // 動画再生テスト
    window.testVideoPlayback = function() {
        console.log('=== 動画再生テスト ===');
        const video = document.getElementById('interviewerVideo');
        if (video) {
            console.log('動画要素:', video);
            console.log('動画ソース:', video.src);
            console.log('動画の準備状態:', video.readyState);
            console.log('動画の再生状態:', !video.paused);
            
            if (video.readyState >= 2) {
                showError('動画が正常に読み込まれています', 'success');
            } else {
                showError('動画の読み込み中です', 'info');
            }
        } else {
            showError('動画要素が見つかりません', 'error');
        }
    };
    
    // システム全体テスト
    window.runSystemTest = function() {
        console.log('=== システム全体テスト ===');
        
        // 各コントローラーの存在確認
        const controllers = {
            'VideoController': !!window.videoController,
            'RecordingController': !!window.recordingController,
            'InterviewSystem': !!window.interviewSystem,
            'GASConnector': !!window.gasConnector
        };
        
        console.log('コントローラー状態:', controllers);
        
        // 動画要素の確認
        const video = document.getElementById('interviewerVideo');
        console.log('動画要素:', !!video);
        
        // 面接官名の確認
        const interviewerName = document.querySelector('.participant-name');
        console.log('面接官名:', interviewerName ? interviewerName.textContent : '見つかりません');
        
        showError('システムテストが完了しました。コンソールを確認してください。', 'info');
    };
}

// イベントリスナーの設定
function setupEventListeners() {
    // Enter キーで送信
    const responseInput = document.getElementById('responseInput');
    if (responseInput) {
        responseInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitResponse();
            }
        });
    }

    // 名前入力フィールドのEnterキー
    const candidateNameInput = document.getElementById('candidateName');
    if (candidateNameInput) {
        candidateNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                startInterview();
            }
        });
    }

    // ページ離脱時の処理
    window.addEventListener('beforeunload', function(e) {
        if (window.currentSession) {
            e.preventDefault();
            e.returnValue = '面接中です。本当にページを離れますか？';
            return e.returnValue;
        }
    });

    // オンライン/オフライン状態の監視
    window.addEventListener('online', function() {
        showError('インターネット接続が復旧しました', 'success');
        setTimeout(hideError, 3000);
    });

    window.addEventListener('offline', function() {
        showError('インターネット接続が切断されました', 'error');
    });

    // エラーハンドリング
    window.addEventListener('error', function(e) {
        console.error('JavaScript エラー:', e.error);
        showError('予期しないエラーが発生しました', 'error');
    });

    // 未処理のPromise拒否
    window.addEventListener('unhandledrejection', function(e) {
        console.error('未処理のPromise拒否:', e.reason);
        showError('通信エラーが発生しました', 'error');
    });
}

// システム状態の確認
function checkSystemStatus() {
    const status = {
        gasConnector: !!gasConnector,
        videoController: !!videoController,
        recordingController: !!recordingController,
        interviewSystem: !!interviewSystem,
        currentSession: !!window.currentSession,
        recordingState: recordingController ? recordingController.getRecordingState() : 'unknown'
    };

    console.log('システム状態:', status);
    return status;
}

// デバッグ情報の表示
function showDebugInfo() {
    const status = checkSystemStatus();
    const debugInfo = `
        システム状態:
        - GAS連携: ${status.gasConnector ? 'OK' : 'NG'}
        - ビデオ制御: ${status.videoController ? 'OK' : 'NG'}
        - 録画制御: ${status.recordingController ? 'OK' : 'NG'}
        - 面接システム: ${status.interviewSystem ? 'OK' : 'NG'}
        - 現在のセッション: ${status.currentSession ? 'あり' : 'なし'}
        - 録画状態: ${status.recordingState}
    `;
    
    console.log(debugInfo);
    showError(debugInfo, 'info');
}

// システムリセット
function resetSystem() {
    try {
        // 各コントローラーのリセット
        if (recordingController) {
            recordingController.stopRecording();
        }
        
        if (interviewSystem) {
            interviewSystem.resetInterview();
        }
        
        if (videoController) {
            videoController.changeState('idle');
        }
        
        // グローバル変数のクリア
        window.currentSession = null;
        
        // UIのリセット
        document.getElementById('nameInputArea').style.display = 'flex';
        document.getElementById('responseArea').style.display = 'none';
        document.getElementById('chatMessages').innerHTML = '';
        document.getElementById('candidateName').value = '';
        document.getElementById('responseInput').value = '';
        
        updateStatus('面接を開始してください');
        updateProgress(0, 0);
        stopTimer();
        hideError();
        
        console.log('システムがリセットされました');
        showError('システムがリセットされました', 'success');
        
    } catch (error) {
        console.error('システムリセットエラー:', error);
        showError('システムのリセットに失敗しました: ' + error.message);
    }
}

// 開発者ツール用のグローバル関数
window.debugSystem = showDebugInfo;
window.resetSystem = resetSystem;
window.checkSystemStatus = checkSystemStatus;

// DOM読み込み完了時の初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM読み込み完了 - システム初期化開始');
    initializeSystem();
});

// ページ読み込み完了時の処理
window.addEventListener('load', function() {
    console.log('ページ読み込み完了');
    
    // システム状態の確認
    setTimeout(() => {
        checkSystemStatus();
    }, 1000);
}); 