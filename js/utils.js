// ユーティリティ関数 - AI面接システム

// 遅延関数
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 日時フォーマット
export function formatDateTime(date) {
    return date.toISOString().replace(/[:.]/g, '-');
}

// ファイルサイズフォーマット
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 録画時間フォーマット
export function formatRecordingTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}
