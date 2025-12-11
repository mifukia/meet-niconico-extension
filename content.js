// Meet Niconico Comments - Content Script
(function () {
  'use strict';

  let isEnabled = true;
  let commentContainer = null;
  let observer = null;
  let processedMessages = new Set();

  // コメントコンテナを作成
  function createCommentContainer() {
    if (commentContainer) return commentContainer;

    commentContainer = document.createElement('div');
    commentContainer.id = 'niconico-comment-container';
    document.body.appendChild(commentContainer);

    return commentContainer;
  }

  // コメントを流す
  function flowComment(text, author) {
    if (!isEnabled || !commentContainer) return;

    const comment = document.createElement('div');
    comment.className = 'niconico-comment';

    // 表示テキスト（名前: メッセージ）
    const displayText = author ? `${author}: ${text}` : text;
    comment.textContent = displayText;

    // 縦位置をランダムに設定（上部5%〜下部85%の範囲）
    const randomY = Math.random() * 80 + 5;
    comment.style.top = `${randomY}%`;

    // アニメーション時間をテキスト長に応じて調整
    const duration = Math.max(5, Math.min(10, 5 + text.length * 0.05));
    comment.style.animationDuration = `${duration}s`;

    commentContainer.appendChild(comment);

    // アニメーション終了後に削除
    comment.addEventListener('animationend', () => {
      comment.remove();
    });
  }

  // チャットメッセージを監視
  function observeChat() {
    // MutationObserver でチャットの変更を監視
    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            extractAndFlowMessage(node);
          }
        });
      });
    });

    // body 全体を監視（チャットパネルの位置が動的に変わるため）
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log('[Meet Niconico] Chat observer started');
  }

  // メッセージを抽出して流す
  function extractAndFlowMessage(element) {
    // Google Meet 2024年版のDOM構造に対応
    // メッセージコンテナ: .Ss4fHf
    // 送信者名: .poVWob
    // メッセージ本文: div[jsname="dTKtvb"] > div
    // メッセージID: .RLrADb[data-message-id]

    // パターン1: メッセージコンテナ (.Ss4fHf) が追加された場合
    const messageContainers = element.classList?.contains('Ss4fHf')
      ? [element]
      : element.querySelectorAll
        ? Array.from(element.querySelectorAll('.Ss4fHf'))
        : [];

    messageContainers.forEach((container) => {
      // メッセージIDを取得して重複チェック
      const messageEl = container.querySelector('.RLrADb[data-message-id]');
      const messageId = messageEl?.getAttribute('data-message-id');

      if (messageId && processedMessages.has(messageId)) {
        return; // 既に処理済み
      }

      // 送信者名を取得
      const senderEl = container.querySelector('.poVWob');
      const sender = senderEl?.textContent?.trim();

      // メッセージ本文を取得
      const textEl = container.querySelector('div[jsname="dTKtvb"] > div');
      const text = textEl?.textContent?.trim();

      if (text && text.length > 0) {
        // メッセージIDがあれば使用、なければテキストベースでIDを生成
        const id = messageId || `${text.slice(0, 30)}_${Date.now()}`;

        if (!processedMessages.has(id)) {
          processedMessages.add(id);
          flowComment(text, sender);
          console.log('[Meet Niconico] New message:', sender, text);
        }
      }
    });

    // パターン2: data-message-id を持つ要素が直接追加された場合
    if (element.hasAttribute?.('data-message-id')) {
      const messageId = element.getAttribute('data-message-id');
      if (!processedMessages.has(messageId)) {
        // 親要素から情報を取得
        const container = element.closest('.Ss4fHf');
        if (container) {
          const senderEl = container.querySelector('.poVWob');
          const sender = senderEl?.textContent?.trim();
          const textEl = container.querySelector('div[jsname="dTKtvb"] > div');
          const text = textEl?.textContent?.trim();

          if (text) {
            processedMessages.add(messageId);
            flowComment(text, sender);
            console.log('[Meet Niconico] New message (pattern 2):', sender, text);
          }
        }
      }
    }

    // processedMessages が大きくなりすぎないように管理
    if (processedMessages.size > 1000) {
      const arr = Array.from(processedMessages);
      processedMessages = new Set(arr.slice(-500));
    }
  }

  // 設定を読み込む
  function loadSettings() {
    chrome.storage.sync.get(['enabled'], (result) => {
      isEnabled = result.enabled !== false; // デフォルトは有効
      console.log('[Meet Niconico] Enabled:', isEnabled);
    });
  }

  // 設定変更を監視
  function watchSettings() {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.enabled) {
        isEnabled = changes.enabled.newValue;
        console.log('[Meet Niconico] Enabled changed to:', isEnabled);

        if (!isEnabled && commentContainer) {
          // 無効化時は既存のコメントをクリア
          commentContainer.innerHTML = '';
        }
      }
    });
  }

  // テスト用: 手動でコメントを流す
  window.testNiconicoComment = function (text) {
    flowComment(text || 'テストコメント', 'テストユーザー');
  };

  // ポップアップからのメッセージを受信
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TEST_COMMENT') {
      flowComment(message.text || 'テストコメント', 'テスト');
      sendResponse({ success: true });
    }
    return true;
  });

  // 初期化
  function init() {
    console.log('[Meet Niconico] Initializing...');

    createCommentContainer();
    loadSettings();
    watchSettings();

    // ページの読み込みを待ってから監視開始
    setTimeout(() => {
      observeChat();
    }, 2000);

    console.log('[Meet Niconico] Initialized successfully');
    console.log('[Meet Niconico] テスト: コンソールで testNiconicoComment("テスト") を実行してください');
  }

  // DOM 準備完了後に初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
