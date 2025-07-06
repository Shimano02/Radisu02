// ビデオ制御クラス - AI面接システム

class VideoController {
    constructor() {
        this.interviewerVideo = document.getElementById('interviewerVideo');
        this.currentState = 'idle';
        this.isTransitioning = false;
        this.isPlaying = false;
        this.videoSource = 'assets/Avatar.mp4';
        
        // ビデオイベントリスナーの設定
        this.setupVideoEventListeners();
    }

    setupVideoEventListeners() {
        if (this.interviewerVideo) {
            this.interviewerVideo.addEventListener('loadeddata', () => {
                console.log('Dadishのアバター動画が読み込まれました');
            });
            
            this.interviewerVideo.addEventListener('error', (e) => {
                console.error('動画読み込みエラー:', e);
                this.showErrorState();
            });
            
            this.interviewerVideo.addEventListener('ended', () => {
                // ループ再生のため、自動的に再開
                if (this.currentState !== 'idle') {
                    this.interviewerVideo.play();
                }
            });
        }
    }

    async changeState(newState) {
        if (this.isTransitioning || this.currentState === newState) return;
        this.isTransitioning = true;
        try {
            const container = document.getElementById('interviewerContainer');
            this.clearEffects(container);
            const video = document.getElementById('interviewerVideo');
            const image = document.getElementById('interviewerImage');
            // 状態に応じたエフェクト追加と動画・画像切り替え
            switch (newState) {
                case 'speaking':
                    container.classList.add('dadish-speaking');
                    if (video) video.style.display = 'block';
                    if (image) image.style.display = 'none';
                    await this.playVideo();
                    break;
                case 'listening':
                    container.classList.add('dadish-listening');
                    if (video) video.style.display = 'block';
                    if (image) image.style.display = 'none';
                    await this.playVideo();
                    break;
                case 'thinking':
                    container.classList.add('dadish-thinking');
                    if (video) video.style.display = 'block';
                    if (image) image.style.display = 'none';
                    await this.playVideo();
                    break;
                case 'idle':
                    if (video) video.style.display = 'none';
                    if (image) image.style.display = 'block';
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
        if (this.interviewerVideo && !this.isPlaying) {
            try {
                await this.interviewerVideo.play();
                this.isPlaying = true;
                console.log('Dadishの動画再生開始');
            } catch (error) {
                console.error('動画再生エラー:', error);
            }
        }
    }

    async pauseVideo() {
        if (this.interviewerVideo && this.isPlaying) {
            try {
                this.interviewerVideo.pause();
                this.isPlaying = false;
                console.log('Dadishの動画一時停止');
            } catch (error) {
                console.error('動画停止エラー:', error);
            }
        }
    }

    clearEffects(container) {
        container.classList.remove('speaking-glow', 'listening-pulse', 'thinking-shimmer', 'dadish-speaking', 'dadish-listening', 'dadish-thinking');
    }

    // カメラ接続状態の更新
    updateCameraStatus(isActive) {
        const candidateCamera = document.getElementById('candidateCamera');
        const candidateMic = document.getElementById('candidateMic');
        
        if (isActive) {
            candidateCamera.innerHTML = '<i class="fas fa-video"></i><span>カメラON</span>';
            candidateCamera.className = 'participant-control active';
            candidateMic.innerHTML = '<i class="fas fa-microphone"></i><span>ミュート解除</span>';
            candidateMic.className = 'participant-control active';
        } else {
            candidateCamera.innerHTML = '<i class="fas fa-video-slash"></i><span>カメラOFF</span>';
            candidateCamera.className = 'participant-control';
            candidateMic.innerHTML = '<i class="fas fa-microphone-slash"></i><span>ミュート</span>';
            candidateMic.className = 'participant-control muted';
        }
    }

    // ビデオ要素の表示/非表示切り替え
    toggleVideoDisplay(show) {
        const candidateVideo = document.getElementById('candidateVideo');
        const cameraPlaceholder = document.getElementById('cameraPlaceholder');
        
        if (show) {
            candidateVideo.style.display = 'block';
            cameraPlaceholder.style.display = 'none';
        } else {
            candidateVideo.style.display = 'none';
            cameraPlaceholder.style.display = 'flex';
        }
    }

    // ビデオストリームの設定
    setVideoStream(stream) {
        const candidateVideo = document.getElementById('candidateVideo');
        if (stream) {
            candidateVideo.srcObject = stream;
            this.toggleVideoDisplay(true);
            this.updateCameraStatus(true);
        } else {
            this.toggleVideoDisplay(false);
            this.updateCameraStatus(false);
        }
    }

    // エラー状態の表示
    showErrorState() {
        const container = document.getElementById('interviewerContainer');
        container.classList.add('error-shake');
        setTimeout(() => {
            container.classList.remove('error-shake');
        }, 500);
    }

    // 成功状態の表示
    showSuccessState() {
        const container = document.getElementById('interviewerContainer');
        container.classList.add('success-bounce');
        setTimeout(() => {
            container.classList.remove('success-bounce');
        }, 600);
    }

    // 動画の状態を取得
    getVideoState() {
        return {
            currentState: this.currentState,
            isPlaying: this.isPlaying,
            videoSource: this.videoSource
        };
    }

    // 動画の再読み込み
    async reloadVideo() {
        if (this.interviewerVideo) {
            this.interviewerVideo.load();
            console.log('Dadishの動画を再読み込みしました');
        }
    }
} 