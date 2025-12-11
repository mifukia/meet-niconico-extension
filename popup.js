// Meet Niconico Comments - Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const enableToggle = document.getElementById('enableToggle');
  const testInput = document.getElementById('testInput');
  const testBtn = document.getElementById('testBtn');
  const status = document.getElementById('status');

  // 設定を読み込む
  chrome.storage.sync.get(['enabled'], (result) => {
    enableToggle.checked = result.enabled !== false;
  });

  // トグル変更時に設定を保存
  enableToggle.addEventListener('change', () => {
    const enabled = enableToggle.checked;
    chrome.storage.sync.set({ enabled }, () => {
      showStatus(enabled ? 'コメント表示を有効にしました' : 'コメント表示を無効にしました', 'success');
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
    // 現在のタブにメッセージを送信
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];

      if (!tab?.url?.includes('meet.google.com')) {
        showStatus('Google Meet のページを開いてください', 'info');
        return;
      }

      // Content Script にテストコメントを送信
      chrome.tabs.sendMessage(tab.id, { type: 'TEST_COMMENT', text }, (response) => {
        if (chrome.runtime.lastError) {
          // Content Script が読み込まれていない場合、直接実行を試みる
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

    // 3秒後にデフォルトに戻す
    setTimeout(() => {
      status.textContent = 'Google Meet のページで動作します';
      status.className = 'status info';
    }, 3000);
  }
});
