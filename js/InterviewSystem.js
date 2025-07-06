// 面接システムクラス - AI面接システム

class InterviewSystem {
    constructor() {
        this.currentSession = null;
        this.currentQuestion = null;
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
        }
    }

    // 面接開始
    async startInterview() {
        const candidateName = document.getElementById('candidateName').value;
        const startBtn = document.getElementById('startBtn');
        
        startBtn.disabled = true;
        updateStatus('面接を開始しています...');

        try {
            // AI面接官が初期化されていない場合は待機
            if (!this.isInitialized || !this.aiInterviewer) {
                await this.initializeAIInterviewer();
            }

            // GASまたはローカルで面接開始
            let result;
            if (window.gasConnector && window.gasConnector.isGASEnabled) {
                result = await window.gasConnector.startInterview(candidateName);
            } else {
                result = await this.aiInterviewer.startInterview(candidateName);
            }
            
            this.currentSession = {
                sessionId: result.sessionId,
                candidateName: candidateName,
                startTime: new Date(),
                currentQuestion: result.currentQuestion
            };

            // グローバル変数に設定
            window.currentSession = this.currentSession;

            // 参加者名を更新
            document.getElementById('participantName').textContent = candidateName || '面接者';

            addMessage(result.message, 'ai');
            
            // ビデオ状態をspeakingに変更
            await window.videoController.changeState('speaking');
            
            document.getElementById('nameInputArea').style.display = 'none';
            document.getElementById('responseArea').style.display = 'flex';
            updateStatus('面接進行中');
            updateProgress(result.progress.current, result.progress.total);
            
            startTimer();
            document.getElementById('responseInput').focus();
            
        } catch (error) {
            console.error('面接開始エラー:', error);
            showError('面接の開始に失敗しました: ' + error.message);
            startBtn.disabled = false;
        }
    }

    // 回答送信
    async submitResponse() {
        const responseText = document.getElementById('responseInput').value.trim();
        if (!responseText) {
            showError('回答を入力してください。');
            return;
        }

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        
        addMessage(responseText, 'user');
        document.getElementById('responseInput').value = '';
        showLoading(true);

        try {
            // ビデオ状態をthinkingに変更
            await window.videoController.changeState('thinking');
            
            // GASまたはローカルで回答処理
            let result;
            if (window.gasConnector && window.gasConnector.isGASEnabled) {
                result = await window.gasConnector.submitResponse(
                    this.currentSession.sessionId,
                    responseText,
                    this.currentSession.currentQuestion.id
                );
            } else {
                result = await this.aiInterviewer.processResponse(responseText);
            }

            if (result.isComplete) {
                addMessage(result.message, 'ai');
                updateStatus('面接完了');
                document.getElementById('responseArea').style.display = 'none';
                
                // 面接結果をスプレッドシートに保存
                await this.saveInterviewResultsToSpreadsheet(result);
                
                // 面接結果を表示
                this.showInterviewResults(result);
                
                await window.recordingController.stopRecording();
                stopTimer();
                
                await window.videoController.changeState('idle');
                
            } else {
                addMessage(result.message, 'ai');
                this.currentSession.currentQuestion = result.currentQuestion;
                
                // リアルタイム評価を表示（設定が有効な場合）
                if (result.previousEvaluation && getConfig('UI.SHOW_REALTIME_EVALUATION')) {
                    this.showRealtimeEvaluation(result.previousEvaluation);
                }
                
                // ビデオ状態をspeakingに変更
                await window.videoController.changeState('speaking');
                
                if (result.progress) {
                    updateProgress(result.progress.current, result.progress.total);
                }
                
                submitBtn.disabled = false;
                document.getElementById('responseInput').focus();
            }
            
        } catch (error) {
            console.error('回答送信エラー:', error);
            showError('回答の送信に失敗しました: ' + error.message);
            submitBtn.disabled = false;
        } finally {
            showLoading(false);
        }
    }

    // 面接結果表示
    showInterviewResults(result) {
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'interview-results';
        
        // スコアに基づく評価色を決定
        const scoreColor = result.finalScore >= 8 ? 'var(--accent-green)' : 
                          result.finalScore >= 6 ? 'var(--accent-blue)' : 
                          result.finalScore >= 4 ? 'var(--accent-orange)' : 'var(--accent-red)';
        
        resultsDiv.innerHTML = `
            <h3>🎯 面接結果</h3>
            <div class="result-summary">
                <div class="score-display" style="text-align: center; margin-bottom: 16px;">
                    <div class="score-circle" style="
                        width: 80px; 
                        height: 80px; 
                        border-radius: 50%; 
                        background: ${scoreColor}; 
                        color: white; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        font-size: 24px; 
                        font-weight: bold; 
                        margin: 0 auto 8px auto;
                    ">${result.finalScore}</div>
                    <div style="font-size: 18px; font-weight: 600; color: ${scoreColor};">${result.summary.overallAssessment}</div>
                </div>
                <p><strong>総合評価:</strong> ${result.summary.overallAssessment}</p>
                <p><strong>平均スコア:</strong> ${result.finalScore}/10</p>
                <p><strong>質問数:</strong> ${result.summary.totalQuestions}問</p>
                <p><strong>面接時間:</strong> ${this.calculateInterviewDuration()}分</p>
            </div>
            <div class="result-details">
                <div class="strengths">
                    <h4>✅ 良い点</h4>
                    <ul>
                        ${result.summary.strengths.length > 0 ? 
                          result.summary.strengths.map(s => `<li>${s}</li>`).join('') : 
                          '<li>特に良い点はありませんでした</li>'}
                    </ul>
                </div>
                <div class="concerns">
                    <h4>⚠️ 改善点</h4>
                    <ul>
                        ${result.summary.concerns.length > 0 ? 
                          result.summary.concerns.map(c => `<li>${c}</li>`).join('') : 
                          '<li>特に改善点はありませんでした</li>'}
                    </ul>
                </div>
            </div>
            <div class="result-actions" style="margin-top: 16px; text-align: center;">
                <button class="btn btn-secondary" onclick="resetInterview()" style="margin-right: 8px;">
                    <i class="fas fa-redo"></i> 新しい面接を開始
                </button>
                <button class="btn" onclick="downloadResults()" style="margin-left: 8px;">
                    <i class="fas fa-download"></i> 結果をダウンロード
                </button>
            </div>
        `;
        
        document.getElementById('chatMessages').appendChild(resultsDiv);
    }

    // 面接時間計算
    calculateInterviewDuration() {
        if (!this.currentSession || !this.currentSession.startTime) return 0;
        const duration = Math.floor((new Date() - this.currentSession.startTime) / 1000 / 60);
        return duration;
    }

    // 面接結果をスプレッドシートに保存
    async saveInterviewResultsToSpreadsheet(result) {
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

            // GASまたはローカルで保存
            if (window.gasConnector && window.gasConnector.isGASEnabled) {
                await window.gasConnector.saveInterviewResults(interviewData);
                console.log('面接結果をGAS経由でスプレッドシートに保存しました');
            } else {
                // ローカルストレージに保存（GASが利用できない場合）
                window.gasConnector.saveToLocalStorage(interviewData);
                console.log('面接結果をローカルストレージに保存しました（GAS未接続）');
            }

            // 保存完了メッセージ
            addMessage('📊 面接結果をスプレッドシートに保存しました', 'system');
            
        } catch (error) {
            console.error('面接結果保存エラー:', error);
            addMessage('⚠️ 面接結果の保存に失敗しました: ' + error.message, 'system');
        }
    }

    // リアルタイム評価表示
    showRealtimeEvaluation(evaluation) {
        const evaluationDiv = document.createElement('div');
        evaluationDiv.className = 'realtime-evaluation';
        
        const scoreColor = evaluation.score >= 8 ? 'var(--accent-green)' : 
                          evaluation.score >= 6 ? 'var(--accent-blue)' : 
                          evaluation.score >= 4 ? 'var(--accent-orange)' : 'var(--accent-red)';
        
        evaluationDiv.innerHTML = `
            <div class="evaluation-header">
                <span class="evaluation-score" style="color: ${scoreColor}; font-weight: bold;">
                    💡 評価: ${evaluation.score}/10点
                </span>
            </div>
            <div class="evaluation-details">
                ${evaluation.keywords.length > 0 ? 
                  `<div class="keywords">🔑 キーワード: ${evaluation.keywords.join(', ')}</div>` : ''}
                ${evaluation.analysis.strengths.length > 0 ? 
                  `<div class="strengths">✅ ${evaluation.analysis.strengths[0]}</div>` : ''}
                ${evaluation.analysis.concerns.length > 0 ? 
                  `<div class="concerns">⚠️ ${evaluation.analysis.concerns[0]}</div>` : ''}
            </div>
        `;
        
        // 3秒後に自動で非表示
        setTimeout(() => {
            evaluationDiv.style.opacity = '0';
            setTimeout(() => {
                if (evaluationDiv.parentNode) {
                    evaluationDiv.parentNode.removeChild(evaluationDiv);
                }
            }, 500);
        }, 3000);
        
        document.getElementById('chatMessages').appendChild(evaluationDiv);
    }

    // 面接リセット
    resetInterview() {
        this.currentSession = null;
        this.currentQuestion = null;
        window.currentSession = null;
        
        document.getElementById('nameInputArea').style.display = 'flex';
        document.getElementById('responseArea').style.display = 'none';
        document.getElementById('chatMessages').innerHTML = '';
        document.getElementById('candidateName').value = '';
        document.getElementById('responseInput').value = '';
        
        updateStatus('面接を開始してください');
        updateProgress(0, 0);
        stopTimer();
        
        if (window.videoController) {
            window.videoController.changeState('idle');
        }
    }

    // 面接状態を取得
    getInterviewState() {
        return {
            sessionId: this.currentSession?.sessionId,
            candidateName: this.currentSession?.candidateName,
            currentQuestion: this.currentSession?.currentQuestion,
            isActive: !!this.currentSession
        };
    }

    // 面接完了処理
    async completeInterview() {
        if (this.currentSession) {
            try {
                // 面接完了の処理
                await window.videoController.changeState('idle');
                updateStatus('面接が完了しました');
                
                // 録画停止
                if (window.recordingController) {
                    await window.recordingController.stopRecording();
                }
                
                // タイマー停止
                stopTimer();
                
                console.log('面接が正常に完了しました');
            } catch (error) {
                console.error('面接完了処理エラー:', error);
            }
        }
    }
}

// グローバル関数
async function startInterview() {
    if (!window.interviewSystem) {
        window.interviewSystem = new InterviewSystem();
    }
    await window.interviewSystem.startInterview();
}

async function submitResponse() {
    if (window.interviewSystem) {
        await window.interviewSystem.submitResponse();
    }
}

function resetInterview() {
    if (window.interviewSystem) {
        window.interviewSystem.resetInterview();
    }
} 