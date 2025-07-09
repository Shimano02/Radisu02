// UIコントローラークラス - AI面接システム

class UIController {
    constructor() {
        this.elements = {
            // Header
            recordingStatus: document.getElementById('recordingStatus'),
            recordingDot: document.getElementById('recordingDot'),
            recordingText: document.getElementById('recordingText'),
            recordingControls: document.getElementById('recordingControls'),
            startRecordingBtn: document.querySelector('.start-btn'),
            stopRecordingBtn: document.getElementById('stop-btn'), // Changed from stopRecordingBtn to stop-btn
            timer: document.getElementById('timer'),
            progressInfo: document.getElementById('progressInfo'),

            // Video
            interviewerContainer: document.getElementById('interviewerContainer'),
            interviewerVideo: document.getElementById('interviewerVideo'),
            interviewerImage: document.getElementById('interviewerImage'),
            candidateVideo: document.getElementById('candidateVideo'),
            cameraPlaceholder: document.getElementById('cameraPlaceholder'),
            participantName: document.getElementById('participantName'),
            candidateCamera: document.getElementById('candidateCamera'),
            candidateMic: document.getElementById('candidateMic'),

            // Chat
            interviewStatus: document.getElementById('interviewStatus'),
            errorMessage: document.getElementById('errorMessage'),
            chatMessages: document.getElementById('chatMessages'),
            loading: document.getElementById('loading'),
            nameInputArea: document.getElementById('nameInputArea'),
            candidateName: document.getElementById('candidateName'),
            startBtn: document.getElementById('start-interview-btn'), // Corrected ID
            responseArea: document.getElementById('responseArea'),
            responseInput: document.getElementById('user-input'), // Corrected ID
            submitBtn: document.getElementById('send-btn'), // Corrected ID
        };

        console.log('UIController constructor: startBtn', this.elements.startBtn);
        console.log('UIController constructor: submitBtn', this.elements.submitBtn);
        console.log('UIController constructor: responseInput', this.elements.responseInput);
        console.log('UIController constructor: stopBtn', this.elements.stopBtn);
    }

    // UIの初期化
    initialize() {
        this.updateStatus('面接を開始してください');
        this.updateProgress(0, 0);
        this.showResponseArea(false);
        this.showNameInputArea(true);
    }

    // ステータス更新
    updateStatus(message) {
        if (this.elements.interviewStatus) {
            this.elements.interviewStatus.textContent = message;
        }
    }

    // プログレス更新
    updateProgress(current, total) {
        if (this.elements.progressInfo) {
            this.elements.progressInfo.textContent = `質問 ${current}/${total}`;
        }
    }

    // 回答エリアの表示/非表示
    showResponseArea(show) {
        if (this.elements.responseArea) {
            this.elements.responseArea.style.display = show ? 'flex' : 'none';
        }
    }

    // 名前入力エリアの表示/非表示
    showNameInputArea(show) {
        if (this.elements.nameInputArea) {
            this.elements.nameInputArea.style.display = show ? 'flex' : 'none';
        }
    }

    // メッセージをチャットエリアに追加
    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender} message-enter`;

        const messageText = document.createElement('div');
        messageText.textContent = text;
        messageDiv.appendChild(messageText);

        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date().toLocaleTimeString();
        messageDiv.appendChild(timeDiv);

        if (this.elements.chatMessages) {
            this.elements.chatMessages.appendChild(messageDiv);
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }
    }

    // ローディング表示の切り替え
    showLoading(show) {
        if (this.elements.loading) {
            this.elements.loading.className = show ? 'loading active' : 'loading';
        }
    }

    // エラーメッセージの表示
    showError(message, type = 'error') {
        if (this.elements.errorMessage) {
            const errorElement = this.elements.errorMessage;
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
    }

    // エラーメッセージの非表示
    hideError() {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.style.display = 'none';
        }
    }
    
    // 録画UIの更新
    updateRecordingUI(state) {
        if (this.elements.recordingStatus && this.elements.recordingDot && this.elements.recordingText && this.elements.stopBtn) { // Changed to stopBtn
            const statusElement = this.elements.recordingStatus;
            const dotElement = this.elements.recordingDot;
            const textElement = this.elements.recordingText;
            const stopBtn = this.elements.stopBtn; // Changed to stopBtn

            stopBtn.disabled = (state === 'stopped');

            switch (state) {
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
    }

    // タイマー開始
    startTimer() {
        this.interviewStartTime = new Date();
        this.timerInterval = setInterval(() => {
            const elapsed = new Date() - this.interviewStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            if (this.elements.timer) {
                this.elements.timer.textContent = 
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    // タイマー停止
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
}
export default UIController;
