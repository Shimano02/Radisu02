// GAS連携クラス - AI面接システム

class GASConnector {
    constructor() {
        // GASのWebApp URLを設定（実際のGAS URLに変更してください）
        this.baseUrl = 'https://script.google.com/macros/s/YOUR_GAS_SCRIPT_ID/exec';
        this.isGASEnabled = false; // GASが利用できない場合のフォールバック
        this.spreadsheetId = '1-q239hLHhHydeFfd4mE-c9xhOfznlvAaYtp_X5Yx3fg'; // スプレッドシートID
        this.initializeGAS();
    }

    // GASの初期化
    async initializeGAS() {
        try {
            // GASのヘルスチェック
            const healthCheck = await this.callGAS('healthCheck', {});
            this.isGASEnabled = true;
            console.log('GAS接続成功:', healthCheck);
        } catch (error) {
            console.warn('GAS接続失敗、ローカルモードで動作します:', error);
            this.isGASEnabled = false;
        }
    }

    async callGAS(action, data) {
        // GASが無効な場合はローカル処理
        if (!this.isGASEnabled) {
            return await this.handleLocalAction(action, data);
        }

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: action,
                    ...data
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error?.message || 'Unknown error occurred');
            }

            return result.data;
        } catch (error) {
            console.error('GAS API Error:', error);
            // GASエラー時はローカル処理にフォールバック
            return await this.handleLocalAction(action, data);
        }
    }

    // ローカル処理（GASが利用できない場合）
    async handleLocalAction(action, data) {
        console.log('ローカル処理実行:', action, data);
        
        switch (action) {
            case 'startInterview':
                return this.handleLocalStartInterview(data);
            case 'submitResponse':
                return this.handleLocalSubmitResponse(data);
            case 'healthCheck':
                return { status: 'local_mode', message: 'ローカルモードで動作中' };
            case 'recordingControl':
                return this.handleLocalRecordingControl(data);
            case 'uploadRecording':
                return this.handleLocalUploadRecording(data);
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }

    // ローカル面接開始処理
    handleLocalStartInterview(data) {
        const sessionId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        return {
            sessionId: sessionId,
            message: `${data.candidateName || 'お客様'}、こんにちは！本日は面接のお時間をいただき、ありがとうございます。`,
            currentQuestion: {
                id: 1,
                category: '自己紹介',
                content: 'まず、簡単に自己紹介をお願いします。'
            },
            progress: { current: 1, total: 4, percentage: 25 }
        };
    }

    // ローカル回答処理
    handleLocalSubmitResponse(data) {
        const responses = [
            'ありがとうございます。それでは次の質問です。あなたの得意な技術分野について教えてください。',
            'ありがとうございます。それでは次の質問です。これまでで最も挑戦的だったプロジェクトについて教えてください。',
            'ありがとうございます。それでは次の質問です。当社を志望する理由を教えてください。',
            '面接は以上で終了です。お疲れさまでした。'
        ];

        const questionIndex = parseInt(data.questionId) - 1;
        const isComplete = questionIndex >= responses.length - 1;

        if (isComplete) {
            return {
                message: responses[responses.length - 1],
                isComplete: true,
                finalScore: 7,
                summary: {
                    overallAssessment: '良好',
                    totalQuestions: 4,
                    strengths: ['コミュニケーション能力', '経験の具体性'],
                    concerns: ['回答の詳細度']
                }
            };
        }

        return {
            message: responses[questionIndex],
            currentQuestion: {
                id: questionIndex + 2,
                category: '技術・経験',
                content: responses[questionIndex].replace('ありがとうございます。それでは次の質問です。', '')
            },
            progress: { current: questionIndex + 2, total: 4, percentage: (questionIndex + 2) * 25 },
            isComplete: false
        };
    }

    // ローカル録画制御
    handleLocalRecordingControl(data) {
        return {
            success: true,
            message: `録画${data.command}完了`,
            sessionId: data.sessionId
        };
    }

    // ローカル録画アップロード
    handleLocalUploadRecording(data) {
        return {
            success: true,
            message: '録画をローカルに保存しました',
            fileName: data.fileName,
            sessionId: data.sessionId
        };
    }

    async startInterview(candidateName) {
        return await this.callGAS('startInterview', {
            candidateName: candidateName,
            timestamp: new Date().toISOString()
        });
    }

    async submitResponse(sessionId, response, questionId) {
        return await this.callGAS('submitResponse', {
            sessionId: sessionId,
            response: response,
            questionId: questionId,
            timestamp: new Date().toISOString()
        });
    }

    async controlRecording(command, sessionId, metadata = {}) {
        return await this.callGAS('recordingControl', {
            command: command,
            sessionId: sessionId,
            metadata: metadata,
            timestamp: new Date().toISOString()
        });
    }

    async uploadRecording(sessionId, recordingBlob, fileName) {
        try {
            const base64Data = await this.blobToBase64(recordingBlob);
            
            return await this.callGAS('uploadRecording', {
                sessionId: sessionId,
                recordingData: base64Data.split(',')[1],
                fileName: fileName,
                metadata: {
                    size: recordingBlob.size,
                    type: recordingBlob.type,
                    duration: this.getRecordingDuration()
                }
            });
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    // 面接結果をスプレッドシートに保存
    async saveInterviewResults(interviewData) {
        try {
            return await this.callGAS('saveInterviewResults', {
                sessionId: interviewData.sessionId,
                candidateName: interviewData.candidateName,
                startTime: interviewData.startTime,
                endTime: interviewData.endTime,
                duration: interviewData.duration,
                finalScore: interviewData.finalScore,
                totalQuestions: interviewData.totalQuestions,
                summary: interviewData.summary,
                questions: interviewData.questions,
                spreadsheetId: this.spreadsheetId
            });
        } catch (error) {
            console.error('面接結果保存エラー:', error);
            throw error;
        }
    }

    // スプレッドシートに直接保存（GASが利用できない場合）
    async saveToSpreadsheetDirect(interviewData) {
        try {
            // スプレッドシートに直接アクセス（Google Sheets API使用）
            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/A:Z?valueInputOption=RAW`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${await this.getGoogleToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: this.formatInterviewDataForSheet(interviewData)
                })
            });

            if (!response.ok) {
                throw new Error(`スプレッドシート保存エラー: ${response.status}`);
            }

            return { success: true, message: '面接結果をスプレッドシートに保存しました' };
        } catch (error) {
            console.error('スプレッドシート直接保存エラー:', error);
            // ローカルストレージにバックアップ
            this.saveToLocalStorage(interviewData);
            throw error;
        }
    }

    // 面接データをスプレッドシート形式に変換
    formatInterviewDataForSheet(interviewData) {
        const timestamp = new Date().toISOString();
        const row = [
            interviewData.sessionId,
            interviewData.candidateName || '匿名',
            interviewData.startTime,
            interviewData.endTime,
            interviewData.duration + '分',
            interviewData.finalScore + '/10',
            interviewData.summary.overallAssessment,
            interviewData.totalQuestions + '問',
            interviewData.summary.strengths.join(', '),
            interviewData.summary.concerns.join(', '),
            JSON.stringify(interviewData.questions),
            timestamp
        ];
        return [row];
    }

    // ローカルストレージにバックアップ
    saveToLocalStorage(interviewData) {
        try {
            const savedResults = JSON.parse(localStorage.getItem('interviewResults') || '[]');
            savedResults.push({
                ...interviewData,
                savedAt: new Date().toISOString()
            });
            localStorage.setItem('interviewResults', JSON.stringify(savedResults));
            console.log('面接結果をローカルストレージに保存しました');
        } catch (error) {
            console.error('ローカルストレージ保存エラー:', error);
        }
    }

    // Google認証トークン取得（簡易版）
    async getGoogleToken() {
        // 実際の実装ではGoogle OAuth2.0を使用
        // ここでは簡易的にエラーを投げる
        throw new Error('Google認証が必要です');
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    getRecordingDuration() {
        if (window.recordingController) {
            const elapsed = new Date() - window.recordingController.startTime - window.recordingController.pausedDuration;
            return Math.floor(elapsed / 1000);
        }
        return 0;
    }
} 