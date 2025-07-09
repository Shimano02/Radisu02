// 面接システムクラス - AI面接システム

import AIInterviewer from './AIInterviewer.js';

class InterviewSystem {
    constructor(ui, apiConnector, videoController, recordingController) {
        this.ui = ui;
        this.apiConnector = apiConnector;
        this.videoController = videoController;
        this.recordingController = recordingController;

        this.currentSession = null;
        this.isInitialized = false;
        this.aiInterviewer = null;
        this.initializeAIInterviewer();
    }

    // AI面接官の初期化
    async initializeAIInterviewer() {
        try {
            this.aiInterviewer = new AIInterviewer();
            await this.aiInterviewer.loadQuestions();
            this.isInitialized = true;
            console.log('AI面接官初期化完了');
        } catch (error) {
            console.error('AI面接官初期化エラー:', error);
            this.ui.showError('AI面接官の初期化中にエラーが発生しました。');
        }
    }

    // 面接開始
    async startInterview() {
        const candidateName = this.ui.elements.candidateName.value;
        this.ui.elements.startBtn.disabled = true;
        this.ui.updateStatus('面接を開始しています...');

        try {
            if (!this.isInitialized || !this.aiInterviewer) {
                await this.initializeAIInterviewer();
            }

            const result = await this.apiConnector.startInterview(candidateName);
            
            this.currentSession = {
                sessionId: result.sessionId,
                candidateName: candidateName,
                startTime: new Date(),
                currentQuestion: result.currentQuestion
            };

            this.ui.elements.participantName.textContent = candidateName || '面接者';
            this.ui.addMessage(result.message, 'ai');
            await this.videoController.changeState('speaking');
            
            this.ui.showNameInputArea(false);
            this.ui.showResponseArea(true);
            this.ui.updateStatus('面接進行中');
            this.ui.updateProgress(result.progress.current, result.progress.total);
            
            this.ui.startTimer(); 
            this.ui.elements.responseInput.focus();
            
        } catch (error) {
            console.error('面接開始エラー:', error);
            this.ui.showError('面接の開始に失敗しました: ' + error.message);
            this.ui.elements.startBtn.disabled = false;
        }
    }

    // 回答送信
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
            await this.videoController.changeState('thinking');
            
            const result = await this.apiConnector.submitResponse(
                this.currentSession.sessionId,
                responseText,
                this.currentSession.currentQuestion.id
            );

            if (result.isComplete) {
                this.ui.addMessage(result.message, 'ai');
                this.ui.updateStatus('面接完了');
                this.ui.showResponseArea(false);
                
                await this.saveInterviewResults(result);
                await this.recordingController.stopRecording();
                this.ui.stopTimer();
                await this.videoController.changeState('idle');
                
            } else {
                this.ui.addMessage(result.message, 'ai');
                this.currentSession.currentQuestion = result.currentQuestion;
                
                await this.videoController.changeState('speaking');
                
                if (result.progress) {
                    this.ui.updateProgress(result.progress.current, result.progress.total);
                }
                
                this.ui.elements.submitBtn.disabled = false;
                this.ui.elements.responseInput.focus();
            }
            
        } catch (error) {
            console.error('回答送信エラー:', error);
            this.ui.showError('回答の送信に失敗しました: ' + error.message);
            this.ui.elements.submitBtn.disabled = false;
        } finally {
            this.ui.showLoading(false);
        }
    }

    // 面接結果を保存
    async saveInterviewResults(result) {
        try {
            const interviewData = {
                sessionId: this.currentSession.sessionId,
                candidateName: this.currentSession.candidateName,
                startTime: this.currentSession.startTime,
                endTime: new Date(),
                duration: this.calculateInterviewDuration(),
                finalScore: result.finalScore,
                totalQuestions: result.summary.totalQuestions,
                summary: result.summary,
                questions: this.aiInterviewer.interviewHistory.map(item => ({
                    question: item.question.content,
                    response: item.response,
                    evaluation: item.evaluation,
                    timestamp: item.timestamp
                }))
            };

            await this.apiConnector.sendRequest('saveResults', interviewData);
            this.ui.addMessage('📊 面接結果を保存しました', 'system');

        } catch (error) {
            console.error('面接結果保存エラー:', error);
            this.ui.addMessage('⚠️ 面接結果の保存に失敗しました: ' + error.message, 'system');
        }
    }
    
    calculateInterviewDuration() {
        if (!this.currentSession || !this.currentSession.startTime) return 0;
        const duration = Math.floor((new Date() - this.currentSession.startTime) / 1000 / 60);
        return duration;
    }

    // 面接リセット
    resetInterview() {
        this.currentSession = null;
        this.ui.initialize();
        this.ui.stopTimer();
        this.videoController.changeState('idle');
        this.ui.elements.chatMessages.innerHTML = '';
        this.ui.elements.candidateName.value = '';
    }

    isInterviewActive() {
        return !!this.currentSession;
    }

    getInterviewState() {
        return {
            sessionId: this.currentSession?.sessionId,
            candidateName: this.currentSession?.candidateName,
            currentQuestion: this.currentSession?.currentQuestion,
            isActive: this.isInterviewActive()
        };
    }
}

export default InterviewSystem;
