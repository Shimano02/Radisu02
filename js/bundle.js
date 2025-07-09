// Bundle all modules into a single file to avoid MIME type issues

// Config
const CONFIG = {
    SYSTEM: {
        APP_NAME: 'AI面接システム',
        VERSION: '1.0.0',
        DEBUG_MODE: true,
    },
    UI: {
        THEME: 'dark',
        SHOW_REALTIME_EVALUATION: true,
    },
    AI_INTERVIEWER: {
        NAME: 'Dadish',
        AVATAR_VIDEO: 'assets/Avatar.mp4',
        AVATAR_IMAGE: 'assets/Avatar.png',
    },
    API: {
        BASE_URL: '/api',
    },
    RECORDING: {
        ENABLED: true,
        MIME_TYPE: 'video/webm;codecs=vp9,opus',
        AUTO_UPLOAD: true,
    },
    GAS: {
        ENABLED: false,
        BASE_URL: '',
        DEPLOY_ID: '',
        SPREADSHEET_ID: '1-q239hLHhHydeFfd4mE-c9xhOfznlvAaYtp_X5Yx3fg',
    },
};

// APIConnector
class APIConnector {
    constructor() {
        this.baseUrl = CONFIG.API.BASE_URL;
    }

    getEndpoint() {
        return this.baseUrl;
    }

    async sendRequest(action, data) {
        const url = `${this.baseUrl}/${action}`;
        const body = data;

        console.log(`Making API request to: ${url}`);
        console.log('Request data:', body);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            console.log(`Response status: ${response.status}`);
            console.log(`Response headers:`, response.headers);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API Error Response: ${errorText}`);
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { error: errorText };
                }
                throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            // Cloudflare Functions のレスポンス構造に対応
            if (result.success && result.data) {
                return result.data;
            }
            return result;
        } catch (error) {
            console.error(`API request failed for action: ${action}`, error);
            throw error;
        }
    }

    async startInterview(candidateName) {
        return this.sendRequest('startInterview', { candidateName });
    }
}

// Simple UI Controller
class UIController {
    constructor() {
        this.elements = {};
        this.isInitialized = false;
    }

    initialize() {
        this.elements.startBtn = document.getElementById('start-interview-btn');
        this.elements.candidateName = document.getElementById('candidateName');
        this.elements.errorMessage = document.getElementById('errorMessage');
        this.elements.interviewStatus = document.getElementById('interviewStatus');
        this.isInitialized = true;
    }

    showError(message) {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            this.elements.errorMessage.style.display = 'block';
        }
    }

    updateStatus(message) {
        if (this.elements.interviewStatus) {
            this.elements.interviewStatus.textContent = message;
        }
    }
}

// Complete Interview System
class InterviewSystem {
    constructor(ui, apiConnector) {
        this.ui = ui;
        this.apiConnector = apiConnector;
        this.currentSession = null;
        this.isInitialized = true;
        this.timer = null;
        this.startTime = null;
    }

    async startInterview() {
        const candidateName = this.ui.elements.candidateName.value || '匿名';
        this.ui.elements.startBtn.disabled = true;
        this.ui.updateStatus('面接を開始しています...');

        try {
            const result = await this.apiConnector.startInterview(candidateName);
            
            if (result.success) {
                this.currentSession = {
                    sessionId: result.data.sessionId,
                    candidateName: candidateName,
                    startTime: new Date(),
                    currentQuestion: result.data.currentQuestion
                };

                // UI更新
                this.ui.elements.participantName.textContent = candidateName;
                this.ui.addMessage(result.data.message, 'ai');
                this.ui.showNameInputArea(false);
                this.ui.showResponseArea(true);
                this.ui.updateStatus('面接進行中');
                this.ui.updateProgress(result.data.progress.current, result.data.progress.total);
                this.ui.startTimer();
                this.ui.elements.responseInput.focus();
                
                console.log('Interview started successfully:', result.data);
            } else {
                throw new Error(result.error?.message || 'Unknown error');
            }
            
        } catch (error) {
            console.error('面接開始エラー:', error);
            this.ui.showError('面接開始エラー: ' + error.message);
            this.ui.elements.startBtn.disabled = false;
        }
    }

    async submitResponse() {
        const responseText = this.ui.elements.responseInput.value.trim();
        if (!responseText) {
            this.ui.showError('回答を入力してください。');
            return;
        }

        this.ui.elements.submitBtn.disabled = true;
        this.ui.addMessage(responseText, 'user');
        this.ui.elements.responseInput.value = '';
        this.ui.showLoading(true);

        try {
            const result = await this.apiConnector.submitResponse(
                this.currentSession.sessionId,
                responseText,
                this.currentSession.currentQuestion.id
            );

            this.ui.showLoading(false);
            
            if (result.success) {
                this.ui.addMessage(result.data.message, 'ai');
                
                if (result.data.isComplete) {
                    // 面接完了
                    this.ui.updateStatus('面接完了');
                    this.ui.showResponseArea(false);
                    this.ui.stopTimer();
                    this.ui.addMessage('面接が完了しました。ありがとうございました！', 'system');
                } else {
                    // 次の質問に進む
                    this.currentSession.currentQuestion = result.data.currentQuestion;
                    this.ui.updateProgress(result.data.progress.current, result.data.progress.total);
                    this.ui.elements.responseInput.focus();
                }
            } else {
                throw new Error(result.error?.message || 'Unknown error');
            }
            
        } catch (error) {
            console.error('回答送信エラー:', error);
            this.ui.showError('回答送信エラー: ' + error.message);
        } finally {
            this.ui.elements.submitBtn.disabled = false;
            this.ui.showLoading(false);
        }
    }

    isInterviewActive() {
        return this.currentSession !== null;
    }

    resetInterview() {
        this.currentSession = null;
        this.ui.elements.startBtn.disabled = false;
        this.ui.updateStatus('面接を開始してください');
        this.ui.showNameInputArea(true);
        this.ui.showResponseArea(false);
        this.ui.stopTimer();
        this.ui.clearMessages();
    }

    getInterviewState() {
        return {
            isActive: this.isInterviewActive(),
            session: this.currentSession
        };
    }
}

// Application initialization
const app = {};

function initializeSystem() {
    try {
        app.ui = new UIController();
        app.apiConnector = new APIConnector();
        app.interviewSystem = new InterviewSystem(app.ui, app.apiConnector);

        app.ui.initialize();
        setupEventListeners();
        setupDeveloperTools();

        console.log('AI面接システムが正常に初期化されました');
        
    } catch (error) {
        console.error('システム初期化エラー:', error);
        if (app.ui) {
            app.ui.showError('システムの初期化に失敗しました: ' + error.message);
        }
    }
}

function setupEventListeners() {
    const startBtn = document.getElementById('start-interview-btn');
    const candidateNameInput = document.getElementById('candidateName');

    if (startBtn) {
        startBtn.addEventListener('click', () => app.interviewSystem.startInterview());
    }
    if (candidateNameInput) {
        candidateNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                app.interviewSystem.startInterview();
            }
        });
    }

    window.addEventListener('beforeunload', (e) => {
        if (app.interviewSystem.isInterviewActive()) {
            e.preventDefault();
            e.returnValue = '面接中です。本当にページを離れますか？';
            return e.returnValue;
        }
    });
}

function setupDeveloperTools() {
    window.app = app;
    window.resetSystem = () => app.interviewSystem.resetInterview();
    window.checkSystemStatus = () => {
        console.log({
            interview: app.interviewSystem.getInterviewState(),
            api: app.apiConnector.getEndpoint(),
        });
    };
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeSystem);