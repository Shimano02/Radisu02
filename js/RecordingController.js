// 録画制御クラス - AI面接システム

class RecordingController {
    constructor(ui, apiConnector) {
        this.ui = ui;
        this.apiConnector = apiConnector;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.currentState = 'stopped';
        this.stream = null;
    }

    async startRecording() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            app.videoController.setVideoStream(this.stream);

            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: 'video/webm;codecs=vp9,opus'
            });

            this.recordedChunks = [];

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
            this.ui.updateRecordingUI(this.currentState);

            if (app.interviewSystem.isInterviewActive()) {
                await this.apiConnector.sendRequest('recordingControl', { status: 'start', sessionId: app.interviewSystem.getInterviewState().sessionId });
            }

            console.log('録画を開始しました');
        } catch (error) {
            console.error('録画開始エラー:', error);
            this.ui.showError('録画を開始できませんでした: ' + error.message);
        }
    }

    async stopRecording() {
        if (this.mediaRecorder && this.currentState !== 'stopped') {
            this.mediaRecorder.stop();
            this.currentState = 'stopped';
            
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }
            
            this.ui.updateRecordingUI(this.currentState);
            console.log('録画を停止しました');
        }
    }

    async handleRecordingStopped() {
        try {
            if (this.recordedChunks.length > 0 && app.interviewSystem.isInterviewActive()) {
                this.ui.showError('録画データをサーバーに保存中...', 'info');
                
                const blob = new Blob(this.recordedChunks, {
                    type: 'video/webm'
                });
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `interview_${app.interviewSystem.getInterviewState().sessionId}_${timestamp}.webm`;
                
                const result = await this.apiConnector.uploadRecording(
                    app.interviewSystem.getInterviewState().sessionId, 
                    blob, 
                    filename
                );
                
                await this.apiConnector.sendRequest('recordingControl', { status: 'stop', sessionId: app.interviewSystem.getInterviewState().sessionId });
                
                this.ui.showError('録画データの保存が完了しました', 'success');
                
                setTimeout(() => {
                    this.ui.hideError();
                }, 5000);
                
                console.log('録画データが正常に保存されました:', result);
            }
        } catch (error) {
            console.error('録画データの保存に失敗しました:', error);
            this.ui.showError('録画データの保存に失敗しました: ' + error.message);
        }
    }

    getRecordingState() {
        return {
            currentState: this.currentState
        };
    }
}

export default RecordingController;
