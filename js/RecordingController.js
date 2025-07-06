// 録画制御クラス - AI面接システム

class RecordingController {
    constructor() {
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.currentState = 'stopped';
        this.stream = null;
        this.startTime = null;
        this.pausedDuration = 0;
        this.pauseStartTime = null;
    }

    async startRecording() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            // ビデオコントローラーにストリームを設定
            if (window.videoController) {
                window.videoController.setVideoStream(this.stream);
            }

            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: 'video/webm;codecs=vp9,opus'
            });

            this.recordedChunks = [];
            this.startTime = new Date();
            this.pausedDuration = 0;

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                await this.handleRecordingStopped();
            };

            this.mediaRecorder.start(1000);
            this.currentState = 'recording';
            this.updateUI();

            // GASに録画開始を通知
            if (window.currentSession) {
                await window.gasConnector.controlRecording('start', window.currentSession.sessionId);
            }

            console.log('録画を開始しました');
        } catch (error) {
            console.error('録画開始エラー:', error);
            showError('録画を開始できませんでした: ' + error.message);
        }
    }

    pauseRecording() {
        if (this.currentState === 'recording') {
            this.mediaRecorder.pause();
            this.currentState = 'paused';
            this.pauseStartTime = new Date();
            this.updateUI();
            console.log('録画を一時停止しました');
        }
    }

    resumeRecording() {
        if (this.currentState === 'paused') {
            this.mediaRecorder.resume();
            this.currentState = 'recording';
            
            if (this.pauseStartTime) {
                this.pausedDuration += new Date() - this.pauseStartTime;
                this.pauseStartTime = null;
            }
            
            this.updateUI();
            console.log('録画を再開しました');
        }
    }

    async stopRecording() {
        if (this.mediaRecorder && this.currentState !== 'stopped') {
            this.mediaRecorder.stop();
            this.currentState = 'stopped';
            
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }
            
            this.updateUI();
            console.log('録画を停止しました');
        }
    }

    async handleRecordingStopped() {
        try {
            if (this.recordedChunks.length > 0 && window.currentSession) {
                showError('録画データをサーバーに保存中...', 'info');
                
                const blob = new Blob(this.recordedChunks, {
                    type: 'video/webm'
                });
                
                const timestamp = formatDateTime(new Date());
                const filename = `interview_${window.currentSession.sessionId}_${timestamp}.webm`;
                
                // GASに録画データを自動送信
                const result = await window.gasConnector.uploadRecording(
                    window.currentSession.sessionId, 
                    blob, 
                    filename
                );
                
                // GASに録画停止を通知
                await window.gasConnector.controlRecording('stop', window.currentSession.sessionId);
                
                showError('録画データの保存が完了しました', 'success');
                
                // 5秒後にメッセージを非表示
                setTimeout(() => {
                    hideError();
                }, 5000);
                
                console.log('録画データが正常に保存されました:', result);
            }
        } catch (error) {
            console.error('録画データの保存に失敗しました:', error);
            showError('録画データの保存に失敗しました: ' + error.message);
        }
    }

    updateUI() {
        const statusElement = document.getElementById('recordingStatus');
        const dotElement = document.getElementById('recordingDot');
        const textElement = document.getElementById('recordingText');
        const controlsElement = document.getElementById('recordingControls');
        const stopBtn = document.getElementById('stopRecordingBtn');
        
        // 録画停止ボタンの有効・無効切り替え
        if (stopBtn) {
            if (this.currentState === 'recording' || this.currentState === 'paused') {
                stopBtn.disabled = false;
            } else {
                stopBtn.disabled = true;
            }
        }

        switch (this.currentState) {
            case 'recording':
                statusElement.className = 'recording-status recording';
                dotElement.className = 'recording-dot pulsing';
                textElement.textContent = '録画中';
                break;
            case 'paused':
                statusElement.className = 'recording-status paused';
                dotElement.className = 'recording-dot paused';
                textElement.textContent = '一時停止中';
                break;
            case 'stopped':
                statusElement.className = 'recording-status stopped';
                dotElement.className = 'recording-dot stopped';
                textElement.textContent = '録画停止';
                break;
        }
    }

    // 録画時間を取得
    getRecordingDuration() {
        if (this.startTime) {
            const elapsed = new Date() - this.startTime - this.pausedDuration;
            return Math.floor(elapsed / 1000);
        }
        return 0;
    }

    // 録画状態を取得
    getRecordingState() {
        return this.currentState;
    }

    // 録画データを取得
    getRecordingData() {
        if (this.recordedChunks.length > 0) {
            return new Blob(this.recordedChunks, { type: 'video/webm' });
        }
        return null;
    }
}

// グローバル関数
async function startRecording() {
    if (!window.recordingController) {
        window.recordingController = new RecordingController();
    }
    await window.recordingController.startRecording();
}

async function pauseRecording() {
    if (window.recordingController) {
        window.recordingController.pauseRecording();
    }
}

async function resumeRecording() {
    if (window.recordingController) {
        window.recordingController.resumeRecording();
    }
}

async function stopRecording() {
    if (window.recordingController) {
        await window.recordingController.stopRecording();
    }
} 