// Meet Niconico Comments - Content Script
(function () {
  'use strict';

  let isEnabled = true;
  let isAgendaEnabled = true;
  let commentContainer = null;
  let agendaContainer = null;
  let agendaListContainer = null;
  let currentAgendaNum = null;
  let observer = null;
  let processedMessages = new Map(); // テキスト -> タイムスタンプ
  let agendas = {}; // アジェンダリスト

  // コメントコンテナを作成
  function createCommentContainer() {
    if (commentContainer) return commentContainer;

    commentContainer = document.createElement('div');
    commentContainer.id = 'niconico-comment-container';
    document.body.appendChild(commentContainer);

    return commentContainer;
  }

  // アジェンダ表示コンテナを作成（現在のアジェンダ）
  function createAgendaContainer() {
    if (agendaContainer) return agendaContainer;

    agendaContainer = document.createElement('div');
    agendaContainer.id = 'niconico-agenda-container';
    agendaContainer.style.display = 'none';
    document.body.appendChild(agendaContainer);

    return agendaContainer;
  }

  // 全体アジェンダリストコンテナを作成
  function createAgendaListContainer() {
    if (agendaListContainer) return agendaListContainer;

    agendaListContainer = document.createElement('div');
    agendaListContainer.id = 'niconico-agenda-list';
    agendaListContainer.style.display = 'none';
    document.body.appendChild(agendaListContainer);

    return agendaListContainer;
  }

  // 全体アジェンダリストを更新
  function updateAgendaList() {
    if (!agendaListContainer) return;

    const agendaKeys = Object.keys(agendas).sort((a, b) => Number(a) - Number(b));

    if (agendaKeys.length === 0) {
      agendaListContainer.style.display = 'none';
      return;
    }

    let html = '<div class="agenda-list-title">📋 アジェンダ</div>';

    agendaKeys.forEach((num) => {
      const text = agendas[num];
      const isActive = currentAgendaNum === num;
      const className = isActive ? 'agenda-item active' : 'agenda-item inactive';

      html += `
        <div class="${className}">
          <span class="item-number">${num}</span>
          <span class="item-text">${text}</span>
        </div>
      `;
    });

    agendaListContainer.innerHTML = html;
  }

  // アジェンダを表示
  function showAgenda(num) {
    if (!agendaContainer || !isAgendaEnabled) return;

    const text = agendas[num];
    if (!text) {
      console.log('[Meet Niconico] Agenda not found:', num);
      return;
    }

    // 現在のアジェンダ番号を記録
    currentAgendaNum = num;

    // 現在のアジェンダ表示を更新
    agendaContainer.innerHTML = `<span class="agenda-number">${num}</span><span class="agenda-text">${text}</span>`;
    agendaContainer.style.display = 'flex';

    // 全体リストも表示・更新
    if (agendaListContainer) {
      agendaListContainer.style.display = 'block';
      updateAgendaList();
    }

    console.log('[Meet Niconico] Show agenda:', num, text);
  }

  // アジェンダを非表示
  function hideAgenda() {
    if (!agendaContainer) return;

    currentAgendaNum = null;
    agendaContainer.style.display = 'none';

    // 全体リストも非表示
    if (agendaListContainer) {
      agendaListContainer.style.display = 'none';
    }

    console.log('[Meet Niconico] Hide agenda');
  }

  // コマンドをチェック
  function checkCommand(text) {
    // /1, /2, /off, /0 などのコマンドをチェック
    const match = text.match(/^\/(\d+|off|0)$/i);
    if (!match) return false;

    const cmd = match[1].toLowerCase();
    if (cmd === 'off' || cmd === '0') {
      hideAgenda();
    } else {
      showAgenda(cmd);
    }
    return true;
  }

  // アジェンダ共有データをチェック
  function checkAgendaShare(text) {
    // [AGENDA]{...} 形式をチェック
    const match = text.match(/^\[AGENDA\](.+)$/);
    if (!match) return false;

    try {
      const sharedAgendas = JSON.parse(match[1]);

      // 有効なオブジェクトかチェック
      if (typeof sharedAgendas !== 'object' || Array.isArray(sharedAgendas)) {
        console.log('[Meet Niconico] Invalid agenda format');
        return false;
      }

      // ローカルに保存（自分のアジェンダを上書き）
      agendas = sharedAgendas;
      chrome.storage.sync.set({ agendas: sharedAgendas }, () => {
        console.log('[Meet Niconico] Agenda imported from chat:', Object.keys(sharedAgendas).length, 'items');
      });

      // 画面中央に通知を表示
      showCenterNotification(`📋 アジェンダを受信しました（${Object.keys(sharedAgendas).length}件）`);

      // 全体リストを更新
      updateAgendaList();

      return true;
    } catch (e) {
      console.log('[Meet Niconico] Failed to parse agenda JSON:', e);
      return false;
    }
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
    // アプローチ: div[jsname="dTKtvb"] を直接探して、テキスト内容をキーにする
    // Google Meet は同じメッセージに複数の data-message-id を付けることがあるため

    // jsname="dTKtvb" を持つ要素を探す（メッセージ本文コンテナ）
    const textContainers = element.querySelectorAll
      ? Array.from(element.querySelectorAll('div[jsname="dTKtvb"]'))
      : [];

    // element 自身が jsname="dTKtvb" を持つ場合も追加
    if (element.matches?.('div[jsname="dTKtvb"]')) {
      textContainers.push(element);
    }

    textContainers.forEach((textContainer) => {
      // テキストを取得
      const textDiv = textContainer.querySelector('div');
      const text = textDiv?.textContent?.trim() || textContainer.textContent?.trim();

      if (!text || text.length === 0) return;

      // ユニークキーを作成（テキスト + タイムスタンプの組み合わせ）
      // 近い時間内の同じテキストは重複とみなす
      const now = Date.now();
      const textKey = `text:${text}`;

      // 同じテキストが最近処理されたかチェック（500ms以内）
      if (processedMessages.has(textKey)) {
        const lastTime = processedMessages.get(textKey);
        if (now - lastTime < 500) {
          return; // 重複としてスキップ
        }
      }

      // 送信者名を取得（親コンテナから）
      const container = textContainer.closest('.Ss4fHf');
      const senderEl = container?.querySelector('.poVWob');
      const sender = senderEl?.textContent?.trim();

      console.log('[Meet Niconico] DEBUG:', {
        text,
        sender,
        textKey
      });

      // 処理済みとして記録（タイムスタンプ付き）
      processedMessages.set(textKey, now);

      // アジェンダ共有データかどうかチェック
      if (checkAgendaShare(text)) {
        console.log('[Meet Niconico] Agenda share detected:', text);
        return; // 共有データは流さない
      }

      // コマンドかどうかチェック
      if (checkCommand(text)) {
        console.log('[Meet Niconico] Command detected:', text);
        return; // コマンドは流さない
      }

      flowComment(text, sender);
      console.log('[Meet Niconico] New message:', sender, text);

      // AI用にバックグラウンドに送信
      sendToBackground(sender, text);
    });

    // processedMessages が大きくなりすぎないように管理
    if (processedMessages.size > 1000) {
      const entries = Array.from(processedMessages.entries());
      processedMessages = new Map(entries.slice(-500));
    }
  }

  // 設定を読み込む
  function loadSettings() {
    chrome.storage.sync.get(['enabled', 'agendaEnabled', 'agendas'], (result) => {
      isEnabled = result.enabled !== false; // デフォルトは有効
      isAgendaEnabled = result.agendaEnabled !== false; // デフォルトは有効
      agendas = result.agendas || {};
      console.log('[Meet Niconico] Enabled:', isEnabled);
      console.log('[Meet Niconico] Agenda Enabled:', isAgendaEnabled);
      console.log('[Meet Niconico] Agendas loaded:', Object.keys(agendas).length);
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
      if (changes.agendaEnabled) {
        isAgendaEnabled = changes.agendaEnabled.newValue !== false;
        console.log('[Meet Niconico] Agenda Enabled changed to:', isAgendaEnabled);

        if (!isAgendaEnabled) {
          // 無効化時はアジェンダを非表示（番号は保持）
          if (agendaContainer) agendaContainer.style.display = 'none';
          if (agendaListContainer) agendaListContainer.style.display = 'none';
        } else if (currentAgendaNum) {
          // 有効化時に前回のアジェンダがあれば復元
          showAgenda(currentAgendaNum);
        }
      }
      if (changes.agendas) {
        agendas = changes.agendas.newValue || {};
        console.log('[Meet Niconico] Agendas updated:', Object.keys(agendas).length);
      }
    });
  }

  // テスト用: 手動でコメントを流す
  window.testNiconicoComment = function (text) {
    flowComment(text || 'テストコメント', 'テストユーザー');
  };

  // バックグラウンドにメッセージを送信（AI用）
  function sendToBackground(author, text) {
    chrome.runtime.sendMessage({
      type: 'NEW_CHAT_MESSAGE',
      author: author || '匿名',
      text: text
    }).catch(() => {
      // バックグラウンドが応答しない場合は無視
    });
  }

  // 画面中央に通知を表示（フワッと出てフワッと消える）
  function showCenterNotification(text) {
    const notification = document.createElement('div');
    notification.className = 'niconico-center-notification';
    notification.textContent = text;
    document.body.appendChild(notification);

    // アニメーション終了後に削除
    notification.addEventListener('animationend', () => {
      notification.remove();
    });

    console.log('[Meet Niconico] Center notification:', text);
  }

  // AIコメントを流す（色を変えて区別）
  function flowAIComment(text) {
    if (!isEnabled || !commentContainer) return;

    const comment = document.createElement('div');
    comment.className = 'niconico-comment ai-comment';

    // AIのコメントには絵文字プレフィックスを付ける
    comment.textContent = `🤖 ${text}`;

    // 縦位置をランダムに設定
    const randomY = Math.random() * 80 + 5;
    comment.style.top = `${randomY}%`;

    // AIコメントは少し長めに表示
    comment.style.animationDuration = '8s';

    commentContainer.appendChild(comment);

    comment.addEventListener('animationend', () => {
      comment.remove();
    });

    console.log('[Meet Niconico] AI Comment:', text);
  }

  // チャットにメッセージを送信
  function sendChatMessage(text) {
    // チャット入力欄を探す（複数のセレクタを試す）
    const inputSelectors = [
      'textarea[aria-label*="メッセージ"]',
      'textarea[aria-label*="Send a message"]',
      'textarea[aria-label*="message"]',
      'textarea[jsname]',
      'div[contenteditable="true"][aria-label*="メッセージ"]',
      'div[contenteditable="true"][aria-label*="message"]'
    ];

    let inputEl = null;
    for (const selector of inputSelectors) {
      inputEl = document.querySelector(selector);
      if (inputEl) break;
    }

    if (!inputEl) {
      console.log('[Meet Niconico] Chat input not found. Is chat panel open?');
      return { success: false, error: 'チャットパネルを開いてください' };
    }

    // テキストを入力
    if (inputEl.tagName === 'TEXTAREA') {
      inputEl.value = text;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // contenteditable の場合
      inputEl.textContent = text;
      inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
    }

    // 送信ボタンを探してクリック
    setTimeout(() => {
      const sendSelectors = [
        'button[aria-label*="送信"]',
        'button[aria-label*="Send"]',
        'button[data-mdc-dialog-action="send"]',
        'button[jsname][data-idom-class*="send"]'
      ];

      let sendBtn = null;
      for (const selector of sendSelectors) {
        sendBtn = document.querySelector(selector);
        if (sendBtn && !sendBtn.disabled) break;
      }

      // 送信ボタンが見つからない場合はEnterキーを送信
      if (!sendBtn || sendBtn.disabled) {
        inputEl.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true
        }));
        console.log('[Meet Niconico] Sent message via Enter key');
      } else {
        sendBtn.click();
        console.log('[Meet Niconico] Sent message via button click');
      }
    }, 100);

    return { success: true };
  }

  // ポップアップ・バックグラウンドからのメッセージを受信
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TEST_COMMENT') {
      flowComment(message.text || 'テストコメント', 'テスト');
      sendResponse({ success: true });
    }
    if (message.type === 'AI_COMMENT') {
      flowAIComment(message.text);
      sendResponse({ success: true });
    }
    if (message.type === 'SEND_CHAT') {
      const result = sendChatMessage(message.text);
      sendResponse(result);
    }
    return true;
  });

  // 初期化
  function init() {
    console.log('[Meet Niconico] Initializing...');

    createCommentContainer();
    createAgendaContainer();
    createAgendaListContainer();
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
