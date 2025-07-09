// ================================
// JavaScript全体コード (再設計版 + 修正版)
// ================================

// グローバル変数
let conversationId = "";        // 会話ID
let isAudioInitialized = false; // 音声再生初期化フラグ(未使用例)
let mediaRecorder;              // MediaRecorderインスタンス
let autoCalibrated = false;
let calibrationStartTs = 0;
let lastNonSilenceTime = 0;
let audioChunks = [];           // 録音データ格納
let lastBotResponse = "";       // 最新のBot返答
let historyList;                // 会話履歴表示用の<ul>参照
let isProcessingHistory = false;  // 履歴取得中フラグ
let historyRetryCount = 0;      // 履歴取得リトライカウント
const MAX_HISTORY_RETRIES = 3;  // 最大リトライ回数
let isProcessingInput = false;  // 送信処理中フラグ（重複送信防止）
let tokenRefreshTimer = null;   // ログインセッション維持用タイマー
let unauthorizedKeydownHandler = null;
let sidebarEl = null;
let currentAudio = null;

// ドラッグ&ドロップ用変数
let dragCounter = 0;            // ドラッグイベントカウンター
let dropZoneOverlay = null;     // ドロップゾーンオーバーレイ要素

// チャット添付ファイル管理
let attachedFiles = [];         // 添付されたファイルの配列
let chatDragCounter = 0;        // チャット用ドラッグカウンター
let lastAttachedFileInfo = null; // 最後に添付されたファイル情報（会話継続用）

// リトライ制御用変数の追加
let isRetrying = false;
let retryBackoff = [1000, 2000, 4000, 8000]; // バックオフ時間 (ミリ秒)
let failedRequestCache = new Map(); // 失敗したリクエストの一時キャッシュ

const MAX_RETRY        = 2;
let logoutAlertShown   = false;

const API_BASE    = "https://sirusiru-tunagu-proxy.tsuji-090.workers.dev";
const TOKEN_KEY   = "accessToken";
const REFRESH_KEY = "refreshToken";
const MEDIA_API_BASE = "https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/media/";

const PRODUCT_CHAT  = "chat";
const PRODUCT_IMAGE = "image";
const FEATURE_SUGGESTED_QUESTIONS = false;

/* ―――― 会話タイトル用ミニメニュー共有関数 ―――― */
let activeConvMenu = null;           // 開いているメニューを退避
function closeConvMenu(){
  if(activeConvMenu){
    activeConvMenu.remove();
    activeConvMenu = null;
    document.removeEventListener("click", closeConvMenu);
  }
}


// 簡易的なインメモリキャッシュ
const apiCache = {
  data: new Map(),
  ttl: new Map(),
  
  // キャッシュにデータを設定（ttlはミリ秒単位）
  set(key, data, ttl = 60000) {
    this.data.set(key, data);
    this.ttl.set(key, Date.now() + ttl);
  },
  
  // キャッシュからデータを取得
  get(key) {
    if (!this.data.has(key)) return null;
    if (Date.now() > this.ttl.get(key)) {
      // 期限切れならキャッシュ削除
      this.data.delete(key);
      this.ttl.delete(key);
      return null;
    }
    return this.data.get(key);
  },
  
  // キャッシュをクリア
  clear(key) {
    if (key) {
      this.data.delete(key);
      this.ttl.delete(key);
    } else {
      this.data.clear();
      this.ttl.clear();
    }
  }
};

// 無音検出用(必要なら再度追加)
let audioContext;
let analyser;
let source;
let silenceDetectionTimer;
let silenceThreshold = 0;    // 無音判定しきい値
let silenceDuration = 3000;   // 3秒続いたら停止（少し長めに）
let minRecordingDuration = 1000; // 最低録音時間（1秒）

// 送信ボタン、録音ボタン
const sendButton = document.getElementById("send-button");
const recordButton = document.getElementById("record-button");

// 音声認識の状態管理
let recordingState = 'idle'; // 'idle', 'starting', 'recording', 'stopping', 'processing'
let recordingStartTime = 0;


// ================================
// 1.5) PDFからテキスト抽出（新機能追加）
// ================================

// pdf.js を動的に読み込む関数
function loadPDFjsLib() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Tesseract.js を動的に読み込む関数
function loadTesseractJS() {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * PDFファイル（application/pdf）から、1ページ目を画像化しTesseract.jsでOCR処理を実行してテキストを抽出する
 * @param {File} file - PDFファイル
 * @returns {Promise<string>} - 抽出されたテキスト（失敗時は空文字列）
 */
async function extractTextFromPDF(file) {
  try {
    // ファイルがPDFか確認
    if (file.type !== "application/pdf") return "";
    // ファイルをDataURLとして読み込み
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    // pdf.js を読み込む
    await loadPDFjsLib();
    const loadingTask = window.pdfjsLib.getDocument(dataUrl);
    const pdfDoc = await loadingTask.promise;
    // 1ページ目を取得
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 }); // 拡大して精度向上
    // オフスクリーンCanvas作成
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    const renderContext = { canvasContext: context, viewport: viewport };
    await page.render(renderContext).promise;
    // Canvasから画像データURLを取得
    const imageDataUrl = canvas.toDataURL("image/png");
    // Tesseract.js を読み込む
    await loadTesseractJS();
    const worker = await Tesseract.createWorker();
    await worker.load();
    await worker.loadLanguage("jpn");
    await worker.initialize("jpn");
    const { data: { text } } = await worker.recognize(imageDataUrl);
    await worker.terminate();
    return text;
  } catch (error) {
    console.error("PDF OCR抽出エラー:", error);
    return "";
  }
}

/**
 * 会話タイトルを変更する
 * @param {string} convId  - conversation_id
 * @param {string} newName - 新しい名称
 */
async function renameConversation(convId, newName){
  const userEmail = localStorage.getItem("userEmail") || "anonymous";
  const url = `https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/conversations/${convId}/name`;
  const resp = await apiFetch(url, {
    method : "POST",
    headers: { "Content-Type":"application/json" },
    body   : JSON.stringify({ name:newName, user:userEmail })
  });

  if(!resp.ok){
    const txt = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${txt}`);
  }
  // 成功したら必要に応じて resp.json() で updated_at など取得可
  apiCache.clear(`history-${convId}`);
}

/**
 * 会話を削除する
 * @param {string} convId
 */
async function deleteConversation(convId){
  const userEmail = localStorage.getItem("userEmail") || "anonymous";
  const url = `https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/conversations/${convId}`;
  const resp = await apiFetch(url, {
    method : "DELETE",
    headers: { "Content-Type":"application/json" },
    body   : JSON.stringify({ user: userEmail }),
    timeout: 10000
  });
  if(!resp.ok){
    const txt = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${txt}`);
  }
  apiCache.clear(`history-${convId}`);
}



// ================================
// 1) 入力欄の有効/無効制御
// ================================
function disableUserInput() {
  const inputField = document.getElementById("user-input");
  if (inputField) {
    inputField.disabled = true;
  }
}

function enableUserInput() {
  const inputField = document.getElementById("user-input");
  if (inputField) {
    inputField.disabled = false;
  }
}


// ================================
// 2) 入力された内容を処理
// ================================
async function processInput(inputText, audioFile, uploadedFileId = null) {
  try {
    // 既に処理中なら何もしない（重複送信防止）
    if (isProcessingInput) return;
    
    // 処理中フラグをON
    isProcessingInput = true;
    
    // 送信中の重複防止
    disableUserInput();

    let userInput = inputText;

    // 音声ファイル → テキスト認識
    if (audioFile) {
      updateSystemMessage("🎤 音声を解析しています...");
      const textFromAudio = await uploadAudio(audioFile);
      if (textFromAudio && textFromAudio.trim()) {
        userInput = textFromAudio.trim();
        updateSystemMessage(`🎤 音声認識完了: "${userInput}"`);
        
        // 1秒後にメッセージを削除して送信
        setTimeout(() => {
          removeSpecificSystemMessage(`🎤 音声認識完了: "${userInput}"`);
        }, 1000);
      } else {
        throw new Error("音声が認識できませんでした。もう一度はっきりと話してください。");
      }
    }

    if (!userInput) {
      addMessage("入力が空です。もう一度お試しください。", "system");
      return;
    }

    // ファイルアップロードのIDがある場合
    let filesParam = [];
    if (uploadedFileId) {
      filesParam.push({
        type: "document",
        transfer_method: "local_file",
        upload_file_id: uploadedFileId
      });
    }

    // メッセージ送信
    await sendMessage(userInput, filesParam);
    // const newBalance = await consumeTokens(1); // 一時的に無効化

  } catch (err) {
    console.error("Error in processInput:", err);
    addMessage("エラーが発生しました。もう一度試してください。", "system");
  } finally {
    // 入力欄クリア & 有効化
    const inputField = document.getElementById("user-input");
    if (inputField) {
      inputField.value = "";
      enableUserInput();
    }
    // 処理中フラグをOFF
    isProcessingInput = false;
  }
}


// ================================
// 3) メッセージを送信
// ================================
async function sendMessage(userInput, files = []) {
  let resp; // 変数を関数スコープで宣言
  try {
    startLoadingState();

    if (userInput) {
      addMessage(userInput, "user");
    }

    const userEmail = localStorage.getItem("userEmail") || "anonymous";
    
    // 添付ファイルがある場合、アップロード済みのファイルを使用
    let chatFiles = files;
    if (attachedFiles.length > 0) {
      // ファイル情報を順次処理するためのPromise配列を作成
      const filePromises = attachedFiles
        .filter(fileItem => fileItem.status === 'uploaded' && fileItem.uploadFileId)
        .map(async (fileItem) => {
          if (fileItem.uploadResult && fileItem.uploadResult.is_temp) {
            // Base64エンコードされたファイルの場合
            const fileType = fileItem.uploadResult.file_type || "image";
            const isImage = fileItem.uploadResult.is_image || fileType === "image";
            
            console.log("Base64ファイルを送信:", {
              name: fileItem.name,
              type: fileType,
              isImage,
              base64Length: fileItem.uploadResult.base64_data?.length
            });
            
            // Base64データをそのまま使用（fileToBase64は既にdata:URLを返す）
            let dataUrl = fileItem.uploadResult.base64_data;
            
            // 画像ファイルはlocal_fileを優先、フォールバックでremote_url
            if (fileType === "image") {
              // まずlocal_file方式でアップロードを試行
              try {
                const formData = new FormData();
                formData.append('file', fileItem.file);
                formData.append('user', userEmail);
                
                const response = await apiFetch("https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/files/upload", {
                  method: "POST",
                  body: formData
                });
                
                if (response.ok) {
                  const uploadData = await response.json();
                  console.log("画像ファイルのlocal_fileアップロード成功:", uploadData);
                  return {
                    type: fileType,
                    transfer_method: "local_file",
                    upload_file_id: uploadData.id
                  };
                } else {
                  console.warn("画像ファイルのlocal_fileアップロード失敗:", response.status);
                }
              } catch (error) {
                console.warn("画像ファイルのlocal_fileアップロードエラー:", error);
              }
              
              // フォールバックでremote_url使用（小さな画像のみ）
              if (fileItem.file.size < 1024 * 1024) { // 1MB未満
                console.log("小さな画像のremote_urlフォールバック");
                return {
                  type: fileType,
                  transfer_method: "remote_url",
                  url: dataUrl
                };
              } else {
                // 大きな画像はエラーとして処理
                throw new Error(`画像ファイルのアップロードに失敗しました。ファイルサイズを小さくしてお試しください。`);
              }
            } else {
              // 非画像ファイルはlocal_fileで送信
              return {
                type: fileType,
                transfer_method: "local_file",
                upload_file_id: fileItem.uploadFileId
              };
            }
          } else if (fileItem.uploadResult && !fileItem.uploadResult.is_temp) {
            // 正常にアップロードされた非画像ファイルの場合
            const fileType = fileItem.uploadResult.file_type || getFileTypeForDify(fileItem.file);
            console.log("非画像ファイルをlocal_file形式で送信:", {
              name: fileItem.name,
              type: fileType,
              upload_file_id: fileItem.uploadFileId
            });
            return {
              type: fileType,
              transfer_method: "local_file",
              upload_file_id: fileItem.uploadFileId
            };
          } else if (fileItem.uploadFileId) {
            // フォールバック: uploadFileIdが存在する場合
            const fileType = getFileTypeForDify(fileItem.file);
            return {
              type: fileType,
              transfer_method: "local_file",
              upload_file_id: fileItem.uploadFileId
            };
          }
          return null;
        });
      
      // すべてのファイル処理を待つ
      const processedFiles = await Promise.all(filePromises);
      chatFiles = processedFiles.filter(file => file !== null); // nullを除外
    }

    // デバッグ用ログ
    if (chatFiles && chatFiles.length > 0) {
      console.log("Dify APIに送信するファイル情報:", JSON.stringify(chatFiles, null, 2));
    }

    const requestBody = {
      query: userInput,
      user: userEmail,
      inputs: {},
      response_mode: "blocking",
      conversation_id: conversationId,
      auto_generate_name: true
    };
    
    // ファイルがある場合のみ追加
    if (chatFiles && chatFiles.length > 0) {
      requestBody.files = chatFiles;
    }
    
    console.log("Dify APIリクエストボディ:", JSON.stringify(requestBody, null, 2));
    console.log("現在の会話ID:", conversationId);
    
    resp = await apiFetch("https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/chat-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    /* ====== エラーハンドリング強化 (400 → Overloaded も検知) ====== */
    if (!resp.ok) {
      const bodyText = await resp.text();
      console.error("Chat API Error:", bodyText);
  
      /* デフォルト文言 */
      let userMsg = `サーバーエラー (${resp.status})。少し待って再試行してください。`;
      
      // デバッグ情報をコンソールに出力
      console.error("Dify APIエラー詳細:", {
        status: resp.status,
        statusText: resp.statusText,
        url: resp.url,
        bodyText: bodyText.substring(0, 500), // 最初の500文字のみ
        hasFiles: chatFiles && chatFiles.length > 0,
        fileCount: chatFiles ? chatFiles.length : 0
      });
  
      /* JSON なら詳細を解析 */
      try {
        const j = JSON.parse(bodyText);          // {"error":"{...json...}"}
        const inner = typeof j.error === "string" ? JSON.parse(j.error) : j.error;
        const msg   = inner?.message || inner;
  
        /* モデル過負荷系 */
        if (/overloaded|ServiceUnavailable|Server\s+Unavailable|503/i.test(msg)) {
          userMsg = "現在モデルが混雑しています。数十秒待ってから再度お試しください。";
        } 
        /* ファイル関連エラー */
        else if (/Reached maximum retries.*for URL data:/i.test(msg)) {
          // 添付ファイルを自動削除
          if (attachedFiles.length > 0) {
            console.log("Reached maximum retriesエラーにより添付ファイルを自動削除");
            attachedFiles.length = 0;
            updateAttachedFilesDisplay();
          }
          userMsg = "添付されたファイルの処理でエラーが発生したため、ファイルを削除しました。\n\nファイルサイズが大きすぎるか、ファイル形式が対応していない可能性があります。\n\n同じメッセージをファイルなしで再送信してください。";
        }
        else if (/invalid_param/i.test(msg)) {
          
          if (/file/i.test(msg) || /URL data:/i.test(msg)) {
            // 添付ファイルを自動削除
            if (attachedFiles.length > 0) {
              console.log("invalid_paramエラーにより添付ファイルを自動削除");
              attachedFiles.length = 0; // ファイル配列をクリア
              updateAttachedFilesDisplay(); // 表示を更新
            }
            userMsg = "添付ファイルでエラーが発生したため、ファイルを削除しました。\n\n同じメッセージをファイルなしで再送信してください。";
          } else {
            userMsg = "リクエストのパラメータに問題があります。\n\n添付ファイルがある場合は、ファイルを外してメッセージを送信してください。";
          }
        }
        else if (/PluginInvokeError|PluginDaemonInnerError/i.test(msg)) {
          // 添付ファイルを自動削除
          if (attachedFiles.length > 0) {
            console.log("PluginInvokeErrorにより添付ファイルを自動削除");
            attachedFiles.length = 0; // ファイル配列をクリア
            updateAttachedFilesDisplay(); // 表示を更新
          }
          // 502エラーの場合の処理
          if (/502 Bad Gateway/i.test(msg)) {
            if (attachedFiles.length > 0) {
              userMsg = "サーバーの一時的な問題で添付ファイルが処理できませんでした。\n\nファイルを削除しました。再度ファイルを添付してお試しください。";
            } else {
              userMsg = "サーバーの一時的な問題が発生しています。\n\nしばらく時間をおいてから再度お試しください。";
            }
          } else {
            userMsg = "添付ファイルでAI処理エラーが発生したため、ファイルを削除しました。\n\n同じメッセージをファイルなしで再送信してください。\n\n（非画像ファイルは現在AI処理に対応していません）";
          }
        }
        else if (/google.*error/i.test(msg)) {
          userMsg = "AIモデルの処理でエラーが発生しました。\n\nしばらく時間をおいてから再度お試しください。";
        }
        else if (/invalid character.*looking for beginning of value/i.test(msg)) {
          userMsg = "Difyアプリの設定に問題があります。\n\nDifyアプリのシステムプロンプトが正しく設定されているか確認してください。";
        }
        else if (typeof msg === "string") {
          userMsg = msg;                          // 他のメッセージをそのまま表示
        }
      } catch (_) {/* ignore */}
  
      addMessage(userMsg, "system");              // システム吹き出しでユーザーに通知
      
      // ファイルエラーまたは特定エラーの場合は入力欄を復元（再送信用）
      if (/PluginInvokeError|PluginDaemonInnerError|invalid_param|URL data:|invalid character/i.test(bodyText)) {
        const inputField = document.getElementById("user-input");
        if (inputField && userInput) {
          inputField.value = userInput; // 元のメッセージを復元
          console.log("エラーのため入力メッセージを復元:", userInput);
        }
      }
      
      return;                                     // 送信処理を終了
    }

    // ──────────────────────────
    // ? text/event-stream 対応
    // ──────────────────────────
    const contentType = resp.headers.get("Content-Type") || "";
    let data;
    if (contentType.includes("text/event-stream")) {
      data = await parseEventStream(resp); // ★追加（関数は下に実装）
    } else {
      data = await resp.json();            // 従来どおり JSON も許可
    }
    // 会話ID更新とデバッグ
    const oldConversationId = conversationId;
    conversationId = data.conversation_id || conversationId || "";
    
    console.log("会話ID管理:", {
      oldConversationId,
      newConversationId: conversationId,
      dataConversationId: data.conversation_id,
      hasMemory: !!conversationId
    });
    
    const botResponse =
          data.outputs?.answer           // ← workflow_finished 用
       ?? data.data?.outputs?.answer     // ← SSE で data:{...} の場合
       ?? data.answer                    // ← message / answer イベント
       ?? data.data?.answer              // ← data:{answer:"..."} の場合
       ?? "No response received";
    lastBotResponse = botResponse;

    addMessage(botResponse, "bot");
    
    // ファイル添付時の情報を保存（会話継続用）
    if (chatFiles && chatFiles.length > 0) {
      lastAttachedFileInfo = {
        files: chatFiles,
        timestamp: Date.now(),
        conversationId: conversationId
      };
      console.log("ファイル情報を保存:", lastAttachedFileInfo);
    }

    // 引用ありの場合
    if (data.metadata?.retriever_resources?.length) {
      data.metadata.retriever_resources.forEach(res => addCitation(res));
    }

    // 質問候補
    if (FEATURE_SUGGESTED_QUESTIONS && data.message_id) {
      await fetchSuggestedQuestions(data.message_id);
    }

    // 会話履歴のキャッシュを更新 - 追加
    if (conversationId) {
      const cacheKey = `history-${conversationId}`;
      apiCache.clear(cacheKey);
      console.log("会話履歴キャッシュをクリア:", cacheKey);
    }
    
    // 会話一覧のキャッシュもクリア（新しい会話が作成された場合）
    if (oldConversationId !== conversationId) {
      apiCache.clear('conversation-list');
      console.log("会話一覧キャッシュをクリア");
    }

  } catch (err) {
    console.error("Error in sendMessage:", err);
    addMessage("エラーが発生しました。もう一度お試しください。", "system");
  } finally {
    endLoadingState();
    // 送信成功時のみ添付ファイルをクリア
    if (resp && resp.ok) {
      attachedFiles = [];
      updateAttachedFilesDisplay();
    }
  }
}

/**
 * SSE( Server-Sent Events ) を JSON に変換
 * @param {Response} resp fetch レスポンス
 * @returns {Promise<Object>} 最終行の JSON
 */
async function parseEventStream(resp) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
  }

  // "data: {...}\n\n" 単位で分割 → 最後の JSON を返す
  const events = buffer.split("\n\n").filter(Boolean);
  const last = events.at(-1).replace(/^data:\s*/, "");
  return JSON.parse(last);
}


// ================================
// 4) 送信ボタンのローディング制御
// ================================
function startLoadingState() {
  if (!sendButton) return;
  sendButton.disabled = true;
  sendButton.classList.add("loading");
  sendButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
}

function endLoadingState() {
  if (!sendButton) return;
  sendButton.disabled = false;
  sendButton.classList.remove("loading");
  sendButton.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
}


// ================================
// 5) ファイルアップロード(ナレッジ登録込み)
// ================================
/**
 * @param {File} file - アップロードしたいファイル
 * @returns {Promise<string>} - ファイルID (Dify 側などで発行されると想定)
 */
async function uploadFileAndRegisterToKnowledge(file) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    
    // PDFの場合、OCRでテキスト抽出を試みる（現在は無効化）
    // Dify側でPDF処理を行うため、クライアント側でのOCR処理は不要
    let extractedText = "";
    // if (file.type === "application/pdf") {
    //   extractedText = await extractTextFromPDF(file);
    // }

    const resp = await apiFetch("https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/files/upload", { 
      method: "POST",
      body: formData
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`HTTP error! status: ${resp.status}, detail: ${errText}`);
    }

    const data = await resp.json();
    console.log("uploadFileAndRegisterToKnowledge response:", data);
    
    // ファイル一覧のキャッシュをクリア
    apiCache.clear('file-list');
    
    // Dify API の応答形式に合わせて、ファイルIDを返す
    return data.id || data;
  } catch (err) {
    console.error("Error uploading & registering knowledge:", err);
    throw err;
  }
}


// ================================
// 6) 引用情報をチャットに追加
// ================================
function addCitation(resource) {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return;

  const botMsgs = chatMessages.querySelectorAll(".message.bot");
  const lastBotMsg = botMsgs[botMsgs.length - 1];

  const citationDiv = document.createElement("div");
  citationDiv.className = "citation";
  citationDiv.textContent = `引用元: ${resource.document_name || "不明なファイル"}`;
  citationDiv.style.cursor = "pointer";

  citationDiv.addEventListener("click", () => {
    showPopup(resource.content || "引用元の内容が取得できません。");
  });

  if (lastBotMsg) {
    lastBotMsg.insertAdjacentElement("afterend", citationDiv);
  } else {
    chatMessages.appendChild(citationDiv);
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;
}


// ================================
// 7) ポップアップを表示
// ================================
function showPopup(content) {
  const popupContainer = document.getElementById("popup-container");
  const popupText = document.getElementById("popup-text");
  const closeBtn = document.getElementById("close-popup");
  if (!popupContainer || !popupText || !closeBtn) {
    console.error("ポップアップ要素が見つかりません。");
    return;
  }

  popupText.textContent = content;
  popupContainer.style.display = "block";

  // クリックで閉じる
  closeBtn.addEventListener("click", () => {
    popupContainer.style.display = "none";
  }, { once: true });
}


// ================================
// 8) 録音開始 (record-button)
// ================================
recordButton.addEventListener("click", async () => {
  // 既に処理中なら何もしない
  if (isProcessingInput) return;

  // 状態に応じて処理を分岐
  switch (recordingState) {
    case 'recording':
      // 録音中なら停止
      stopRecording();
      return;
    case 'starting':
    case 'stopping':
    case 'processing':
      // 処理中は何もしない
      return;
    case 'idle':
    default:
      // 録音開始
      await startRecording();
      return;
  }
});

// 録音開始関数
async function startRecording() {
  recordingState = 'starting';
  startRecordLoadingState();

  try {
    addMessage("🎤 音声認識を準備しています...", "system");

    /* ==== ① デバイス取得：ノイズ抑制付き mono 48 kHz ==== */
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 48000,
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true
      }
    });

    /* ==== ② MediaRecorder を Opus 固定で作成 ==== */
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus"
    });

    /* ==== ③ dataavailable で認識処理 ==== */
    mediaRecorder.ondataavailable = async (e) => {
      if (!(e.data && e.data.size)) return;
      
      recordingState = 'processing';
      
      // 無音タイマー停止
      if (silenceDetectionTimer) {
        clearTimeout(silenceDetectionTimer);
        silenceDetectionTimer = null;
      }

      // UI更新
      recordButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      recordButton.disabled = true;
      
      // システムメッセージを音声認識中に更新
      updateSystemMessage("🎤 音声を認識しています...");
      
      try {
        await processInput("", e.data);   // 音声→テキスト→送信
      } finally {
        recordingState = 'idle';
        recordButton.disabled = false;
        recordButton.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        audioContext?.close();
      }
    };

    /* ==== ④ stop は後片付けのみ ==== */
    mediaRecorder.onstop = () => {
      if (recordingState === 'recording') {
        recordingState = 'stopping';
      }
      
      if (silenceDetectionTimer) {
        clearTimeout(silenceDetectionTimer);
        silenceDetectionTimer = null;
      }
    };

    // 録音開始
    mediaRecorder.start();
    recordingState = 'recording';
    recordingStartTime = Date.now();
    
    recordButton.innerHTML = '<i class="fa-solid fa-stop"></i>';
    recordButton.style.backgroundColor = '#ff4444';
    
    updateSystemMessage("🎤 録音中... 話してください（自動停止または再度クリックで停止）");
    await setupSilenceDetection(stream);

  } catch (err) {
    console.error("Error accessing microphone:", err);
    recordingState = 'idle';
    endRecordLoadingState();
    
    const errorMsg = err.name === "NotAllowedError" 
      ? "マイクアクセスが拒否されました。ブラウザ設定を確認してください。"
      : err.name === "NotFoundError" 
      ? "マイクが検出されませんでした。デバイスを確認してください。"
      : "マイクアクセス中にエラーが発生しました。";
    
    addMessage(`❌ ${errorMsg}`, "system");
  }
}

// 録音停止関数
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    recordingState = 'stopping';
    mediaRecorder.stop();
    
    const recordingDuration = ((Date.now() - recordingStartTime) / 1000).toFixed(1);
    updateSystemMessage(`🎤 録音停止（${recordingDuration}秒）- 音声を処理中...`);
    
    recordButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    recordButton.style.backgroundColor = '';
    recordButton.disabled = true;
  }
}

// ================================
// 9) 録音ボタンのローディング制御
// ================================
// 無音検出のセットアップ関数 - 追加
async function setupSilenceDetection(stream) {
  try {
    // AudioContext の作成
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;              // 256 で問題なければそのまま

    // マイク入力を Analyser に接続
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    // 追加: AudioContext が suspend されていたら再開
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    // ★ 追加: キャリブレーション用の初期化
    autoCalibrated     = false;
    calibrationStartTs = 0;

    lastNonSilenceTime = Date.now();     // タイマー初期化    
    detectSilence();                    // 無音検出ループ開始
  } catch (err) {
    console.error("無音検出のセットアップに失敗:", err);
  }
}

// ================================
// 無音検出ループ（detectSilence）
// ================================
function detectSilence() {
  // 録音が終わっていれば何もしない
  if (!mediaRecorder || mediaRecorder.state !== "recording") return;

  /* === 1. 時間波形を取得して RMS を算出 === */
  const dataArray = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(dataArray);

  let sumSq = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const v = (dataArray[i] - 128) / 128; // -1 ～ 1 に正規化
    sumSq += v * v;
  }
  const rms = Math.sqrt(sumSq / dataArray.length) * 100; // 0～100 目安

  /* === 2. 自動キャリブレーション（開始 1.5 秒間）=== */
  if (!autoCalibrated) {
    if (!calibrationStartTs) calibrationStartTs = Date.now();

    // 1.5 秒間 RMS の最大値を収集
    if (Date.now() - calibrationStartTs < 1500) {
      silenceThreshold = Math.max(silenceThreshold, rms);
    } else {
      // 1.5 秒経過したら 1.5 倍マージンを取って確定
      silenceThreshold = Math.max(3, silenceThreshold * 1.5);
      autoCalibrated = true;
      console.log(`音声レベル自動調整完了: しきい値 ${silenceThreshold.toFixed(2)}`);
    }
  }

  const currentTime = Date.now();
  const recordingElapsed = currentTime - recordingStartTime;

  /* === 3. 無音判定（最低録音時間を過ぎてから） === */
  if (recordingElapsed > minRecordingDuration) {
    if (rms > silenceThreshold) {
      lastNonSilenceTime = currentTime;           // 音あり → タイマーリセット
      
      // 録音中のフィードバック更新（1秒ごと）
      if (Math.floor(recordingElapsed / 1000) !== Math.floor((recordingElapsed - 100) / 1000)) {
        const secondsElapsed = Math.floor(recordingElapsed / 1000);
        updateSystemMessage(`🎤 録音中... ${secondsElapsed}秒経過（話してください）`);
      }
    } else if (currentTime - lastNonSilenceTime > silenceDuration) {
      console.log(`${silenceDuration} ms 無音検出 - 自動録音停止`);
      updateSystemMessage(`🎤 無音を検出しました - 録音を自動停止`);
      stopRecording();
      return;
    }
  }

  /* === 4. 次フレームへ === */
  silenceDetectionTimer = setTimeout(detectSilence, 100); // 100ms間隔で処理を軽く
}

// 録音ボタンのローディング制御
function startRecordLoadingState() {
  if (!recordButton) return;
  recordButton.disabled = false; // 録音中も押せるようにする（停止のため）
  recordButton.classList.add("recording");
}

function endRecordLoadingState() {
  if (!recordButton) return;
  recordButton.disabled = false;
  recordButton.classList.remove("recording");
  recordButton.classList.remove("loading");
  // 元のマイクアイコンに戻す
  recordButton.innerHTML = '<i class="fa-solid fa-microphone"></i>';
}


// ================================
// 10) 録音停止ボタン (stop-button)
// ================================
const stopBtn = document.getElementById("stop-button");
if (stopBtn) {
  stopBtn.addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      // addMessage("録音停止しました。", "system");
    } else {
      // addMessage("録音中ではありません。", "system");
    }
  });
}


// ================================
// 11) 音声読み上げ開始
// ================================
document.getElementById("text-to-audio-button").addEventListener("click", async () => {
  if (!lastBotResponse) {
    addMessage("読み上げる返答がありません。", "system");
    return;
  }
  try {
    await playBotResponse(lastBotResponse);
  } catch (err) {
    console.error("Error in text-to-audio:", err);
    addMessage("読み上げ中にエラーが発生しました。", "system");
  }
});


// ================================
// 12) 音声ファイルを送信しテキスト変換
// ================================
async function uploadAudio(file) {
  try {
    const userEmail = localStorage.getItem("userEmail") || "anonymous";
    const resp = await apiFetch(`${API_BASE}/audio-to-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioContent: await fileToBase64(file),
        user: userEmail
      })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Audio-to-Text API Error:", errText);
      throw new Error(`HTTP error: ${resp.status}`);
    }
    const data = await resp.json();
    if (!data.text) {
      throw new Error("音声認識結果が空です。");
    }
    return data.text;
  } catch (err) {
    console.error("Error in uploadAudio:", err);
    throw err;
  }
}


// ================================
// 13) ファイルをBase64に変換
// ================================
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


// ================================
// 14) チャットボット返答を音声再生
// ================================
async function playBotResponse(text) {
  try {
    /* === ① すでに再生中の音声があれば止める ================= */
    if (currentAudio) {
      currentAudio.pause();            // 停止
      currentAudio.currentTime = 0;    // 冒頭に戻す
      URL.revokeObjectURL(currentAudio.src); // Blob URL開放
      currentAudio = null;
    }

    /* === ② 新しい音声を生成して再生 ========================= */
    const userEmail = localStorage.getItem("userEmail") || "anonymous";
    const resp = await apiFetch(
      `${API_BASE}/text-to-audio`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, user: userEmail })
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Text-to-Audio API Error:", errText);
      throw new Error(`HTTP error: ${resp.status}`);
    }

    const audioBuffer = await resp.arrayBuffer();
    const blob     = new Blob([audioBuffer], { type: "audio/mpeg" });
    const audioUrl = URL.createObjectURL(blob);

    /* Audio インスタンスを作成して再生 */
    const audio = new Audio(audioUrl);
    currentAudio = audio;          // ← 状態を保持
    audio.play();

    /* 再生終了時に後片付け */
    audio.addEventListener("ended", () => {
      URL.revokeObjectURL(audioUrl);
      if (currentAudio === audio) {
        currentAudio = null;
      }
    });
  } catch (err) {
    console.error("Error playing bot response:", err);
    addMessage("返答内容の再生中にエラーが発生しました。", "system");
  }
}

// ================================
// 15) チャットメッセージ表示 (Markdown)
// ================================
function addMessage(text, sender) {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return;

  /* ── 重複ガード ───────────────────────
     直前の .message 要素が
       1) 同じ送信者クラスを持ち
       2) textContent が完全一致
     なら新たなノードを追加しない
  ----------------------------------- */
  const lastNode = chatMessages.lastElementChild;
  if (
    lastNode &&
    lastNode.classList.contains("message") &&
    lastNode.classList.contains(sender) &&
    lastNode.textContent === text
  ) {
    return;
  }

  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${sender}`;

  // bot ⇒ Markdown で整形
  if (sender === "bot") {
    const html = marked.parse(text);
    msgDiv.innerHTML = html;

    const audioBtn = document.createElement("button");
    audioBtn.className = "text-to-audio-btn";
    audioBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    audioBtn.title = "音声で再生";
    audioBtn.addEventListener("click", () => playBotResponse(text));
    msgDiv.appendChild(audioBtn);
  } else {
    msgDiv.textContent = text;
  }

  chatMessages.appendChild(msgDiv);

  // スクロール位置調整
  if (sender === "bot") {
    msgDiv.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });
  } else {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  cleanupChatMessages(); // 古いメッセージを削除
}


// ================================
// 16) チャットメッセージ削除 (メモリ対策)
// ================================
function cleanupChatMessages() {
  const chatMessages = document.getElementById("chat-messages");
  const maxMessages = 100;
  while (chatMessages.childNodes.length > maxMessages) {
    chatMessages.removeChild(chatMessages.firstChild);
  }
}

// システムメッセージを更新する関数
function updateSystemMessage(newText) {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return;
  
  // 最後のシステムメッセージを探す
  const systemMessages = chatMessages.querySelectorAll(".message.system");
  const lastSystemMessage = systemMessages[systemMessages.length - 1];
  
  if (lastSystemMessage) {
    lastSystemMessage.textContent = newText;
  } else {
    // システムメッセージがなければ新規作成
    addMessage(newText, "system");
  }
}

// ================================
// ファイル重複チェック関数
// ================================
async function checkFileDuplication(file) {
  try {
    let fileList = null;
    const cacheKey = 'file-list';
    const cachedData = apiCache.get(cacheKey);
    
    if (cachedData) {
      fileList = cachedData;
    } else {
      const response = await apiFetch("https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/files/list", { method: "GET" });
      if (response.ok) {
        fileList = await response.json();
        apiCache.set(cacheKey, fileList, 5 * 60 * 1000); // 5分間キャッシュ
      }
    }
    
    if (!fileList || !fileList.data || !Array.isArray(fileList.data)) {
      return { duplicateExists: false, similarFiles: [] };
    }
    
    let duplicateExists = false;
    let similarFiles = [];
    
    // ファイル名から拡張子を除いた部分を取得する関数
    const getFileNameWithoutExtension = (filename) => {
      const lastDotIndex = filename.lastIndexOf('.');
      return lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename;
    };
    
    fileList.data.forEach(doc => {
      if (doc.name) {
        const docNameBase = getFileNameWithoutExtension(doc.name).toLowerCase();
        const fileNameBase = getFileNameWithoutExtension(file.name).toLowerCase();
        
        if (doc.name === file.name) {
          duplicateExists = true;
        } else if (
          docNameBase.includes(fileNameBase) || 
          fileNameBase.includes(docNameBase) ||
          (docNameBase.length > 3 && fileNameBase.length > 3 && 
           docNameBase.substring(0, 3) === fileNameBase.substring(0, 3))
        ) {
          similarFiles.push(doc.name);
        }
      }
    });
    
    return { duplicateExists, similarFiles };
    
  } catch (err) {
    console.error("ファイル重複チェック中にエラー:", err);
    return { duplicateExists: false, similarFiles: [] };
  }
}

// ================================
// ドラッグ&ドロップ機能
// ================================

// ドロップゾーンオーバーレイを作成
function createDropZoneOverlay() {
  if (dropZoneOverlay) return dropZoneOverlay;
  
  dropZoneOverlay = document.createElement('div');
  dropZoneOverlay.id = 'drop-zone-overlay';
  dropZoneOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 123, 255, 0.1);
    border: 3px dashed #007bff;
    z-index: 10000;
    display: none;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(2px);
    font-size: 24px;
    color: #007bff;
    font-weight: bold;
    text-align: center;
    pointer-events: none;
  `;
  
  dropZoneOverlay.innerHTML = `
    <div style="background: rgba(255,255,255,0.9); padding: 40px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
      <i class="fa-solid fa-cloud-arrow-up" style="font-size: 48px; margin-bottom: 20px; display: block;"></i>
      ファイルをここにドロップしてアップロード<br>
      <small style="font-size: 16px; color: #666;">対応形式: PDF, TXT, DOCX, XLSX, PNG, JPG など</small>
    </div>
  `;
  
  document.body.appendChild(dropZoneOverlay);
  return dropZoneOverlay;
}

// ドロップゾーンを表示
function showDropZone() {
  const overlay = createDropZoneOverlay();
  overlay.style.display = 'flex';
}

// ドロップゾーンを非表示
function hideDropZone() {
  if (dropZoneOverlay) {
    dropZoneOverlay.style.display = 'none';
  }
}

// ファイルサイズとタイプのチェック
function validateDroppedFile(file) {
  const maxSizeInBytes = 15 * 1024 * 1024; // 15MB
  const allowedTypes = [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp'
  ];
  
  // ファイルサイズチェック
  if (file.size > maxSizeInBytes) {
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `ファイルサイズが大きすぎます。\n現在のサイズ: ${fileSizeMB}MB\n最大サイズ: 15MB`
    };
  }
  
  // ファイルタイプチェック - より柔軟な判定
  const fileExtension = file.name.split('.').pop().toLowerCase();
  const allowedExtensions = ['pdf', 'txt', 'docx', 'xlsx', 'xls', 'png', 'jpg', 'jpeg', 'gif', 'webp'];
  
  if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
    return {
      valid: false,
      error: `サポートされていないファイル形式です。\n対応形式: PDF, TXT, DOCX, XLSX, PNG, JPG など\nファイルタイプ: ${file.type || '不明'}`
    };
  }
  
  return { valid: true };
}

// ドロップされたファイルを処理
async function handleDroppedFile(file) {
  try {
    // ログイン状態チェック
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      addMessage("❌ ファイルアップロードにはログインが必要です", "system");
      showLoginModal();
      return;
    }
    
    // ファイルの検証
    const validation = validateDroppedFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    
    // ファイル情報を表示
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    addMessage(`📎 ファイルをドロップしました: ${file.name} (${fileSizeMB}MB)`, "system");
    
    // 重複チェック
    addMessage("📋 既存ファイルをチェック中...", "system");
    const { duplicateExists, similarFiles } = await checkFileDuplication(file);
    
    if (duplicateExists) {
      if (!confirm(`同じ名前のファイル「${file.name}」が既に存在します。\n上書きしますか？`)) {
        addMessage("❌ アップロードをキャンセルしました", "system");
        return;
      }
    }
    
    if (similarFiles.length > 0) {
      const similarList = similarFiles.slice(0, 5).join("\n• ");
      const message = `似た名前のファイルが見つかりました:\n• ${similarList}${similarFiles.length > 5 ? `\n他${similarFiles.length - 5}件` : ''}\n\n内容がバッティングしていないかご確認ください。続行しますか？`;
      
      if (!confirm(message)) {
        addMessage("❌ アップロードをキャンセルしました", "system");
        return;
      }
    }
    
    // アップロード処理
    addMessage("📤 ファイルをアップロード中...", "system");
    const result = await uploadFileAndRegisterToKnowledge(file);
    
    addMessage("✅ ファイルアップロード完了", "system");
    
    // ファイル一覧のキャッシュをクリア
    apiCache.clear('file-list');
    
  } catch (error) {
    console.error("Dropped file upload error:", error);
    addMessage("❌ ファイルアップロード中にエラーが発生しました", "system");
    
    // エラーの種類に応じて分かりやすいメッセージを表示
    let errorMessage = "ファイルアップロード中にエラーが発生しました。";
    
    // Cloudflareブロックエラーのチェック
    if (error.message.includes("Cloudflare") || error.message.includes("blocked")) {
      errorMessage = "セキュリティチェックによりアップロードがブロックされました。\n時間をおいて再度お試しください。";
    } else if (error.message.includes("413") || error.message.includes("file_too_large")) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      errorMessage = `ファイルサイズが大きすぎます。\n現在のサイズ: ${fileSizeMB}MB\n最大サイズ: 15MB`;
    } else if (error.message.includes("415") || error.message.includes("unsupported_file_type")) {
      errorMessage = `サポートされていないファイル形式です。\n対応形式: PDF, TXT, DOCX, XLSX, PNG, JPG など`;
    } else if (error.message.includes("403")) {
      errorMessage = `アップロード権限がありません。\n再度ログインしてお試しください。`;
    }
    
    alert(errorMessage);
  }
}

// ドラッグ&ドロップのセットアップ
function setupDragAndDrop() {
  // ページ全体でのドラッグイベントを監視
  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    
    // ファイルがドラッグされている場合のみ処理
    if (e.dataTransfer.types.includes('Files')) {
      showDropZone();
    }
  });

  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    
    // カウンターが0になったらオーバーレイを非表示
    if (dragCounter === 0) {
      hideDropZone();
    }
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    
    // ファイルがドラッグされている場合のみドロップを許可
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    hideDropZone();
    
    // ファイルが含まれているかチェック
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    
    // 複数ファイルの場合は最初のファイルのみ処理
    if (files.length > 1) {
      addMessage("⚠️ 複数ファイルが検出されました。最初のファイルのみ処理します。", "system");
    }
    
    const file = files[0];
    await handleDroppedFile(file);
  });

  // ページを離れる際の誤ドロップを防ぐ
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  console.log("📎 ドラッグ&ドロップ機能が有効になりました");
}

// ================================
// アップロードモーダル用のドラッグ&ドロップ
// ================================
let modalDragCounter = 0;
let modalDropHandlers = {
  dragenter: null,
  dragleave: null,
  dragover: null,
  drop: null
};

function setupModalDragAndDrop() {
  const uploadModal = document.getElementById("upload-modal");
  const modalContent = uploadModal.querySelector(".modal-content");
  
  if (!modalContent) return;
  
  // モーダルコンテンツのスタイルを調整
  modalContent.style.position = "relative";
  
  // ドラッグオーバー時のスタイル
  const addDragOverStyle = () => {
    modalContent.style.backgroundColor = "#e3f2fd";
    modalContent.style.border = "2px dashed #2196F3";
    modalContent.style.transition = "all 0.3s ease";
  };
  
  const removeDragOverStyle = () => {
    modalContent.style.backgroundColor = "";
    modalContent.style.border = "";
  };
  
  // イベントハンドラを定義
  modalDropHandlers.dragenter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    modalDragCounter++;
    
    if (e.dataTransfer.types.includes('Files')) {
      addDragOverStyle();
    }
  };
  
  modalDropHandlers.dragleave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    modalDragCounter--;
    
    if (modalDragCounter === 0) {
      removeDragOverStyle();
    }
  };
  
  modalDropHandlers.dragover = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  
  modalDropHandlers.drop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    modalDragCounter = 0;
    removeDragOverStyle();
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    
    // 複数ファイルの場合は最初のファイルのみ処理
    if (files.length > 1) {
      alert("複数ファイルが検出されました。最初のファイルのみ選択されます。");
    }
    
    const file = files[0];
    const fileInput = document.getElementById("file-input");
    const fileNameSpan = document.getElementById("file-name");
    
    if (fileInput && fileNameSpan) {
      // ファイルをinputに設定
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
      
      // ファイル名を表示
      fileNameSpan.textContent = file.name;
      
      // changeイベントを手動で発火
      const event = new Event('change', { bubbles: true });
      fileInput.dispatchEvent(event);
    }
  };
  
  // イベントリスナーを追加
  modalContent.addEventListener('dragenter', modalDropHandlers.dragenter);
  modalContent.addEventListener('dragleave', modalDropHandlers.dragleave);
  modalContent.addEventListener('dragover', modalDropHandlers.dragover);
  modalContent.addEventListener('drop', modalDropHandlers.drop);
  
  console.log("📎 モーダル用ドラッグ&ドロップが有効になりました");
}

function removeModalDragAndDrop() {
  const uploadModal = document.getElementById("upload-modal");
  const modalContent = uploadModal.querySelector(".modal-content");
  
  if (!modalContent) return;
  
  // イベントリスナーを削除
  if (modalDropHandlers.dragenter) {
    modalContent.removeEventListener('dragenter', modalDropHandlers.dragenter);
  }
  if (modalDropHandlers.dragleave) {
    modalContent.removeEventListener('dragleave', modalDropHandlers.dragleave);
  }
  if (modalDropHandlers.dragover) {
    modalContent.removeEventListener('dragover', modalDropHandlers.dragover);
  }
  if (modalDropHandlers.drop) {
    modalContent.removeEventListener('drop', modalDropHandlers.drop);
  }
  
  // スタイルをリセット
  modalContent.style.backgroundColor = "";
  modalContent.style.border = "";
  modalDragCounter = 0;
  
  console.log("📎 モーダル用ドラッグ&ドロップが無効になりました");
}

// ================================
// チャット画面用のドラッグ&ドロップ（ファイル添付）
// ================================
function setupChatDragAndDrop() {
  const chatContainer = document.querySelector('main');
  
  if (!chatContainer) return;
  
  // ドラッグエンター
  chatContainer.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    chatDragCounter++;
    
    if (e.dataTransfer.types.includes('Files')) {
      showChatDropZone();
    }
  });
  
  // ドラッグリーブ
  chatContainer.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    chatDragCounter--;
    
    if (chatDragCounter === 0) {
      hideChatDropZone();
    }
  });
  
  // ドラッグオーバー
  chatContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
    }
  });
  
  // ドロップ
  chatContainer.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    chatDragCounter = 0;
    hideChatDropZone();
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    
    // 複数ファイルの場合は最初のファイルのみ処理
    if (files.length > 1) {
      addMessage("⚠️ 複数ファイルが検出されました。最初のファイルのみ添付されます。", "system");
    }
    
    // 既に添付されているファイルがある場合は制限
    if (attachedFiles.length > 0) {
      addMessage("⚠️ 既に添付ファイルがあります。現在のファイルを削除してから新しいファイルを添付してください。", "system");
      return;
    }
    
    const file = files[0];
    await handleChatFileAttachment(file);
  });
  
  console.log("📎 チャット用ドラッグ&ドロップが有効になりました");
}

// チャット用ドロップゾーンの表示/非表示
function showChatDropZone() {
  if (!dropZoneOverlay) {
    dropZoneOverlay = createChatDropZoneOverlay();
  }
  dropZoneOverlay.style.display = 'flex';
}

function hideChatDropZone() {
  if (dropZoneOverlay) {
    dropZoneOverlay.style.display = 'none';
  }
}

function createChatDropZoneOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'chat-drop-zone-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(76, 175, 80, 0.1);
    border: 3px dashed #4CAF50;
    z-index: 10000;
    display: none;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(2px);
    font-size: 24px;
    color: #4CAF50;
    font-weight: bold;
    text-align: center;
    pointer-events: none;
  `;
  
  overlay.innerHTML = `
    <div style="background: rgba(255,255,255,0.95); padding: 40px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
      <i class="fa-solid fa-paperclip" style="font-size: 48px; margin-bottom: 20px; display: block;"></i>
      ファイルをここにドロップして添付<br>
      <small style="font-size: 16px; color: #666;">対応形式: PDF, DOCX, 画像, 音声, 動画など</small>
    </div>
  `;
  
  document.body.appendChild(overlay);
  return overlay;
}

// ================================
// ファイル添付処理
// ================================

// ファイル添付のメイン処理
async function handleChatFileAttachment(file) {
  try {
    // ファイルバリデーション
    const validation = validateChatFile(file);
    if (!validation.valid) {
      addMessage(`❌ ${validation.error}`, "system");
      return;
    }
    
    // 添付ファイル配列に追加（アップロード前）
    const fileItem = {
      id: Date.now() + Math.random(),
      file: file,
      name: file.name,
      size: file.size,
      type: getFileType(file),
      status: 'uploading',
      uploadFileId: null
    };
    
    attachedFiles.push(fileItem);
    updateAttachedFilesDisplay();
    
    // ファイルをDify APIにアップロード
    try {
      const uploadResult = await uploadFileToDify(file);
      fileItem.uploadFileId = uploadResult.id;
      fileItem.uploadResult = uploadResult;
      fileItem.status = 'uploaded';
      updateAttachedFilesDisplay();
      
      if (uploadResult.is_temp) {
        // Base64エンコードされたファイル
        if (uploadResult.file_type === 'image') {
          addMessage(`✅ 画像ファイル「${file.name}」を添付しました`, "system");
        } else if (uploadResult.is_base64_fallback) {
          addMessage(`⚠️ ファイル「${file.name}」を簡易的な方法で添付しました。大きなファイルの場合は正常に処理されない可能性があります。`, "system");
        } else {
          addMessage(`✅ ファイル「${file.name}」を添付しました（試験的機能）`, "system");
        }
      } else {
        // 正常にDify APIにアップロードされたファイル
        const fileTypeText = uploadResult.file_type === 'image' ? '画像' : 
                           uploadResult.file_type === 'document' ? 'ドキュメント' :
                           uploadResult.file_type === 'audio' ? '音声' :
                           uploadResult.file_type === 'video' ? '動画' : 'ファイル';
        addMessage(`✅ ${fileTypeText}「${file.name}」を添付しました`, "system");
      }
    } catch (uploadError) {
      console.error("ファイルアップロードエラー:", uploadError);
      fileItem.status = 'error';
      updateAttachedFilesDisplay();
      
      // エラーメッセージを分かりやすく表示
      let errorMessage = uploadError.message;
      if (errorMessage.includes("ファイルのアップロードができませんでした")) {
        addMessage(`❌ ファイル「${file.name}」のアップロードができませんでした。\n\nしばらく時間をおいてからお試しください。`, "system");
      } else if (errorMessage.includes("サイズが大きすぎます")) {
        addMessage(`❌ ${errorMessage}`, "system");
      } else {
        addMessage(`❌ ファイル「${file.name}」のアップロードでエラーが発生しました。\n\nファイルサイズやファイル形式をご確認ください。`, "system");
      }
    }
    
  } catch (error) {
    console.error("ファイル添付処理エラー:", error);
    addMessage("❌ ファイルの添付中にエラーが発生しました。しばらく時間をおいてからお試しください。", "system");
  }
}

// ファイルバリデーション
// ファイル検証関数（全ファイルタイプ対応）
function validateChatFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  const fileType = getFileTypeForDify(file);
  
  // ファイルタイプ別のサイズ制限と対応形式チェック
  let maxSize;
  let supportedExtensions;
  
  switch (fileType) {
    case 'image':
      maxSize = 5 * 1024 * 1024; // 5MB（Base64エンコード時のサイズ制限を考慮）
      supportedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
      break;
    case 'document':
      maxSize = 10 * 1024 * 1024; // 10MB（AI処理の安定性を考慮）
      supportedExtensions = ['txt', 'md', 'mdx', 'markdown', 'pdf', 'html', 'xlsx', 'xls', 'doc', 'docx', 'csv', 'eml', 'msg', 'pptx', 'ppt', 'xml', 'epub'];
      break;
    case 'audio':
      maxSize = 25 * 1024 * 1024; // 25MB（AI処理の安定性を考慮）
      supportedExtensions = ['mp3', 'm4a', 'wav', 'amr', 'mpga'];
      break;
    case 'video':
      maxSize = 50 * 1024 * 1024; // 50MB（AI処理の安定性を考慮）
      supportedExtensions = ['mp4', 'mov', 'mpeg', 'webm'];
      break;
    default:
      return {
        valid: false,
        error: `ファイル「${file.name}」の種類は対応していません。画像、ドキュメント、音声、動画ファイルのみご利用いただけます。`
      };
  }
  
  // ファイルサイズチェック
  if (file.size > maxSize) {
    const currentSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const maxSizeMB = (maxSize / (1024 * 1024));
    return {
      valid: false,
      error: `ファイル「${file.name}」のサイズが大きすぎます。\n\n現在のサイズ: ${currentSizeMB}MB\n最大サイズ: ${maxSizeMB}MB`
    };
  }
  
  // ファイル形式チェック
  if (!supportedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `ファイル「${file.name}」の形式は対応していません。\n\n対応している形式: ${supportedExtensions.join(', ')}`
    };
  }
  
  // MIMEタイプチェック（画像のみ）
  if (fileType === 'image' && !file.type.startsWith('image/')) {
    return {
      valid: false,
      error: `選択されたファイルは画像ファイルではありません。JPG、PNG、GIF、WEBP、SVGファイルをお選びください。`
    };
  }
  
  // 非画像ファイルはWorkersプロキシ経由でアップロードするため、APIキーチェックは不要
  
  return { valid: true };
}

// ファイルタイプ判定
function getFileType(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  
  const documentExts = ['txt', 'md', 'markdown', 'pdf', 'html', 'xlsx', 'xls', 'docx', 'csv', 'eml', 'msg', 'pptx', 'ppt', 'xml', 'epub'];
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const audioExts = ['mp3', 'm4a', 'wav', 'webm', 'amr'];
  const videoExts = ['mp4', 'mov', 'mpeg', 'mpga'];
  
  if (documentExts.includes(extension)) return 'document';
  if (imageExts.includes(extension)) return 'image';
  if (audioExts.includes(extension)) return 'audio';
  if (videoExts.includes(extension)) return 'video';
  
  return 'custom';
}

// Dify API用のファイルタイプを判定する関数（より厳密）
function getFileTypeForDify(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  const mimeType = file.type;
  
  // 画像ファイル - MIMEタイプも確認
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
    return 'image';
  }
  
  // 音声ファイル - MIMEタイプも確認
  if (mimeType.startsWith('audio/') || ['mp3', 'm4a', 'wav', 'webm', 'amr'].includes(extension)) {
    return 'audio';
  }
  
  // 動画ファイル - MIMEタイプも確認
  if (mimeType.startsWith('video/') || ['mp4', 'mov', 'mpeg', 'mpga'].includes(extension)) {
    return 'video';
  }
  
  // ドキュメントファイル - Dify対応形式に限定
  const documentExtensions = ['txt', 'md', 'markdown', 'pdf', 'html', 'xlsx', 'xls', 'docx', 'csv', 'eml', 'msg', 'pptx', 'ppt', 'xml', 'epub'];
  if (documentExtensions.includes(extension)) {
    return 'document';
  }
  
  // その他
  return 'custom';
}

// ファイルアイコン取得
function getFileIcon(type, extension) {
  switch (type) {
    case 'document':
      if (['pdf'].includes(extension)) return 'fa-file-pdf';
      if (['doc', 'docx'].includes(extension)) return 'fa-file-word';
      if (['xls', 'xlsx'].includes(extension)) return 'fa-file-excel';
      if (['ppt', 'pptx'].includes(extension)) return 'fa-file-powerpoint';
      return 'fa-file-text';
    case 'image':
      return 'fa-file-image';
    case 'audio':
      return 'fa-file-audio';
    case 'video':
      return 'fa-file-video';
    default:
      return 'fa-file';
  }
}

// 添付ファイル表示の更新
function updateAttachedFilesDisplay() {
  const area = document.getElementById('attached-files-area');
  const list = document.getElementById('attached-files-list');
  
  if (attachedFiles.length === 0) {
    area.style.display = 'none';
    return;
  }
  
  area.style.display = 'block';
  list.innerHTML = '';
  
  attachedFiles.forEach(fileItem => {
    const item = document.createElement('div');
    item.className = 'attached-file-item';
    
    const extension = fileItem.name.split('.').pop().toLowerCase();
    const icon = getFileIcon(fileItem.type, extension);
    const sizeText = (fileItem.size / 1024).toFixed(1) + ' KB';
    
    let statusHtml = '';
    if (fileItem.status === 'uploading') {
      statusHtml = '<span class="attached-file-status uploading">アップロード中...</span>';
    } else if (fileItem.status === 'uploaded') {
      statusHtml = '<span class="attached-file-status uploaded">準備完了</span>';
    } else if (fileItem.status === 'error') {
      statusHtml = '<span class="attached-file-status error">エラー</span>';
    }
    
    item.innerHTML = `
      <div class="attached-file-icon">
        <i class="fa-solid ${icon}"></i>
      </div>
      <div class="attached-file-info">
        <div class="attached-file-name">${fileItem.name}</div>
        <div class="attached-file-details">${sizeText} • ${fileItem.type} ${statusHtml}</div>
      </div>
      <button class="attached-file-remove" onclick="removeAttachedFile('${fileItem.id}')">
        <i class="fa-solid fa-times"></i>
      </button>
    `;
    
    list.appendChild(item);
  });
}

// 添付ファイルの削除
function removeAttachedFile(fileId) {
  const beforeCount = attachedFiles.length;
  attachedFiles = attachedFiles.filter(file => file.id != fileId);
  const afterCount = attachedFiles.length;
  
  console.log(`ファイル削除: ID=${fileId}, 削除前=${beforeCount}個, 削除後=${afterCount}個`);
  updateAttachedFilesDisplay();
}

// ファイルをBase64に変換
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // data:URLをそのまま返す（例: data:image/png;base64,iVBORw0KGgo...）
      resolve(reader.result);
    };
    reader.onerror = error => reject(error);
  });
}

// Base64フォールバックとしてファイルをアップロード
async function uploadFileAsBase64Fallback(file, fileType, userEmail) {
  console.log("代替手段でファイル処理を開始:", file.name);
  
  // ファイルサイズをチェック（Base64では2MB以下推奨）
  const maxSizeForBase64 = 2 * 1024 * 1024; // 2MB
  if (file.size > maxSizeForBase64) {
    throw new Error(`ファイル「${file.name}」のサイズが大きすぎます（${Math.round(file.size / 1024 / 1024)}MB）。2MB以下のファイルをお試しください。`);
  }
  
  const base64 = await fileToBase64(file);
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: tempId,
    name: file.name,
    size: file.size,
    extension: file.name.split('.').pop().toLowerCase(),
    mime_type: file.type,
    created_by: userEmail,
    created_at: Math.floor(Date.now() / 1000),
    base64_data: base64,
    is_temp: true,
    file_type: fileType,
    is_image: false,
    is_base64_fallback: true
  };
}

// Dify APIへのファイルアップロード（直接APIアクセス版）
async function uploadFileToDify(file) {
  const userEmail = localStorage.getItem("userEmail") || "anonymous";
  const fileType = getFileTypeForDify(file);
  
  console.log("ファイルアップロード開始:", file.name, file.type, fileType);
  
  // 非画像ファイルはDifyの/files/uploadエンドポイントでアップロード
  if (fileType !== 'image') {
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        console.log(`非画像ファイルのアップロード（試行 ${retryCount + 1}/${maxRetries + 1}）:`, file.name);
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user', userEmail);
        
        // リトライ時は少し待機
        if (retryCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
        
        // Difyの正式なファイルアップロードエンドポイントを使用
        const response = await apiFetch("https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/files/upload", {
          method: "POST",
          body: formData
        });
        
        if (response.ok) {
          const uploadData = await response.json();
          console.log("非画像ファイルのアップロード成功:", uploadData);
          
          return {
            id: uploadData.id,
            name: uploadData.name,
            size: uploadData.size,
            extension: uploadData.extension,
            mime_type: uploadData.mime_type,
            created_by: uploadData.created_by,
            created_at: uploadData.created_at,
            is_temp: false,
            file_type: fileType,
            is_image: false,
            upload_data: uploadData
          };
        } else {
          const errorText = await response.text();
          console.warn(`ファイルアップロード失敗（試行 ${retryCount + 1}）:`, response.status, errorText);
          
          if (retryCount < maxRetries) {
            retryCount++;
            continue; // リトライ
          }
          
          throw new Error(`ファイルアップロード失敗: ${response.status}`);
        }
        
      } catch (error) {
        if (retryCount < maxRetries) {
          retryCount++;
          continue; // リトライ
        }
        
        console.error("ファイルアップロードエラー:", error);
        throw new Error(`ファイルのアップロードができませんでした。しばらく時間をおいてからお試しください。`);
      }
    }
  }
  
  // 画像ファイルはDifyの/files/uploadエンドポイントでアップロード
  try {
    const extension = file.name.split('.').pop().toLowerCase();
    
    console.log("画像ファイルのアップロード処理:", file.name);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user', userEmail);
    
    const response = await apiFetch("https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/files/upload", {
      method: "POST",
      body: formData
    });
    
    if (response.ok) {
      const uploadData = await response.json();
      console.log("画像ファイルのアップロード成功:", uploadData);
      
      return {
        id: uploadData.id,
        name: uploadData.name,
        size: uploadData.size,
        extension: uploadData.extension,
        mime_type: uploadData.mime_type,
        created_by: uploadData.created_by,
        created_at: uploadData.created_at,
        is_temp: false,
        file_type: fileType,
        is_image: true,
        upload_data: uploadData
      };
    } else {
      const errorText = await response.text();
      console.error("画像ファイルのアップロード失敗:", response.status, errorText);
      
      // 小さな画像の場合はBase64フォールバックを試行
      if (file.size < 1024 * 1024) { // 1MB未満
        console.log("小さな画像のBase64フォールバックを試行");
        
        const base64 = await fileToBase64(file);
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        return {
          id: tempId,
          name: file.name,
          size: file.size,
          extension: extension,
          mime_type: file.type,
          created_by: userEmail,
          created_at: Math.floor(Date.now() / 1000),
          base64_data: base64,
          is_temp: true,
          file_type: fileType,
          is_image: true
        };
      } else {
        throw new Error(`画像ファイルのアップロードに失敗しました。ファイルサイズを小さくしてお試しください。`);
      }
    }
    
  } catch (error) {
    console.error("画像ファイルの処理エラー:", error);
    throw new Error(`画像ファイルの処理に失敗しました: ${error.message}`);
  }
}


// ================================
// 17) DOM構築後のイベント設定
// ================================
document.addEventListener("DOMContentLoaded", () => {
/* ===== サイドバー開閉トグル ===== */
sidebarEl = document.getElementById("sidebar");
const sidebarToggleBtn = document.getElementById("sidebar-toggle");

/* ── サイドバー開閉トグル ───────────────── */
sidebarToggleBtn.addEventListener('click', () => {
  const isCollapsed = sidebarEl.classList.toggle('collapsed');   // ←★ sidebarEl に変更
  document.body.classList.toggle('sidebar-open', !isCollapsed);
});

if (window.matchMedia("(max-width: 768px)").matches) {
  sidebarEl.classList.add('collapsed');           // ←★ sidebarEl に変更
  document.body.classList.remove('sidebar-open');
}
  updateNavMenu();
  // ログイン状態のチェック - 新規追加
  checkLoginStatus();
  
  // ネットワーク監視を開始 - 新規追加
  setupNetworkMonitoring();

  // チャット画面でのファイル添付ドラッグ&ドロップ機能を初期化
  setupChatDragAndDrop();
  
  // ナビゲーションのトグル
  const menuToggle = document.getElementById("menu-toggle");
  const headerNav = document.getElementById("header-nav");
  if (menuToggle && headerNav) {
    menuToggle.addEventListener("click", () => {
      headerNav.classList.toggle("open");
      console.log("menu-toggle clicked, headerNav classes:", headerNav.className);
      setTimeout(() => {
        console.log("500ms後の headerNav classes:", headerNav.className);
      }, 500);
    });
  }

  // 送信ボタン
  const sendBtn = document.getElementById("send-button");
  if (sendBtn) {
    sendBtn.addEventListener("click", () => {
      // 処理中なら何もしない
      if (isProcessingInput) return;
      
      const userInput = document.getElementById("user-input").value.trim();
      processInput(userInput, null);
    });
  }

  // エンターキー (Shift+Enterで改行)
  const userInputField = document.getElementById("user-input");
  if (userInputField) {
    userInputField.addEventListener("keydown", e => {
      if (e.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        // 処理中なら何もしない
        if (isProcessingInput) return;
        
        const userInput = userInputField.value.trim();
        processInput(userInput, null);
      }
    });
  }

  // ====================================
  // アップロードモーダル関連
  // ====================================
  const openUploadModalButton = document.getElementById("open-upload-modal-button");
  const uploadModal = document.getElementById("upload-modal");
  const closeUploadModalButton = document.getElementById("close-upload-modal");
  const confirmUploadButton = document.getElementById("confirm-upload-button");
  const fileInput = document.getElementById("file-input");

  if (
    openUploadModalButton &&
    uploadModal &&
    closeUploadModalButton &&
    confirmUploadButton &&
    fileInput
  ) {
    // モーダルを開くボタン
    openUploadModalButton.addEventListener("click", () => {
      uploadModal.style.display = "flex";
      setupModalDragAndDrop(); // モーダル用のドラッグ＆ドロップを有効化
    });

    // モーダルを閉じるボタン
    closeUploadModalButton.addEventListener("click", () => {
      uploadModal.style.display = "none";
      fileInput.value = "";
      // ファイル情報表示をクリア
      const fileInfoDiv = document.getElementById("file-info");
      if (fileInfoDiv) fileInfoDiv.textContent = "";
      removeModalDragAndDrop(); // モーダル用のドラッグ＆ドロップを無効化
    });

    // ファイル選択時のイベント
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      const fileInfoDiv = document.getElementById("file-info") || createFileInfoDiv();
      
      if (file) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const maxSizeMB = 15;
        
        let infoText = `ファイル名: ${file.name}\nサイズ: ${fileSizeMB}MB`;
        let warningText = "";
        
        if (file.size > maxSizeMB * 1024 * 1024) {
          warningText = `⚠️ ファイルサイズが制限(${maxSizeMB}MB)を超えています`;
          fileInfoDiv.style.color = "#ff4444";
        } else {
          warningText = `✓ アップロード可能 (制限: ${maxSizeMB}MB)`;
          fileInfoDiv.style.color = "#44aa44";
        }
        
        fileInfoDiv.textContent = `${infoText}\n${warningText}`;
      } else {
        fileInfoDiv.textContent = "";
      }
    });

    // ファイル情報表示要素を作成
    function createFileInfoDiv() {
      let fileInfoDiv = document.getElementById("file-info");
      if (!fileInfoDiv) {
        fileInfoDiv = document.createElement("div");
        fileInfoDiv.id = "file-info";
        fileInfoDiv.style.cssText = "margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px; font-size: 12px; white-space: pre-line;";
        fileInput.parentNode.insertBefore(fileInfoDiv, fileInput.nextSibling);
      }
      return fileInfoDiv;
    }

    // 「アップロード」確定ボタン
    confirmUploadButton.addEventListener("click", async () => {
      const file = fileInput.files[0];
      if (!file) {
        alert("ファイルが選択されていません。");
        return;
      }

      // ファイルサイズチェック（15MB = 15 * 1024 * 1024 bytes）
      const maxSizeInBytes = 15 * 1024 * 1024; // 15MB
      if (file.size > maxSizeInBytes) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        alert(`ファイルサイズが大きすぎます。\n現在のサイズ: ${fileSizeMB}MB\n最大サイズ: 15MB\n\nより小さなファイルを選択してください。`);
        return;
      }

      // 重複チェック
      try {
        const { duplicateExists, similarFiles } = await checkFileDuplication(file);
        
        if (duplicateExists) {
          if (!confirm(`同じ名前のファイル「${file.name}」が既に存在します。\n上書きしますか？`)) {
            // ボタンを元の状態に戻す
            confirmUploadButton.disabled = false;
            confirmUploadButton.innerHTML = originalButtonContent;
            confirmUploadButton.style.cursor = 'pointer';
            return;
          }
        }
        
        if (similarFiles.length > 0) {
          const similarList = similarFiles.slice(0, 5).join("\n• ");
          const message = `似た名前のファイルが見つかりました:\n• ${similarList}${similarFiles.length > 5 ? `\n他${similarFiles.length - 5}件` : ''}\n\n内容がバッティングしていないかご確認ください。続行しますか？`;
          
          if (!confirm(message)) {
            // ボタンを元の状態に戻す
            confirmUploadButton.disabled = false;
            confirmUploadButton.innerHTML = originalButtonContent;
            confirmUploadButton.style.cursor = 'pointer';
            return;
          }
        }
      } catch (err) {
        console.error("ファイル名のチェック中にエラーが発生しました:", err);
      }

      addMessage("ファイルをアップロードしています...", "system");
      
      // アップロードボタンをローディング状態にする
      const originalButtonContent = confirmUploadButton.innerHTML;
      confirmUploadButton.disabled = true;
      confirmUploadButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> アップロード中...';
      confirmUploadButton.style.cursor = 'not-allowed';
      
      try {
        const result = await uploadFileAndRegisterToKnowledge(file);
        addMessage("アップロード完了。", "system");
        alert("アップロードが完了しました。");
        // ファイル一覧のキャッシュをクリア
        apiCache.clear('file-list');
      } catch (err) {
        addMessage("アップロード中にエラーが発生しました。", "system");
        console.error(err);
        
        // エラーの種類に応じて分かりやすいメッセージを表示
        let errorMessage = "アップロード中にエラーが発生しました。";
        
        if (err.message.includes("413") || err.message.includes("file_too_large")) {
          const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
          errorMessage = `ファイルサイズが大きすぎます。\n現在のサイズ: ${fileSizeMB}MB\n最大サイズ: 15MB\n\nファイルを圧縮するか、より小さなファイルを選択してください。`;
        } else if (err.message.includes("415") || err.message.includes("unsupported_file_type")) {
          errorMessage = `サポートされていないファイル形式です。\n対応形式: PDF, TXT, DOCX, XLSX, PNG, JPG など`;
        } else if (err.message.includes("400") || err.message.includes("invalid_param")) {
          errorMessage = `ファイルのパラメータが無効です。\nファイルが破損していないか確認してください。`;
        } else if (err.message.includes("403")) {
          errorMessage = `アップロード権限がありません。\n管理者にお問い合わせください。`;
        } else if (err.message.includes("502") || err.message.includes("503") || err.message.includes("504")) {
          errorMessage = `サーバーエラーが発生しました。\nしばらく待ってから再度お試しください。`;
        }
        
        alert(errorMessage);
      } finally {
        // ボタンを元の状態に戻す
        confirmUploadButton.disabled = false;
        confirmUploadButton.innerHTML = originalButtonContent;
        confirmUploadButton.style.cursor = 'pointer';
        uploadModal.style.display = "none";
        fileInput.value = "";
        removeModalDragAndDrop(); // モーダル用のドラッグ＆ドロップを無効化
      }
    });
  } else {
    console.error("アップロードモーダル関連要素が見つかりません。");
  }

  // 会話履歴モーダル
  historyList = document.getElementById("history-list");
  const historyLink = document.getElementById("history-link");
  const historyModal = document.getElementById("history-modal");
  const closeHistoryModalButton = document.getElementById("close-history-modal");

  if (historyLink && historyModal && closeHistoryModalButton) {
    historyLink.addEventListener("click", async (e) => {
      e.preventDefault();
      historyModal.style.display = "flex";
      await fetchConversationHistory(); // convId未指定 => 「まだ会話がありません」と表示
    });
    closeHistoryModalButton.addEventListener("click", () => {
      historyModal.style.display = "none";
    });
  }

  // 会話一覧、新規会話
  const conversationListRefreshBtn = document.getElementById("conversation-refresh");
  const newConversationBtn = document.getElementById("new-conversation-btn");

  if (conversationListRefreshBtn) {
    conversationListRefreshBtn.addEventListener("click", async () => {
      await fetchConversationList();
    });
  }
  if (newConversationBtn) {
    newConversationBtn.addEventListener("click", async () => {
      await createNewConversation();
      sidebarEl.classList.add("collapsed");
      document.body.classList.remove("sidebar-open");
    });
  }

  // ページアクセス時に会話一覧自動取得
  fetchConversationList();

  /*****************************************************
   * ファイル一覧：モーダル表示
   *****************************************************/
  const fileListLink = document.getElementById("file-list-link");
  const fileListModal = document.getElementById("file-list-modal");
  const fileListUl = document.getElementById("file-list");
  const closeFileListModalButton = document.getElementById("close-file-list-modal");

  if (fileListLink && fileListModal && fileListUl && closeFileListModalButton) {
    fileListLink.addEventListener("click", async () => {
      try {
        fileListUl.innerHTML = "";
        // キャッシュの確認
        const cacheKey = 'file-list';
        const cachedData = apiCache.get(cacheKey);
        
        if (cachedData) {
          displayFileList(cachedData);
        } else {
          const response = await apiFetch("https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/files/list", {
            method: "GET"
          });
          if (!response.ok) {
            const errorText = await response.text();
            console.error("Get File List Error:", errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          // キャッシュに保存（5分間）
          apiCache.set(cacheKey, data, 5 * 60 * 1000);
          displayFileList(data);
        }
        
        fileListModal.style.display = "flex";
      } catch (error) {
        console.error("Error getting file list:", error);
        addMessage("ファイル一覧の取得中にエラーが発生しました。", "system");
      }
    });
    closeFileListModalButton.addEventListener("click", () => {
      fileListModal.style.display = "none";
    });
  }

  // ファイル一覧表示関数
  function displayFileList(data) {
    if (!data.data || data.data.length === 0) {
      fileListUl.innerHTML = "<li>登録されているファイルはありません。</li>";
    } else {
      data.data.forEach(doc => {
        const li = document.createElement("li");
        let dateStr = "";
        if (doc.created_at) {
          const dt = new Date(doc.created_at * 1000);
          dateStr = dt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
        }
        li.textContent = (doc.name || `ドキュメントID: ${doc.id}`) + (dateStr ? " - 登録日: " + dateStr : "");
        li.dataset.docId = doc.id;
        li.addEventListener("click", async function() {
          const clickedDocId = this.dataset.docId;
          await showFileDetail(clickedDocId);
        });
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "×";
        deleteBtn.className = "delete-file-btn";
        deleteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          /* ── 1回目 ─────────────────────── */
          const first = confirm("ファイルを削除しますか？");
          if (!first) return;               // キャンセル → 何もしない

          /* ── 2回目 ─────────────────────── */
          const second = confirm("本当に削除しますか？");
          if (!second) return;              // キャンセル → 何もしない

          /* ── ここまで来たら削除を実行 ─── */
          try {
            const deleteUrl =
              `https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/documents/${doc.id}`;

            const res = await apiFetch(deleteUrl, { method: "DELETE" });
            if (!res.ok) {
              const errText = await res.text();
              throw new Error(errText);
            }

            alert("ファイルが削除されました。");
            li.remove();                    // リストから即時削除
            apiCache.clear("file-list");    // キャッシュもクリア
          } catch (err) {
            console.error("ファイル削除エラー:", err);
            alert("ファイル削除に失敗しました: " + err.message);
          }
        });
        li.appendChild(deleteBtn);
        fileListUl.appendChild(li);
      });
    }
  }

  async function showFileDetail(docId) {
  try {
    if (!docId) {
      alert("ファイル詳細を取得できません: 無効なドキュメントIDです");
      return;
    }
    
    // モーダル関連の要素を取得
    const modal = document.getElementById("file-detail-modal");
    const viewDiv = document.getElementById("file-detail-view");
    const editTextarea = document.getElementById("file-detail-edit");
    const closeBtn = document.getElementById("close-file-detail-modal");
    const toggleEditBtn = document.getElementById("toggle-edit-mode-button");
    const updateFileBtn = document.getElementById("update-file-button");
    
    if (!modal || !viewDiv || !editTextarea || !closeBtn || !toggleEditBtn || !updateFileBtn) {
      alert("ファイル詳細モーダル関連の要素が見つかりません。");
      return;
    }
    
    // 読み込み中の表示
    viewDiv.textContent = "ファイル内容を読み込み中...";
    editTextarea.value = "";
    
    // ドキュメントIDを設定
    modal.setAttribute("data-doc-id", docId);
    
    // モーダルを表示
    modal.style.display = "flex";
    
    // ファイル詳細のキャッシュキー
    const cacheKey = `file-detail-${docId}`;
    const cachedData = apiCache.get(cacheKey);
    
    let contentText = "";
    
    if (cachedData) {
      contentText = cachedData;
    } else {
      // docIdを明確にパラメータとして含むURLを使用
      const detailUrl = `https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/files/detail?docId=${encodeURIComponent(docId)}`;
      
      const res = await apiFetch(detailUrl);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTPエラー! ステータス: ${res.status}`);
      }
      
      const data = await res.json();
      if (!data.data || data.data.length === 0) {
        throw new Error("ドキュメント内容が空です。");
      }
      
      contentText = data.data.map(seg => seg.content).join("\n---\n");
      
      // キャッシュに保存（10分間）
      apiCache.set(cacheKey, contentText, 10 * 60 * 1000);
    }
    
    // コンテンツを表示
    viewDiv.textContent = contentText;
    editTextarea.value = contentText;
    
    // 閉じるボタンのイベントを設定（既存のリスナーを削除して新規作成）
    closeBtn.onclick = null; // 既存のイベントをクリア
    closeBtn.onclick = function() {
      modal.style.display = "none";
    };
    
    // 編集モード切替ボタンを設定
    toggleEditBtn.onclick = null;
    toggleEditBtn.onclick = function() {
      if (viewDiv.style.display === "none") {
        // 閲覧モードに戻す
        viewDiv.style.display = "block";
        editTextarea.style.display = "none";
        this.textContent = "編集モード";
        updateFileBtn.style.display = "none";
      } else {
        // 編集モードにする
        viewDiv.style.display = "none";
        editTextarea.style.display = "block";
        this.textContent = "閲覧モード";
        updateFileBtn.style.display = "inline-block";
      }
    };
    
    // 更新ボタンのイベントを設定
    updateFileBtn.onclick = null;
    updateFileBtn.onclick = async function() {
      const currentDocId = modal.getAttribute("data-doc-id");
      
      const updatedText = editTextarea.value.trim();
      if (!updatedText) {
        alert("内容が空です。");
        return;
      }
      
      // ボタンを無効化
      this.disabled = true;
      const originalText = this.textContent;
      this.textContent = "更新中...";
      
      try {
        const resp = await apiFetch("https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/files/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docId: currentDocId,
            text: updatedText
          })
        });
        
        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`更新エラー: ${resp.status} - ${errText}`);
        }
        
        const responseData = await resp.json();
        
        if (responseData.success) {
          alert("更新が完了しました。");
          // 表示を更新
          viewDiv.textContent = updatedText;
          // 編集モードを終了
          viewDiv.style.display = "block";
          editTextarea.style.display = "none";
          toggleEditBtn.textContent = "編集モード";
          updateFileBtn.style.display = "none";
          
          // キャッシュを更新
          const cacheKey = `file-detail-${currentDocId}`;
          apiCache.set(cacheKey, updatedText, 10 * 60 * 1000);
        } else {
          alert("更新に失敗しました: " + (responseData.message || "不明なエラー"));
        }
      } catch (err) {
        alert("更新中にエラーが発生しました: " + err.message);
      } finally {
        // ボタンを元に戻す
        this.disabled = false;
        this.textContent = originalText;
      }
    };
    
  } catch (error) {
    alert(`ファイル詳細取得中にエラーが発生しました: ${error.message}`);
    
    // エラーが発生した場合はモーダルを閉じる
    const modal = document.getElementById("file-detail-modal");
    if (modal) {
      modal.style.display = "none";
    }
  }
}
});

// ================================
// 18) 会話一覧を取得・表示
// ================================
async function fetchConversationList() {
  try {
    // キャッシュチェック
    const cacheKey = 'conversation-list';
    const cachedData = apiCache.get(cacheKey);
    
    if (cachedData) {
      displayConversationList(cachedData.data || []);
      return;
    }
    
    // ユーザーID取得（メールアドレスをIDとして使用）
    const userEmail = localStorage.getItem("userEmail") || "anonymous";
    
    // 会話一覧を取得
    const resp = await apiFetch(
      `https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/conversation-list?user=${encodeURIComponent(userEmail)}`,
      {
        method: "GET",
        timeout: 10000  // 10秒タイムアウト
      }
    );
    
    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Conversation List Error:", errText);
      
      // エラーの場合でも空の会話一覧を表示
      displayConversationList([]);
      return;
    }
    
    const data = await resp.json();
    
    // キャッシュに保存（1分間）
    apiCache.set(cacheKey, data, 60 * 1000);
    
    // 会話一覧を表示
    displayConversationList(data.data || []);
  } catch (err) {
    console.error("Error fetching conversation list:", err);
    
    // エラーメッセージ表示（システムメッセージとして）
    addMessage("会話一覧の取得中にエラーが発生しました。", "system");
    
    // エラーの場合でも空の会話一覧を表示
    displayConversationList([]);
  }
}

function displayConversationList(conversations) {
  const conversationListUL = document.getElementById("conversation-list");
  if (!conversationListUL) return;

  // リストを空にする
  conversationListUL.innerHTML = "";

  // 会話がない場合
  if (!conversations.length) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "会話がありません";
    emptyItem.className = "empty-conversation";
    conversationListUL.appendChild(emptyItem);
    return;
  }

  // 各会話のリストアイテムを作成
  conversations.forEach(conv => {
    const li = document.createElement("li");
    
    // ── タイトルと 3 点メニューを並べる ──
    const titleSpan = document.createElement("span");
    titleSpan.className = "conv-title";
    titleSpan.textContent = conv.name || "(名称未設定)";

    const menuBtn = document.createElement("button");
    menuBtn.className = "conv-menu-btn";
    menuBtn.innerHTML = "&hellip;";
    /* === 新: GPT 風の小さなメニュー === */
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();          // li クリックを殺す
      e.preventDefault();

      closeConvMenu();              // すでに開いていれば閉じる

      /* ── メニュー DOM を生成 ── */
      const menu = document.createElement("div");
      menu.className = "conv-context-menu";

      const renameBtn = document.createElement("button");
      renameBtn.textContent = "名前を変更";
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "削除";

      menu.append(renameBtn, deleteBtn);
      document.body.appendChild(menu);
      activeConvMenu = menu;

      /* --- 位置調整: ボタンの“すぐ右”に出す（はみ出し補正付き） --- */
      const r = menuBtn.getBoundingClientRect();
      menu.style.top = `${r.bottom + window.scrollY + 4}px`;

      // ボタンの右端＋4px を基準に配置
      let left = r.right + window.scrollX + 4;

      // 右端が画面外に出る場合だけ、画面内に収まるようシフト
      const maxLeft = window.scrollX + window.innerWidth - menu.offsetWidth - 8; // 右から 8px 余白
      if (left > maxLeft) left = maxLeft;

      menu.style.left = `${left}px`;

      /* --- 名前変更 --- */
      renameBtn.addEventListener("click", async () => {
        const current = titleSpan.textContent;
        const newName = prompt("新しい会話タイトル", current);
        if(!newName || newName === current) return closeConvMenu();
        try{
          await renameConversation(conv.id, newName);
          titleSpan.textContent = newName;
          li.dataset.convName   = newName;
          apiCache.clear("conversation-list");
        }catch(err){
          alert("タイトル変更に失敗しました: " + err.message);
        }
        closeConvMenu();
      });

      /* --- 削除 --- */
      deleteBtn.addEventListener("click", async () => {
        if(!confirm("本当にこの会話を削除しますか？※元に戻せません")) return closeConvMenu();
        try{
          await deleteConversation(conv.id);
          li.remove();
          apiCache.clear("conversation-list");
          if(conversationId === conv.id){          // 表示中だったらクリア
            conversationId = "";
            clearChatMessages();
          }
        }catch(err){
          alert("削除に失敗しました: " + err.message);
        }
        closeConvMenu();
      });

      /* 外側クリックで閉じる */
      setTimeout(() => document.addEventListener("click", closeConvMenu), 0);
    });

    li.appendChild(titleSpan);
    li.appendChild(menuBtn);
    
    // データ属性を設定（ID・名前）
    li.dataset.convId = conv.conversation_id || conv.id;
    li.dataset.convName = conv.name || "(名称未設定)";
    
    // 作成日時を表示（あれば）
    if (conv.created_at) {
      const date = new Date(conv.created_at * 1000);
      const formattedDate = date.toLocaleDateString('ja-JP');
      const timeElem = document.createElement("span");
      timeElem.className = "conversation-date";
      timeElem.textContent = formattedDate;
      li.appendChild(timeElem);
    }

    // クリックイベント設定
    li.addEventListener("click", async () => {
      // 既に選択されている場合は何もしない
      if (li.classList.contains("selected")) return;
      
      // 選択状態を更新
      const selected = conversationListUL.querySelector(".selected");
      if (selected) selected.classList.remove("selected");
      li.classList.add("selected");
      
      // 会話IDを設定して履歴取得
      conversationId = conv.id;
      await fetchConversationHistory(conv.id, li.dataset.convName);
      sidebarEl.classList.add("collapsed");
      document.body.classList.remove("sidebar-open");
    });

    // リストに追加
    conversationListUL.appendChild(li);
  });
}


// ================================
// 19) 新規会話作成
// ================================
async function createNewConversation() {
  try {
    // 読み込み中メッセージを表示
    clearChatMessages();
    addMessage("新規会話を作成しています...", "system");
    
    // ユーザーID取得
    const userEmail = localStorage.getItem("userEmail") || "anonymous";
    
    // 新規会話作成API呼び出し
    const resp = await apiFetch("https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/conversations/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: userEmail
      })
    });
    
    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Create New Conversation Error:", errText);
      
      // エラーメッセージを表示
      clearSystemMessages("新規会話を作成しています...");
      addMessage("新規会話の作成中にエラーが発生しました。", "system");
      return;
    }
    
    // 成功した場合
    const data = await resp.json();
    
    // 会話IDを設定
    conversationId = data.id || "";
    
    // 読み込み中メッセージを削除
    clearSystemMessages("新規会話を作成しています...");
    
    // Difyパラメータから開始挨拶を取得して表示
    const difyParams = await fetchDifyParameters();
    
    if (difyParams && difyParams.opening_statement) {
      // ボットからの開始挨拶を表示
      addMessage(difyParams.opening_statement, "bot");
    } else if (data.first_message) {
      // APIレスポンスに最初のメッセージがあれば表示
      addMessage(data.first_message, "bot");
    } else {
      // どちらもない場合のみ、デフォルトメッセージを表示
      addMessage("新規会話を開始しました。メッセージを入力してください。", "system");
    }
    
    // 会話一覧のキャッシュをクリア
    apiCache.clear('conversation-list');
    
    // 会話一覧を再取得
    await fetchConversationList();
    
    // 新しく作成された会話を選択状態にする
    const conversationListUL = document.getElementById("conversation-list");
    if (conversationListUL) {
      const items = conversationListUL.querySelectorAll("li");
      items.forEach(item => {
        if (item.dataset.convId === conversationId) {
          // 選択状態を更新
          const selected = conversationListUL.querySelector(".selected");
          if (selected) selected.classList.remove("selected");
          item.classList.add("selected");
        }
      });
    }
  } catch (err) {
    console.error("Error creating new conversation:", err);
    
    // 読み込み中メッセージを削除
    clearSystemMessages("新規会話を作成しています...");
    
    // エラーメッセージを表示
    addMessage("新規会話の作成中にエラーが発生しました。", "system");
  }
}


// ================================
// 20) 会話履歴を取得しチャット更新
// ================================
async function fetchConversationHistory(convId, convName) {
  // 既に処理中なら何もしない
  if (isProcessingHistory) return;
  isProcessingHistory = true;
  
  try {
    // 会話IDがなければ空表示
    if (!convId) {
      if (historyList) {
        historyList.innerHTML = "<li>会話を選択または新規作成してください</li>";
      }
      clearChatMessages();
      isProcessingHistory = false;
      return;
    }
    
    // キャッシュチェック
    const cacheKey = `history-${convId}`;
    const cachedData = apiCache.get(cacheKey);
    
    if (cachedData) {
      await displayHistoryFromData(cachedData, convName);
      isProcessingHistory = false;
      return;
    }
    
    // 読み込み中メッセージを表示
    clearChatMessages();
    addMessage("会話履歴を読み込み中...", "system");
    
    // ユーザーID取得
    const userEmail = localStorage.getItem("userEmail") || "anonymous";
    
    // 履歴取得API呼び出し
    const resp = await apiFetch(
      `https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/conversation-history?user=${encodeURIComponent(userEmail)}&conversation_id=${convId}`,
      {
        method: "GET",
        timeout: 15000  // 15秒タイムアウト
      }
    );
    
    if (!resp.ok) {
      // エラーメッセージを解析
      let friendlyMessage = "会話履歴の取得に失敗しました。新しいメッセージを送信して会話を継続できます。";
      let shouldRetry = false;
      
      try {
        const errorText = await resp.text();
        console.error("ConversationHistory error:", errorText);
        
        // サーバーエラーの場合
        if (resp.status >= 500) {
          friendlyMessage = "現在サーバーがメンテナンス中か一時的な問題が発生しています。新しいメッセージを送信することで会話を継続できます。";
          shouldRetry = historyRetryCount < MAX_HISTORY_RETRIES;
        }
      } catch (parseErr) {
        console.error("Error parsing error message:", parseErr);
      }
      
      // 読み込み中メッセージを削除（clearSystemMessagesの代わりに）
      removeSpecificSystemMessage("会話履歴を読み込み中...");
      
      // リトライするか決定
      if (shouldRetry) {
        historyRetryCount++;
        addMessage(`会話履歴の取得中にエラーが発生しました。再試行します (${historyRetryCount}/${MAX_HISTORY_RETRIES})...`, "system");
        
        // 1秒後に再試行
        setTimeout(() => {
          isProcessingHistory = false;
          fetchConversationHistory(convId, convName);
        }, 1000);
        return;
      } else {
        // リトライせず、エラーメッセージを表示
        historyRetryCount = 0;
        addMessage(friendlyMessage, "system");
        
        // 空の会話履歴として処理
        displayHistoryFromData({ data: [] }, convName);
        isProcessingHistory = false;
        return;
      }
    }
    
    // 成功した場合
    historyRetryCount = 0;
    const data = await resp.json();
    
    // キャッシュに保存（5分間）
    apiCache.set(cacheKey, data, 5 * 60 * 1000);
    
    // 読み込み中メッセージを削除（clearSystemMessagesの代わりに）
    removeSpecificSystemMessage("会話履歴を読み込み中...");
    
    // 履歴を表示
    await displayHistoryFromData(data, convName);
  } catch (err) {
    console.error("Error fetching conversation history:", err);
    
    // 読み込み中メッセージを削除（clearSystemMessagesの代わりに）
    removeSpecificSystemMessage("会話履歴を読み込み中...");
    
    // エラーメッセージを表示
    let errorMessage = "会話履歴の取得中にエラーが発生しました。";
    
    // タイムアウトエラーの場合
    if (err.name === "TimeoutError" || err.message.includes("timeout")) {
      errorMessage = "サーバーからの応答がありません。しばらくしてからもう一度お試しください。";
    }
    
    addMessage(errorMessage, "system");
    
    // 空の会話履歴として処理
    await displayHistoryFromData({ data: [] }, convName);
  } finally {
    isProcessingHistory = false;
  }
}

// 特定のテキストを持つシステムメッセージを削除する関数
function removeSpecificSystemMessage(text) {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return;
  
  const systemMessages = chatMessages.querySelectorAll(".message.system");
  systemMessages.forEach(msg => {
    if (msg.textContent === text) {
      chatMessages.removeChild(msg);
    }
  });
}

// 履歴データから表示を行う関数
async function displayHistoryFromData(data, convName) {
  // チャットメッセージをクリア
  clearChatMessages();
  
  // データがあれば表示
  if (data.data && data.data.length > 0) {
    data.data.forEach(msg => {
      if (msg.query) addMessage(msg.query, "user");
      if (msg.answer) addMessage(msg.answer, "bot");
    });
  } else {
    // 会話履歴が空の場合、開始挨拶を表示
    const difyParams = await fetchDifyParameters();
    
    if (difyParams && difyParams.opening_statement) {
      addMessage(difyParams.opening_statement, "bot");
    }
  }

  // 会話名を表示
  if (convName) {
    addMessage(`「${convName}」に切り替えました`, "system");
  }
}

// チャットメッセージをクリアする関数
function clearChatMessages() {
  const chatMessages = document.getElementById("chat-messages");
  if (chatMessages) {
    chatMessages.innerHTML = "";
  }
}


// ================================
// 21) フォローアップ(質問候補)取得＆表示
// ================================
async function fetchSuggestedQuestions(messageId) {
  try {
    // キャッシュキー
    const cacheKey = `suggested-${messageId}`;
    const cachedData = apiCache.get(cacheKey);
    
    if (cachedData) {
      displaySuggestedQuestions(cachedData.data || []);
      return;
    }
    
    const userEmail = localStorage.getItem("userEmail") || "anonymous";
    const resp = await apiFetch(`https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/messages/${messageId}/suggested?user=${encodeURIComponent(userEmail)}`);
    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Get Suggested Questions error:", errText);
      return;
    }
    const data = await resp.json();
    
    // 30分間キャッシュ（質問候補は変わりにくいため）
    apiCache.set(cacheKey, data, 30 * 60 * 1000);
    
    displaySuggestedQuestions(data.data || []);
  } catch (err) {
    console.error("Error fetching suggestions:", err);
  }
}

function displaySuggestedQuestions(suggestions) {
  const container = document.getElementById("suggested-questions");
  if (!container) return;

  container.innerHTML = "";

  if (!suggestions.length) {
    return;
  }

  suggestions.forEach(suggestion => {
    const btn = document.createElement("button");
    btn.textContent = suggestion;
    btn.style.margin = "4px";
    btn.style.padding = "6px 10px";
    btn.style.background = "#444";
    btn.style.color = "#fff";
    btn.style.border = "none";
    btn.style.borderRadius = "4px";
    btn.style.cursor = "pointer";
    btn.addEventListener("click", () => {
      console.log("提案質問クリック:", suggestion);
      console.log("クリック時の会話ID:", conversationId);
      processInput(suggestion, null);
    });
    container.appendChild(btn);
  });
}


// ================================
// ログインモーダル制御等 (後半)
// ================================
const loginLink = document.getElementById("login-link");
const loginModal = document.getElementById("login-modal");
const closeLoginModalButton = document.getElementById("close-login-modal");
const loginSubmitButton = document.getElementById("login-submit-button");

if (loginLink && loginModal && closeLoginModalButton && loginSubmitButton) {
  loginLink.addEventListener("click", () => {
    loginModal.style.display = "flex";
  });

  closeLoginModalButton.addEventListener("click", () => {
    loginModal.style.display = "none";
  });

  loginSubmitButton.addEventListener("click", async () => {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();
    if (!email || !password) {
      alert("メールアドレスとパスワードを入力してください。");
      return;
    }
  
    try {
      const response = await fetch("https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/app/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert("ログイン失敗: " + (errorData.error || response.statusText));
        return;
      }

      const data = await response.json(); 
      // loginSuccess関数を使用してトークン保存とタイマー設定
      loginSuccess(data);
      
      hideLoginModal();
      updateNavMenu();
      
      // 状態更新
      enableUserInteractions();
      
      // 注: loginSuccess関数内で自動的に会話履歴が更新されるので、
      // ここでの会話履歴の取得コードは必要ありません
    } catch (err) {
      console.error("ログイン中エラー:", err);
      alert("ログイン処理中にエラーが発生しました。");
    }
  });
}

const mypageLink = document.getElementById("mypage-link");
const mypageModal = document.getElementById("mypage-modal");
const closeMypageModalButton = document.getElementById("close-mypage-modal");
const logoutButton = document.getElementById("logout-button");

if (mypageLink && mypageModal && closeMypageModalButton && logoutButton) {
  mypageLink.addEventListener("click", () => {
    showMypageModal();
  });

  closeMypageModalButton.addEventListener("click", () => {
    mypageModal.style.display = "none";
  });

  logoutButton.addEventListener("click", () => {
    logoutUser();
  });
}

// ログイン成功時の処理（トークン保存とタイマー設定）
function loginSuccess(data) {
  /* ▼ レスポンスのどこにトークンが来ても拾えるようにする */
  // ① メールアドレス
  const email =
        data.email               ||      // { "email": … }
        data.user?.email         ||      // { "user": { "email": … } }
        "";
  if (email) localStorage.setItem("userEmail", email);

  // ② ロール（配列 or 文字列想定）
  const roles =
        data.roles               ||      // { "roles": […] }
        data.user?.roles         ||      // { "user": { "roles": […] } }
        data.user?.groups        ||      // Django の Group 名
        [];
  localStorage.setItem("userRoles", JSON.stringify(roles));

  // ③ テナント（名称だけで OK）
  const tenant =
        data.tenant              ||      // { "tenant": "foo" }
        data.user?.tenant        ||      // { "user": { "tenant": "foo" } }
        data.user?.tenant_name   ||      // { "user": { "tenant_name": "foo" } }
        "";
  localStorage.setItem("userTenant", tenant);


  const access  = data.access        || data.access_token  ||
                  data.token?.access || data.tokens?.access;
  const refresh = data.refresh       || data.refresh_token ||
                  data.token?.refresh|| data.tokens?.refresh;

  if (!access || !refresh) {
    alert("ログイン応答にアクセストークンが含まれていません。サーバー側のレスポンス形式を確認してください。");
    console.error("loginSuccess: missing token field →", data);
    return;
  }

  localStorage.setItem("accessToken",  access);
  localStorage.setItem("refreshToken", refresh);

  logoutAlertShown = false;

  /* ④ 残トークン数を API から取得して保存・表示 ----------------- */
  fetchRemainingTokens()
    .then(balance => updateBalanceDisplay(balance))
    .catch(err => console.error("残トークン取得失敗:", err));
  
  // トークン更新タイマーを設定
  setupTokenRefreshTimer();
  enableUserInteractions();

  setTimeout(async () => {
    try {
      // キャッシュをクリアして最新データを取得
      apiCache.clear('conversation-list');
      
      // 会話一覧を取得して表示
      await fetchConversationList();
      
      // 最新の会話を読み込む（会話一覧が取得できていれば）
      const conversationListUL = document.getElementById("conversation-list");
      if (conversationListUL && conversationListUL.firstChild && 
          conversationListUL.firstChild.dataset && 
          conversationListUL.firstChild.dataset.convId) {
        // 一番上の会話を選択
        const firstConv = conversationListUL.firstChild;
        conversationId = firstConv.dataset.convId;
        await fetchConversationHistory(conversationId, firstConv.dataset.convName);
      } else {
        // 会話がない場合は新規会話を作成
        await createNewConversation();
      }
    } catch (err) {
      console.error("ログイン後の会話履歴更新エラー:", err);
      addMessage("会話履歴の更新中にエラーが発生しました。", "system");
    }
    removeSpecificSystemMessage("操作するにはログインが必要です。");
  }, 500); // 少し遅延させてUIの更新が完了するのを待つ
}

// ログインセッション維持のためのトークン更新タイマー設定
function setupTokenRefreshTimer() {
  // 既存のタイマーがある場合はクリア
  if (tokenRefreshTimer) {
    clearInterval(tokenRefreshTimer);
  }
  
  // アクセストークンがある場合のみタイマーを設定
  const token = localStorage.getItem("accessToken");
  if (token) {
    // 20分ごとにトークンをリフレッシュ
    tokenRefreshTimer = setInterval(async () => {
      const success = await tryRefresh();
      if (!success) {
        // リフレッシュ失敗時はタイマー停止
        clearInterval(tokenRefreshTimer);
        tokenRefreshTimer = null;
        // 必ずしもすぐにモーダルを表示する必要はない
        console.warn("トークンの自動更新に失敗しました。");
      }
    }, 20 * 60 * 1000); // 20分
  }
}

async function fetchRemainingTokens() {
  try {
    const cacheKey = 'token-balance';
    const cachedData = apiCache.get(cacheKey);
    
    if (cachedData !== null) {
      return cachedData;
    }
    
    const resp = await apiFetch("https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/app/api/tokens/balance", {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });
    
    if (!resp.ok) {
      const errorData = await resp.json();
      console.error("残トークン取得失敗:", errorData.error || resp.statusText);
      return null;
    }
    
    const data = await resp.json();               // { total, products:{…} }
    const balObj = {
      total : data.total,
      chat  : data.products?.[PRODUCT_CHAT]  ?? 0,
      image : data.products?.[PRODUCT_IMAGE] ?? 0
    };

    if (typeof balObj.total !== "number") {
      console.error("残トークン数を取得できません。戻り値:", data);
      return null;
    }

    console.log("残りトークン数:", balObj);
    apiCache.set(cacheKey, balObj, 5 * 60 * 1000);
    return balObj;
  } catch (error) {
    console.error("トークン残高取得エラー:", error);
    return null;
  }
}

async function consumeTokens(amount) {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    alert("ログインしてください。");
    return;
  }

  try {
    const resp = await apiFetch("https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/app/api/tokens/consume", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ tokens: amount })
    });

    const contentType = resp.headers.get("Content-Type") || '';

    if (!resp.ok) {
      let errorMessage = `エラー: ステータスコード ${resp.status}`;

      if (contentType.includes("application/json")) {
        const errData = await resp.json();
        errorMessage += ` - ${errData.message || JSON.stringify(errData)}`;
      } else if (contentType.includes("text/html")) {
        const errHtml = await resp.text();
        console.error("サーバーエラーHTML:", errHtml);
        errorMessage += ` - サーバーエラーが発生しました。詳細はサーバーのログをご確認ください。`;
      } else {
        errorMessage += ` - 不明なエラー形式`;
      }

      alert(errorMessage);
      return;
    }

    const data = await resp.json();               // { total, products:{…} }
    const balObj = {
      total : data.total,
      chat  : data.products?.[PRODUCT_CHAT]  ?? 0,
      image : data.products?.[PRODUCT_IMAGE] ?? 0
    };
    console.log("新しい残高:", balObj);

    updateBalanceDisplay(balObj);
    apiCache.set("token-balance", balObj, 5 * 60 * 1000);
    return balObj;

  } catch (err) {
    console.error("通信エラー:", err);
    alert("通信エラーが発生しました。ネットワークを確認してください。");
  }
}

async function checkSubscriptionStatus() {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    alert("ログインしてください。");
    return;
  }

  try {
    const resp = await apiFetch("https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/app/api/subscription/status", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error("サブスク確認失敗:", errText);
      return;
    }
    const data = await resp.json();
    console.log("サブスクは有効？ =>", data.subscription_active);
  } catch (err) {
    console.error("サブスク状態チェック中エラー:", err);
  }
}

function updateNavMenu() {
  const loginLink = document.getElementById("login-link");
  const mypageLink = document.getElementById("mypage-link");
  const accessToken = localStorage.getItem("accessToken");

  if (loginLink) {
    loginLink.style.display = accessToken ? "none" : "inline-block";
  }

  if (mypageLink) {
    mypageLink.style.display = accessToken ? "inline-block" : "none";
  }
}

function showMypageModal() {
  const mypageModal = document.getElementById("mypage-modal");
  const emailSpan = document.getElementById("user-email");
  const rolesSpan = document.getElementById("user-roles");
  const tenantSpan = document.getElementById("user-tenant");
  const tokenSpan = document.getElementById("user-token-balance");

  if (!mypageModal || !emailSpan || !rolesSpan || !tenantSpan || !tokenSpan) {
    console.error("マイページモーダルの要素が見つかりません。");
    return;
  }

  const email = localStorage.getItem("userEmail") || "";
  const roles = JSON.parse(localStorage.getItem("userRoles") || "[]");
  const tenant = localStorage.getItem("userTenant") || "";
  const tokenBalance = Number(localStorage.getItem("userTokenBalance") || 0);

  emailSpan.textContent = email;
  rolesSpan.textContent = roles.join(", ");
  tenantSpan.textContent = tenant;
  if (!tokenBalance) {
    tokenSpan.textContent = tokenBalance;
  } else {
    // ローカルに無ければ即時取得
    fetchRemainingTokens().then(bal => updateBalanceDisplay(bal));
  }

  mypageModal.style.display = "flex";
}

function logoutUser() {
  // 既存のタイマーがある場合はクリア
  if (tokenRefreshTimer) {
    clearInterval(tokenRefreshTimer);
    tokenRefreshTimer = null;
  }
  
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("userRoles");
  localStorage.removeItem("userTenant");
  localStorage.removeItem("userTokenBalance");
  
  // キャッシュをクリア
  apiCache.clear();
  
  updateNavMenu();
  setupUnauthorizedInterceptors();
  
  const mypageModal = document.getElementById("mypage-modal");
  if (mypageModal) {
    mypageModal.style.display = "none";
  }
  
  if (!logoutAlertShown) {          // ← 追加
    alert("ログアウトしました。");
    logoutAlertShown = true;
  }
  
  // チャットメッセージをクリア
  clearChatMessages();
  addMessage("ログアウトしました。操作するにはログインが必要です。", "system");
  
  // ここを追加: ログアウト後すぐにログインモーダルを表示
  showLoginModal();
}

function updateBalanceDisplay(raw) {
  if (!raw) return;

  // 数値だけ来ても壊れないよう後方互換
  const bal = typeof raw === "number"
              ? { total: raw, chat: "-", image: "-" }
              : raw;

  localStorage.setItem("userTokenBalance", bal.total);

  const span = document.getElementById("user-token-balance");
  if (span) span.textContent = bal.total;

  apiCache.set("token-balance", bal, 5 * 60 * 1000);
}

async function tryRefresh() {
  const refresh = localStorage.getItem("refreshToken");
  if (!refresh) return false;

  try {
    const resp = await fetch("https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/app/api/token/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh })
    });
    
    if (!resp.ok) {
      return false;
    }

    const data = await resp.json();
    const newAccess = data.access || data.access_token;
    if (!newAccess) return false;   // access が無ければ失敗扱い
    localStorage.setItem("accessToken", newAccess);
    if (data.refresh) {
      localStorage.setItem("refreshToken",
data.refresh);
    }
    return true;
  } catch (error) {
    console.error("トークンリフレッシュエラー:", error);
    return false;
  }
}

// 改善されたapiFetch関数
async function apiFetch(url, options = {}) {
  // キャッシュキーの作成（URL+メソッド+bodyハッシュ）
  const cacheKey = `${url}-${options.method || 'GET'}-${
    options.body ? JSON.stringify(options.body).slice(0, 50) : ''
  }`;
  
  // トークン取得
  let token = localStorage.getItem("accessToken");

  /* アクセストークン未格納の場合は即ログイン要求せず、
     まずリフレッシュを試してみる（初回チャットで毎回モーダルになるのを防ぐ） */
  if (!token) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      token = localStorage.getItem("accessToken");
    } else {
      showLoginModal();
      throw new Error("No access token, and refresh failed.");
    }
  }

  // 共通ヘッダーに認証トークンを付与
  const headers = { ...(options.headers || {}), "Authorization": `Bearer ${token}` };

  // fetchオプションにCORSと認証情報（もしCookie利用もあれば）を確実に含める
  const fetchOptions = {
    ...options,
    headers,
    mode: 'cors',
    credentials: 'include'
  };

  let retryCount = 0;
  const maxRetries = 3;  // ネットワークエラー時に最大3回再試行

  async function executeFetch() {
    try {
      let res = await fetch(url, fetchOptions);

      // 401認証エラー時のリフレッシュ処理
      if (res.status === 401) {
        // Refresh only once
        const refreshSuccess = await tryRefresh();
        if (!refreshSuccess) {
          showLoginModal();
          throw new Error("Authentication failed. Please log in again.");
        }
        // 新しいトークンをセットして再試行
        const newToken = localStorage.getItem("accessToken");
        fetchOptions.headers["Authorization"] = `Bearer ${newToken}`;
        res = await fetch(url, fetchOptions);
        if (res.status === 401) {
          showLoginModal();
          throw new Error("Still unauthorized after refresh. Please log in.");
        }
      }

      return res;
    } catch (error) {
      // ネットワークエラー時の指数バックオフ再試行
      if (retryCount < maxRetries) {
        retryCount++;
        const backoffTime = Math.pow(2, retryCount) * 1000;
        console.warn(`ネットワークエラー、${retryCount}回目の再試行（${backoffTime}ms後）...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return executeFetch();
      }
      console.error("Network error after retries:", error);
      throw error;
    }
  }

  return executeFetch();
}

// ================================
// Dify APIパラメータ取得関数
// ================================
async function fetchDifyParameters() {
  try {
    // キャッシュチェック
    const cached = apiCache.get('dify-parameters');
    if (cached) return cached;
    
    const resp = await apiFetch("https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/parameters", {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    
    if (!resp.ok) {
      console.error("Failed to fetch Dify parameters:", resp.status);
      return null;
    }
    
    const data = await resp.json();
    
    // キャッシュに保存（5分間）
    apiCache.set('dify-parameters', data, 5 * 60 * 1000);
    
    return data;
  } catch (err) {
    console.error("Error fetching Dify parameters:", err);
    return null;
  }
}

function showLoginModal() {
  const loginModal = document.getElementById("login-modal");
  if (!loginModal) return;

  loginModal.style.display = "flex";

  // 未ログイン状態ではモーダルを閉じられないようにする
  const closeBtn = document.getElementById("close-login-modal");
  if (closeBtn) {
    closeBtn.style.display = "none";
  }

  // 入力欄と送信ボタンを無効化
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-button");
  if (userInput) userInput.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
  
  // モーダル外クリックでもログインモーダルを閉じられないようにする
  loginModal.onclick = function(e) {
    if (e.target === loginModal) {
      e.stopPropagation();
      // アラートで表示するので以下の行を削除
      // addMessage("操作するにはログインが必要です。", "system");
      alert("操作するにはログインが必要です。"); // 代わりにアラートで表示
    }
  };
}

function hideLoginModal() {
  const loginModal = document.getElementById("login-modal");
  if (loginModal) {
    loginModal.style.display = "none";
  }

  const closeBtn = document.getElementById("close-login-modal");
  if (closeBtn) {
    closeBtn.style.display = "inline-block";
  }

  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-button");
  if (userInput) userInput.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
}

// ファイル削除用の関数（削除APIへのリクエスト）
async function deleteFile(docId) {
  try {
    // ここでは、DELETEリクエストで削除を実行する例です。
    // ※エンドポイントのURLは、環境に合わせて修正してください。
    const response = await apiFetch(`https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/datasets/your_dataset_id/documents/${docId}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }
    alert("ファイルが削除されました。");
    
    // ファイル一覧キャッシュをクリア
    apiCache.clear('file-list');
  } catch (err) {
    console.error("ファイル削除エラー:", err);
    alert("ファイル削除に失敗しました: " + err.message);
  }
}

// ================================
// ログイン状態のチェック (新規追加)
// ================================
function checkLoginStatus() {
  const token = localStorage.getItem("accessToken");
  
  if (!token) {
    // 初回ロード時は強制的にモーダルを表示しない
    // ユーザーが何か操作した時に表示する
    setupUnauthorizedInterceptors();
  } else {
    // トークンの有効性を確認（オプション）
    validateTokenSilently();
    // トークン更新タイマーを設定
    setupTokenRefreshTimer();
    // ユーザー操作を有効化
    enableUserInteractions();
  }
  
  updateNavMenu();
}

// 保存されたトークンの有効性を静かに確認
async function validateTokenSilently() {
  try {
    // 一時的に無効化：トークンバランスAPIで401エラーが発生するため
    return;
    
    // 軽量なAPIエンドポイントを叩いて有効性確認
    const resp = await fetch("https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/app/api/tokens/balance", {
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("accessToken")}`
      }
    });
    
    if (!resp.ok && resp.status === 401) {
      // 無効なトークン
      const refreshSuccess = await tryRefresh();
      if (!refreshSuccess) {
        // リフレッシュ失敗時も強制表示しない
        setupUnauthorizedInterceptors();
      }
    }
  } catch (error) {
    console.error("Token validation error:", error);
    // エラー時もそのまま続行
  }
}

// 未ログイン時にユーザー操作を傍受してログインモーダルを表示
function setupUnauthorizedInterceptors() {
  const interceptElements = [
    document.getElementById("send-button"),
    document.getElementById("record-button"),
    document.getElementById("open-upload-modal-button"),
    document.getElementById("file-list-link"),
    document.getElementById("new-conversation-btn"),
    document.getElementById("conversation-refresh")
  ];
  
  interceptElements.forEach(elem => {
    if (elem) {
      // 元のclickイベントを保存
      elem.__originalClick = elem.onclick;
      
      // 新しいclickイベントで上書き
      elem.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        alert("操作するにはログインが必要です。"); // チャット欄ではなくアラートで表示
        showLoginModal();
      };
    }
  });
  
  // フォーム送信に対する傍受
  const userInput = document.getElementById("user-input");
  if (userInput) {
    unauthorizedKeydownHandler = function(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        alert("メッセージを送信するにはログインが必要です。"); // チャット欄ではなくアラートで表示
        showLoginModal();
      }
    };
    userInput.addEventListener("keydown", unauthorizedKeydownHandler, true);
  }
}

// ユーザー操作を有効化
function enableUserInteractions() {
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-button");
  if (userInput) userInput.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
  
  // 傍受していたイベントを元に戻す
  const elements = [
    document.getElementById("send-button"),
    document.getElementById("record-button"),
    document.getElementById("open-upload-modal-button"),
    document.getElementById("file-list-link"),
    document.getElementById("new-conversation-btn"),
    document.getElementById("conversation-refresh")
  ];
  
  elements.forEach(elem => {
    if (elem) {
      // イベントリスナーをクリア（より確実な方法）
      if (elem.__originalClick) {
        elem.onclick = elem.__originalClick;
        delete elem.__originalClick;
      } else {
        elem.onclick = null;
      }
      
      // 元々のイベントリスナーが設定されていた場合は再設定
      if (elem.id === "send-button") {
        elem.addEventListener("click", () => {
          // 処理中なら何もしない
          if (isProcessingInput) return;
          
          const userInput = document.getElementById("user-input").value.trim();
          processInput(userInput, null);
        });
      }
      
      // 他のボタンについても同様に元々の機能を再設定する
      // 例：record-buttonなど必要に応じて
    }
  });
  
  // キーボードイベントも元に戻す
  const inputField = document.getElementById("user-input");
  if (inputField) {
    if (unauthorizedKeydownHandler) {
      inputField.removeEventListener("keydown", unauthorizedKeydownHandler, true);
      unauthorizedKeydownHandler = null;
    }
    
    // 正しいイベントリスナーを設定し直す
    inputField.addEventListener("keydown", e => {
      if (e.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        // 処理中なら何もしない
        if (isProcessingInput) return;
        
        const userInput = inputField.value.trim();
        processInput(userInput, null);
      }
    });
  }
}

// ネットワーク状態の監視
function setupNetworkMonitoring() {
  window.addEventListener('online', () => {
    console.log('オンラインに戻りました');
    addMessage("インターネット接続が回復しました。", "system");
    // 必要ならキャッシュをクリアして最新データを取得
    apiCache.clear('conversation-list');
    fetchConversationList();
  });
  
  window.addEventListener('offline', () => {
    console.log('オフラインになりました');
    addMessage("インターネット接続が切断されました。一部機能が利用できません。", "system");
  });
}

// システムメッセージを削除する関数 - 追加して問題を解決
function clearSystemMessages(text) {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return;
  
  const systemMessages = chatMessages.querySelectorAll(".message.system");
  systemMessages.forEach(msg => {
    // 特定のテキストを含むメッセージのみ削除
    if (msg.textContent === text) {
      chatMessages.removeChild(msg);
    }
  });
}

// 全てのシステムメッセージを削除する関数（オプション）
function clearAllSystemMessages() {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return;
  
  const systemMessages = chatMessages.querySelectorAll(".message.system");
  systemMessages.forEach(msg => {
    chatMessages.removeChild(msg);
  });
}

// ================================
// デバッグ機能とエラー対策
// ================================

// API状態をチェックする関数
async function checkApiStatus() {
  try {
    const resp = await fetch("https://sirusiru-tunagu-proxy.tsuji-090.workers.dev/api-status", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("accessToken") || ""}`
      }
    });
    
    if (!resp.ok) {
      console.error("API status check failed:", await resp.text());
      return false;
    }
    
    const data = await resp.json();
    console.log("API status:", data);
    
    // Dify APIの状態を確認
    const difyApiStatus = data.api_checks?.parameters?.status || "unknown";
    return difyApiStatus === "ok";
  } catch (err) {
    console.error("Error checking API status:", err);
    return false;
  }
}

// クライアントサイドのAPI呼び出しをデバッグするラッパー関数
async function debugApiCall(url, options = {}) {
  console.log(`?? API呼び出し: ${url}`);
  console.log("オプション:", options);
  
  const startTime = performance.now();
  
  try {
    const response = await fetch(url, options);
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`? API応答時間: ${duration.toFixed(2)}ms`);
    console.log(`応答ステータス: ${response.status}`);
    
    // ステータスコードに応じたログ
    if (response.ok) {
      console.log("成功: 正常なレスポンスを受信");
    } else {
      console.error(`エラー: HTTP ${response.status} - ${response.statusText}`);
      
      try {
        // エラーレスポンスの中身を確認
        const errorText = await response.text();
        console.error("エラー詳細:", errorText);
        
        // JSONかどうか確認
        try {
          const errorJson = JSON.parse(errorText);
          console.error("エラーJSON:", errorJson);
        } catch (e) {
          console.log("エラーレスポンスはJSONではありません");
        }
      } catch (err) {
        console.error("エラーレスポンスの読み取りに失敗:", err);
      }
    }
    
    // レスポンスのクローンを作成して返す（元のレスポンスはすでに消費されている可能性がある）
    return response.clone();
  } catch (err) {
    console.error(`? API呼び出し失敗: ${err.message}`, err);
    throw err;
  }
}

// API呼び出しの改良バージョン
async function improvedApiFetch(url, options = {}) {
  // デバッグモードなら詳細なログを出力
  const isDebugMode = localStorage.getItem("debugMode") === "true";
  
  if (isDebugMode) {
    return debugApiCall(url, options);
  }
  
  // ネットワークが切断されている場合
  if (!navigator.onLine) {
    console.error("ネットワーク接続がありません");
    throw new Error("Network is offline");
  }
  
  // トークンの取得
  const token = localStorage.getItem("accessToken");
  if (!token && !url.includes("/login")) {
    console.warn("認証トークンがありません");
    throw new Error("No authentication token");
  }
  
  // リクエストヘッダーの設定
  const headers = {
    ...(options.headers || {}),
    "Authorization": token ? `Bearer ${token}` : "",
    "Content-Type": options.headers?.["Content-Type"] || "application/json"
  };
  
  // タイムアウト設定
  const timeout = options.timeout || 30000; // デフォルト30秒
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  // フェッチオプションの構築
  const fetchOptions = {
    ...options,
    headers,
    signal: controller.signal
  };
  
  try {
    // APIリクエスト実行
    const response = await fetch(url, fetchOptions);
    
    // ステータスコードが401（認証エラー）かつログインページでない場合
    if (response.status === 401 && !url.includes("/login")) {
      // トークンリフレッシュを試みる
      const refreshSuccess = await tryRefresh();
      
      if (refreshSuccess) {
        // 新しいトークンでリトライ
        headers.Authorization = `Bearer ${localStorage.getItem("accessToken")}`;
        return fetch(url, { ...fetchOptions, headers });
      } else {
        console.error("トークンのリフレッシュに失敗しました");
        throw new Error("Authentication failed");
      }
    }
    
    return response;
  } catch (err) {
    // タイムアウトエラー
    if (err.name === "AbortError") {
      console.error(`タイムアウト: ${timeout}ms経過`);
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    // その他のエラー
    console.error("API呼び出しエラー:", err);
    throw err;
  } finally {
    // タイムアウトIDをクリア
    clearTimeout(timeoutId);
  }
}

// デバッグ用モックデータの生成
function generateMockConversationHistory(conversationId) {
  return {
    data: [
      {
        id: "mock-msg-1",
        conversation_id: conversationId,
        query: "これはテスト会話です",
        answer: "こんにちは！APIに接続できないため、テスト会話を表示しています。"
      },
      {
        id: "mock-msg-2",
        conversation_id: conversationId,
        query: "APIの問題はいつ解決しますか？",
        answer: "現在APIサーバーの状態を確認中です。一時的な問題の可能性がありますので、しばらく時間をおいてから再度お試しください。"
      }
    ],
    has_more: false,
    limit: 20
  };
}

// デバッグ用モックデータ（会話一覧）
function generateMockConversationList() {
  const now = Math.floor(Date.now() / 1000);
  return {
    data: [
      {
        id: "mock-conv-1",
        name: "テスト会話1",
        created_at: now - 3600, // 1時間前
        updated_at: now - 1800  // 30分前
      },
      {
        id: "mock-conv-2",
        name: "テスト会話2",
        created_at: now - 86400, // 1日前
        updated_at: now - 43200  // 12時間前
      }
    ],
    has_more: false,
    limit: 20
  };
}

// デバッグモードの切り替え
function toggleDebugMode() {
  const currentMode = localStorage.getItem("debugMode") === "true";
  localStorage.setItem("debugMode", (!currentMode).toString());
  console.log(`デバッグモードを${!currentMode ? "有効" : "無効"}にしました`);
  
  // デバッグモードが有効な場合、コンソールにヘルプメッセージを表示
  if (!currentMode) {
    console.log("%c SIRUSIRU デバッグモード ", "background: #ff5722; color: white; font-size: 14px; font-weight: bold; padding: 2px 8px; border-radius: 4px;");
    console.log("以下のデバッグコマンドが利用可能です：");
    console.log("- checkApiStatus() - API状態をチェック");
    console.log("- useMockData(true/false) - モックデータの使用を切り替え");
    console.log("- apiCache.clear() - キャッシュをクリア");
    console.log("- showApiCache() - 現在のキャッシュ内容を表示");
  }
  
  return !currentMode;
}

// モックデータの使用を切り替え
function useMockData(enabled = true) {
  localStorage.setItem("useMockData", enabled.toString());
  console.log(`モックデータの使用を${enabled ? "有効" : "無効"}にしました`);
  return enabled;
}

// 現在のキャッシュ内容を表示
function showApiCache() {
  console.log("現在のAPIキャッシュ内容:");
  
  if (!apiCache || !apiCache.data) {
    console.log("キャッシュが初期化されていないか空です");
    return;
  }
  
  const cacheEntries = [];
  apiCache.data.forEach((value, key) => {
    const ttl = apiCache.ttl.get(key);
    const remainingTime = ttl ? Math.max(0, ttl - Date.now()) : 0;
    
    cacheEntries.push({
      key,
      // valueの概要（完全な内容は大きすぎる可能性がある）
      valuePreview: typeof value === 'object' ? 
        `[Object] (${JSON.stringify(value).substring(0, 50)}...)` : 
        value,
      ttl: new Date(ttl).toLocaleTimeString(),
      remainingSecs: Math.floor(remainingTime / 1000),
      expired: Date.now() > ttl
    });
  });
  
  console.table(cacheEntries);
}

/* ────────── お問い合わせ mailto リンク ────────── */
document.getElementById("contact-mail-link")?.addEventListener("click", e => {
  e.preventDefault();

  /* ① ログイン情報を取得 */
  const email   = localStorage.getItem("userEmail")        || "";
  const roles   = JSON.parse(localStorage.getItem("userRoles")||"[]").join(", ");
  const tenant  = localStorage.getItem("userTenant")       || "";
  const balance = localStorage.getItem("userTokenBalance") || "";

  /* ② 本文テンプレート */
  const body = [
    "◆ ログイン情報",
    `メールアドレス : ${email}`,
    `役職         : ${roles}`,
    `企業名       : ${tenant}`,
    `残会話数   : ${balance}`,
    "",
    "お問い合わせ内容を入力してください。原則、3営業日以内で返信します。"
  ].join("\n");

  /* ③ 件名・本文を URI エンコード (%20 でスペースを保持) */
  const subjectEnc = encodeURIComponent("SIRUSIRUからの問い合わせ");
  const bodyEnc = encodeURIComponent(body).replace(/%0A/g, "%0D%0A");

  /* ④ mailto リンクを生成してメーラーを呼び出し */
  window.location.href =
    `mailto:info@noce-creative.co.jp?subject=${subjectEnc}&body=${bodyEnc}`;
});