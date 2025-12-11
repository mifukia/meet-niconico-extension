// Meet Niconico Comments - Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const enableToggle = document.getElementById('enableToggle');
  const aiToggle = document.getElementById('aiToggle');
  const apiSection = document.getElementById('apiSection');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKey');
  const testInput = document.getElementById('testInput');
  const testBtn = document.getElementById('testBtn');
  const status = document.getElementById('status');

  // 設定を読み込む
  chrome.storage.sync.get(['enabled', 'aiEnabled', 'apiKey'], (result) => {
    enableToggle.checked = result.enabled !== false;
    aiToggle.checked = result.aiEnabled === true;
    apiSection.style.display = result.aiEnabled ? 'block' : 'none';
    if (result.apiKey) {
      apiKeyInput.value = '••••••••••••••••';
      apiKeyInput.dataset.saved = 'true';
    }
  });

  // コメント表示トグル
  enableToggle.addEventListener('change', () => {
    const enabled = enableToggle.checked;
    chrome.storage.sync.set({ enabled }, () => {
      showStatus(enabled ? 'コメント表示を有効にしました' : 'コメント表示を無効にしました', 'success');
    });
  });

  // AIコメントトグル
  aiToggle.addEventListener('change', () => {
    const aiEnabled = aiToggle.checked;
    chrome.storage.sync.set({ aiEnabled }, () => {
      apiSection.style.display = aiEnabled ? 'block' : 'none';
      showStatus(aiEnabled ? 'AIコメントを有効にしました' : 'AIコメントを無効にしました', 'success');
    });
  });

  // APIキー入力欄をクリックしたとき、保存済みなら消す
  apiKeyInput.addEventListener('focus', () => {
    if (apiKeyInput.dataset.saved === 'true') {
      apiKeyInput.value = '';
      apiKeyInput.type = 'password';
    }
  });

  // APIキー保存
  saveApiKeyBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey || apiKey === '••••••••••••••••') {
      showStatus('APIキーを入力してください', 'info');
      return;
    }
    if (!apiKey.startsWith('sk-ant-')) {
      showStatus('正しいAPIキーを入力してください', 'info');
      return;
    }
    chrome.storage.sync.set({ apiKey }, () => {
      apiKeyInput.value = '••••••••••••••••';
      apiKeyInput.dataset.saved = 'true';
      showStatus('APIキーを保存しました！', 'success');
    });
  });

  // テスト送信
  testBtn.addEventListener('click', () => {
    const text = testInput.value.trim() || 'テストコメント';
    sendTestComment(text);
  });

  // Enter キーでも送信
  testInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const text = testInput.value.trim() || 'テストコメント';
      sendTestComment(text);
    }
  });

  // テストコメントを送信
  function sendTestComment(text) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];

      if (!tab?.url?.includes('meet.google.com')) {
        showStatus('Google Meet のページを開いてください', 'info');
        return;
      }

      chrome.tabs.sendMessage(tab.id, { type: 'TEST_COMMENT', text }, (response) => {
        if (chrome.runtime.lastError) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (commentText) => {
              if (typeof window.testNiconicoComment === 'function') {
                window.testNiconicoComment(commentText);
              }
            },
            args: [text]
          }).then(() => {
            showStatus(`"${text}" を送信しました！`, 'success');
            testInput.value = '';
          }).catch(() => {
            showStatus('ページを再読み込みしてください', 'info');
          });
        } else {
          showStatus(`"${text}" を送信しました！`, 'success');
          testInput.value = '';
        }
      });
    });
  }

  // ステータス表示
  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;

    setTimeout(() => {
      status.textContent = 'Google Meet のページで動作します';
      status.className = 'status info';
    }, 3000);
  }
});
