// ユーティリティ関数 - AI面接システム

// デバッグ機能
function debugDadish() {
    const videoController = window.videoController;
    if (videoController) {
        const videoState = videoController.getVideoState();
        console.log('=== Dadish デバッグ情報 ===');
        console.log('現在の状態:', videoState.currentState);
        console.log('動画再生中:', videoState.isPlaying);
        console.log('動画ソース:', videoState.videoSource);
        console.log('ビデオ要素:', videoController.interviewerVideo);
        
        if (videoController.interviewerVideo) {
            console.log('動画の準備状態:', videoController.interviewerVideo.readyState);
            console.log('動画の再生状態:', !videoController.interviewerVideo.paused);
            console.log('動画の現在時間:', videoController.interviewerVideo.currentTime);
            console.log('動画の総時間:', videoController.interviewerVideo.duration);
        }
        
        showError(`Dadish状態: ${videoState.currentState}, 再生中: ${videoState.isPlaying}`, 'info');
    } else {
        console.error('VideoControllerが見つかりません');
        showError('VideoControllerが見つかりません', 'error');
    }
}

// システム状態確認
function debugSystem() {
    console.log('=== システム全体デバッグ情報 ===');
    
    const status = {
        videoController: !!window.videoController,
        recordingController: !!window.recordingController,
        interviewSystem: !!window.interviewSystem,
        gasConnector: !!window.gasConnector,
        currentSession: !!window.currentSession
    };
    
    console.log('システム状態:', status);
    
    if (window.videoController) {
        debugDadish();
    }
    
    if (window.recordingController) {
        console.log('録画状態:', window.recordingController.getRecordingState());
    }
    
    if (window.interviewSystem) {
        console.log('面接状態:', window.interviewSystem.getInterviewState());
    }
    
    showError('デバッグ情報をコンソールに出力しました', 'info');
}

// エラーメッセージ表示
function showError(message, type = 'error') {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    if (type === 'success') {
        errorElement.style.background = 'rgba(87, 242, 135, 0.1)';
        errorElement.style.borderColor = 'var(--accent-green)';
        errorElement.style.color = 'var(--accent-green)';
    } else if (type === 'info') {
        errorElement.style.background = 'rgba(88, 101, 242, 0.1)';
        errorElement.style.borderColor = 'var(--accent-blue)';
        errorElement.style.color = 'var(--accent-blue)';
    } else {
        errorElement.style.background = 'rgba(237, 66, 69, 0.1)';
        errorElement.style.borderColor = 'var(--accent-red)';
        errorElement.style.color = 'var(--accent-red)';
    }
}

// エラーメッセージ非表示
function hideError() {
    document.getElementById('errorMessage').style.display = 'none';
}

// ローディング表示
function showLoading(show) {
    const loading = document.getElementById('loading');
    loading.className = show ? 'loading active' : 'loading';
}

// ステータス更新
function updateStatus(message) {
    document.getElementById('interviewStatus').textContent = message;
}

// メッセージ追加
function addMessage(text, sender) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender} message-enter`;
    
    const messageText = document.createElement('div');
    messageText.textContent = text;
    messageDiv.appendChild(messageText);
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString();
    messageDiv.appendChild(timeDiv);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// プログレス更新
function updateProgress(current, total) {
    document.getElementById('progressInfo').textContent = `質問 ${current}/${total}`;
}

// タイマー開始
function startTimer() {
    interviewStartTime = new Date();
    timerInterval = setInterval(() => {
        const elapsed = new Date() - interviewStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        document.getElementById('timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// タイマー停止
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// 遅延関数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 日時フォーマット
function formatDateTime(date) {
    return date.toISOString().replace(/[:.]/g, '-');
}

// ファイルサイズフォーマット
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 録画時間フォーマット
function formatRecordingTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// カメラ・マイク制御
function toggleMicrophone() {
    // 実装予定
    console.log('マイク切り替え機能は実装予定です');
}

function toggleCamera() {
    // 実装予定
    console.log('カメラ切り替え機能は実装予定です');
}

// 面接結果ダウンロード
function downloadResults() {
    if (!window.interviewSystem || !window.interviewSystem.currentSession) {
        showError('面接結果がありません');
        return;
    }

    const session = window.interviewSystem.currentSession;
    const aiInterviewer = window.interviewSystem.aiInterviewer;
    
    if (!aiInterviewer || !aiInterviewer.interviewHistory) {
        showError('面接履歴がありません');
        return;
    }

    const results = {
        sessionId: session.sessionId,
        candidateName: session.candidateName,
        startTime: session.startTime,
        endTime: new Date(),
        duration: window.interviewSystem.calculateInterviewDuration(),
        finalScore: aiInterviewer.calculateFinalScore(),
        summary: aiInterviewer.generateInterviewSummary(),
        questions: aiInterviewer.interviewHistory.map(item => ({
            question: item.question.content,
            response: item.response,
            evaluation: item.evaluation,
            timestamp: item.timestamp
        }))
    };

    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `interview_results_${session.sessionId}.json`;
    link.click();
    
    URL.revokeObjectURL(link.href);
}

// グローバル変数
let interviewStartTime = null;
let timerInterval = null;

// グローバル関数として公開
window.debugDadish = debugDadish;
window.debugSystem = debugSystem;
window.downloadResults = downloadResults; 