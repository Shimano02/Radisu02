// ビデオ制御クラス - AI面接システム

class VideoController {
    constructor(ui) {
        this.ui = ui;
        this.currentState = 'idle';
        this.isTransitioning = false;
        this.isPlaying = false;
        
        this.setupVideoEventListeners();
    }

    setupVideoEventListeners() {
        if (this.ui.elements.interviewerVideo) {
            this.ui.elements.interviewerVideo.addEventListener('loadeddata', () => {
                console.log('Dadishのアバター動画が読み込まれました');
            });
            
            this.ui.elements.interviewerVideo.addEventListener('error', (e) => {
                console.error('動画読み込みエラー:', e);
                this.ui.showError('AIアバターの動画の読み込みに失敗しました。');
            });
            
            this.ui.elements.interviewerVideo.addEventListener('ended', () => {
                if (this.currentState !== 'idle') {
                    this.ui.elements.interviewerVideo.play();
                }
            });
        }
    }

    async changeState(newState) {
        if (this.isTransitioning || this.currentState === newState) return;
        this.isTransitioning = true;
        try {
            const { interviewerContainer, interviewerVideo, interviewerImage } = this.ui.elements;
            interviewerContainer.classList.remove('dadish-speaking', 'dadish-listening', 'dadish-thinking');

            switch (newState) {
                case 'speaking':
                    interviewerContainer.classList.add('dadish-speaking');
                    interviewerVideo.style.display = 'block';
                    interviewerImage.style.display = 'none';
                    await this.playVideo();
                    break;
                case 'listening':
                    interviewerContainer.classList.add('dadish-listening');
                    interviewerVideo.style.display = 'block';
                    interviewerImage.style.display = 'none';
                    await this.playVideo();
                    break;
                case 'thinking':
                    interviewerContainer.classList.add('dadish-thinking');
                    interviewerVideo.style.display = 'block';
                    interviewerImage.style.display = 'none';
                    await this.playVideo();
                    break;
                case 'idle':
                    interviewerVideo.style.display = 'none';
                    interviewerImage.style.display = 'block';
                    await this.pauseVideo();
                    break;
            }
            this.currentState = newState;
            console.log(`Dadishの状態が ${newState} に変更されました`);
        } catch (error) {
            console.error('Video transition failed:', error);
        } finally {
            this.isTransitioning = false;
        }
    }

    async playVideo() {
        if (this.ui.elements.interviewerVideo && !this.isPlaying) {
            try {
                await this.ui.elements.interviewerVideo.play();
                this.isPlaying = true;
            } catch (error) {
                console.error('動画再生エラー:', error);
            }
        }
    }

    async pauseVideo() {
        if (this.ui.elements.interviewerVideo && this.isPlaying) {
            this.ui.elements.interviewerVideo.pause();
            this.isPlaying = false;
        }
    }

    setVideoStream(stream) {
        const { candidateVideo, cameraPlaceholder, candidateCamera, candidateMic } = this.ui.elements;
        if (stream) {
            candidateVideo.srcObject = stream;
            candidateVideo.style.display = 'block';
            cameraPlaceholder.style.display = 'none';
            candidateCamera.innerHTML = '<i class="fas fa-video"></i><span>カメラON</span>';
            candidateCamera.className = 'participant-control active';
            candidateMic.innerHTML = '<i class="fas fa-microphone"></i><span>ミュート解除</span>';
            candidateMic.className = 'participant-control active';
        } else {
            candidateVideo.style.display = 'none';
            cameraPlaceholder.style.display = 'flex';
            candidateCamera.innerHTML = '<i class="fas fa-video-slash"></i><span>カメラOFF</span>';
            candidateCamera.className = 'participant-control';
            candidateMic.innerHTML = '<i class="fas fa-microphone-slash"></i><span>ミュート</span>';
            candidateMic.className = 'participant-control muted';
        }
    }

    getVideoState() {
        return {
            currentState: this.currentState,
            isPlaying: this.isPlaying
        };
    }
}
export default VideoController;
