# AI面接システム

Discord風のダークテーマUIを採用した、AI面接官との対話形式面接システムです。

## 機能

### 主要機能
- **AI面接官**: 「Dadish」という名前のAI面接官が質問を投げかけ
- **録画機能**: 面接の録画・一時停止・再開・停止の完全制御
- **リアルタイム対話**: テキスト入力による回答とAI面接官の応答
- **ビデオ機能**: デュアルビデオパネル（AI面接官Dadish・面接者）
- **自動保存**: 録画データのサーバー自動アップロード

### 面接フロー
1. 自己紹介
2. 得意な技術分野
3. 最も挑戦的だったプロジェクト
4. 志望理由
5. 質問（面接者から）

## ファイル構成

```
Develope/
├── index.html              # メインHTMLファイル
├── css/
│   ├── main.css           # メインスタイル
│   ├── components.css     # コンポーネントスタイル
│   └── animations.css     # アニメーション効果
├── js/
│   ├── main.js           # メインスクリプト
│   ├── InterviewSystem.js # 面接システム
│   ├── RecordingController.js # 録画制御
│   ├── VideoController.js # ビデオ制御
│   ├── GASConnector.js   # GAS連携
│   └── utils.js          # ユーティリティ関数
└── assets/
    └── placeholder-video.mp4 # プレースホルダービデオ
```

## セットアップ

### 前提条件
- モダンブラウザ（Chrome, Firefox, Safari, Edge）
- HTTPS環境（カメラ・マイクアクセス用）
- Google Apps Script（GAS）の設定

### インストール手順

1. **ファイルの配置**
   ```bash
   # プロジェクトファイルをWebサーバーに配置
   cp -r Develope/ /path/to/web/server/
   ```

2. **GAS設定**
   - Google Apps ScriptでバックエンドAPIを作成
   - 必要なエンドポイントを実装：
     - `startInterview`: 面接開始
     - `submitResponse`: 回答送信
     - `recordingControl`: 録画制御
     - `uploadRecording`: 録画アップロード

3. **ブラウザでアクセス**
   ```
   https://your-domain.com/index.html
   ```

## 使用方法

### 面接開始
1. ブラウザでアプリケーションにアクセス
2. 名前を入力（任意）
3. 「面接開始」ボタンをクリック
4. カメラ・マイクの許可を承認

### 録画機能
- **録画開始**: 赤い丸ボタンをクリック
- **一時停止**: 一時停止ボタンをクリック
- **再開**: 再生ボタンをクリック
- **停止**: 停止ボタンをクリック

### 回答入力
- テキストエリアに回答を入力
- Enterキーまたは「送信」ボタンで送信

## 技術仕様

### フロントエンド
- **HTML5**: セマンティックなマークアップ
- **CSS3**: モダンなスタイリングとアニメーション
- **JavaScript ES6+**: クラスベースのアーキテクチャ
- **MediaRecorder API**: 録画機能
- **WebRTC**: カメラ・マイクアクセス

### 主要クラス
- `InterviewSystem`: メインシステム制御
- `RecordingController`: 録画機能制御
- `VideoController`: ビデオ状態管理
- `GASConnector`: バックエンド連携

### 状態管理
- 録画状態: `recording` / `paused` / `stopped`
- AI面接官状態: `speaking` / `listening` / `thinking` / `idle`
- 面接進行: 質問1〜5の段階的進行

## 開発者向け情報

### デバッグ機能
ブラウザのコンソールで以下の関数が利用可能：

```javascript
// システム状態の確認
debugSystem();

// システムのリセット
resetSystem();

// システム状態の取得
checkSystemStatus();
```

### カスタマイズ
- **質問内容**: `InterviewSystem.js`で質問フローを変更
- **UIテーマ**: `css/main.css`のCSS変数を変更
- **アニメーション**: `css/animations.css`でエフェクトを調整

## トラブルシューティング

### よくある問題

1. **カメラ・マイクが動作しない**
   - HTTPS環境でアクセスしているか確認
   - ブラウザの権限設定を確認

2. **録画が開始できない**
   - ブラウザがMediaRecorder APIをサポートしているか確認
   - カメラ・マイクの権限が許可されているか確認

3. **GAS連携エラー**
   - GASの設定が正しいか確認
   - ネットワーク接続を確認

### ログ確認
ブラウザの開発者ツールでコンソールログを確認：
```javascript
// 詳細なログを表示
localStorage.setItem('debug', 'true');
```

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 貢献

バグ報告や機能要望は、GitHubのIssuesでお知らせください。

## 更新履歴

### v1.0.0
- 初期リリース
- 基本的な面接機能
- 録画機能
- GAS連携 