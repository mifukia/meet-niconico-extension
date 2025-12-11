// Meet Niconico Comments - Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const enableToggle = document.getElementById('enableToggle');
  const aiToggle = document.getElementById('aiToggle');
  const agendaToggle = document.getElementById('agendaToggle');
  const apiSection = document.getElementById('apiSection');
  const agendaSection = document.getElementById('agendaSection');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKey');
  const agendaInput = document.getElementById('agendaInput');
  const saveAgendaBtn = document.getElementById('saveAgendaBtn');
  const csvImport = document.getElementById('csvImport');
  const jsonImport = document.getElementById('jsonImport');
  const shareAgendaBtn = document.getElementById('shareAgendaBtn');
  const testInput = document.getElementById('testInput');
  const testBtn = document.getElementById('testBtn');
  const status = document.getElementById('status');

  // 設定を読み込む
  chrome.storage.sync.get(['enabled', 'aiEnabled', 'agendaEnabled', 'apiKey', 'agendas'], (result) => {
    enableToggle.checked = result.enabled !== false;
    aiToggle.checked = result.aiEnabled === true;
    agendaToggle.checked = result.agendaEnabled !== false;
    apiSection.style.display = result.aiEnabled ? 'block' : 'none';
    agendaSection.style.display = result.agendaEnabled !== false ? 'block' : 'none';
    if (result.apiKey) {
      apiKeyInput.value = '••••••••••••••••';
      apiKeyInput.dataset.saved = 'true';
    }
    // アジェンダを復元
    if (result.agendas) {
      const lines = Object.entries(result.agendas)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([num, text]) => `${num}: ${text}`)
        .join('\n');
      agendaInput.value = lines;
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

  // アジェンダ表示トグル
  agendaToggle.addEventListener('change', () => {
    const agendaEnabled = agendaToggle.checked;
    chrome.storage.sync.set({ agendaEnabled }, () => {
      agendaSection.style.display = agendaEnabled ? 'block' : 'none';
      showStatus(agendaEnabled ? 'アジェンダ表示を有効にしました' : 'アジェンダ表示を無効にしました', 'success');
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

  // アジェンダ保存
  saveAgendaBtn.addEventListener('click', () => {
    const text = agendaInput.value.trim();
    const agendas = {};

    // パース: "1: テキスト" または "1. テキスト" 形式
    const lines = text.split('\n');
    lines.forEach((line) => {
      const match = line.match(/^(\d+)[:\.\s]\s*(.+)$/);
      if (match) {
        agendas[match[1]] = match[2].trim();
      }
    });

    if (Object.keys(agendas).length === 0 && text.length > 0) {
      showStatus('形式: "1: テキスト" で入力してください', 'info');
      return;
    }

    chrome.storage.sync.set({ agendas }, () => {
      showStatus(`${Object.keys(agendas).length}件のアジェンダを保存しました！`, 'success');
    });
  });

  // CSVインポート
  csvImport.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvText = event.target.result;
      const agendas = parseCSV(csvText);

      if (Object.keys(agendas).length === 0) {
        showStatus('CSVからアジェンダを読み取れませんでした', 'info');
        return;
      }

      // テキストエリアに反映
      const lines = Object.entries(agendas)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([num, text]) => `${num}: ${text}`)
        .join('\n');
      agendaInput.value = lines;

      // 保存
      chrome.storage.sync.set({ agendas }, () => {
        showStatus(`CSVから${Object.keys(agendas).length}件のアジェンダをインポートしました！`, 'success');
      });
    };
    reader.readAsText(file);

    // 同じファイルを再選択できるようにリセット
    e.target.value = '';
  });

  // AI/MDインポート（Claude変換結果 or Notion MDエクスポート）
  jsonImport.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result.trim();
      let agendas = {};

      // 1. まずJSONとして解析を試みる
      try {
        // JSONブロックから抽出（```json ... ``` の場合も対応）
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          agendas = JSON.parse(jsonMatch[1]);
        } else if (text.startsWith('{')) {
          agendas = JSON.parse(text);
        }
      } catch (err) {
        // JSONではない場合は無視
      }

      // 2. JSONで取れなかった場合はMarkdownとして解析
      if (Object.keys(agendas).length === 0) {
        agendas = parseMarkdown(text);
      }

      if (Object.keys(agendas).length === 0) {
        showStatus('アジェンダを読み取れませんでした', 'info');
        return;
      }

      // テキストエリアに反映
      const lines = Object.entries(agendas)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([num, text]) => `${num}: ${text}`)
        .join('\n');
      agendaInput.value = lines;

      // 保存
      chrome.storage.sync.set({ agendas }, () => {
        showStatus(`${Object.keys(agendas).length}件のアジェンダをインポートしました！`, 'success');
      });
    };
    reader.readAsText(file);

    e.target.value = '';
  });

  // Markdown解析関数（Notionエクスポート対応）
  function parseMarkdown(mdText) {
    const agendas = {};
    const lines = mdText.split(/\r?\n/);
    let agendaNum = 1;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // パターン1: 番号付きリスト "1. テキスト" or "1) テキスト"
      const numberedMatch = trimmed.match(/^(\d+)[\.\)]\s+(.+)$/);
      if (numberedMatch) {
        agendas[numberedMatch[1]] = numberedMatch[2].trim();
        continue;
      }

      // パターン2: チェックリスト "- [ ] テキスト" or "- [x] テキスト"
      const checklistMatch = trimmed.match(/^-\s+\[[ x]\]\s+(.+)$/i);
      if (checklistMatch) {
        agendas[agendaNum.toString()] = checklistMatch[1].trim();
        agendaNum++;
        continue;
      }

      // パターン3: 箇条書き "- テキスト" or "* テキスト"
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) {
        agendas[agendaNum.toString()] = bulletMatch[1].trim();
        agendaNum++;
        continue;
      }

      // パターン4: 見出し "## テキスト" (h2以下)
      const headingMatch = trimmed.match(/^#{2,}\s+(.+)$/);
      if (headingMatch) {
        agendas[agendaNum.toString()] = headingMatch[1].trim();
        agendaNum++;
        continue;
      }
    }

    return agendas;
  }

  // CSV解析関数
  function parseCSV(csvText) {
    const agendas = {};
    const lines = csvText.split(/\r?\n/);

    // ヘッダー行をスキップするかどうか判定
    let startIndex = 0;
    if (lines.length > 0) {
      const firstLine = lines[0].toLowerCase();
      // Notionのエクスポートでよくあるヘッダーをチェック
      if (firstLine.includes('name') || firstLine.includes('title') || firstLine.includes('番号') || firstLine.includes('アジェンダ')) {
        startIndex = 1;
      }
    }

    let agendaNum = 1;
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // CSVの各行を解析（カンマ区切り、引用符対応）
      const columns = parseCSVLine(line);
      if (columns.length === 0) continue;

      // パターン1: "番号, テキスト" 形式
      if (columns.length >= 2 && /^\d+$/.test(columns[0].trim())) {
        agendas[columns[0].trim()] = columns[1].trim();
      }
      // パターン2: テキストのみ（自動採番）
      else if (columns[0].trim()) {
        agendas[agendaNum.toString()] = columns[0].trim();
        agendaNum++;
      }
    }

    return agendas;
  }

  // CSVの1行を解析（引用符対応）
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  }

  // アジェンダを全員に共有
  shareAgendaBtn.addEventListener('click', () => {
    chrome.storage.sync.get(['agendas'], (result) => {
      const agendas = result.agendas || {};

      if (Object.keys(agendas).length === 0) {
        showStatus('共有するアジェンダがありません', 'info');
        return;
      }

      // JSON形式でチャットに送信するためのテキストを生成
      const shareText = `[AGENDA]${JSON.stringify(agendas)}`;

      // Google Meetのタブを探してチャットに直接送信
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];

        if (!tab?.url?.includes('meet.google.com')) {
          // Meetページでない場合はクリップボードにコピー
          navigator.clipboard.writeText(shareText).then(() => {
            showStatus('クリップボードにコピーしました', 'success');
          });
          return;
        }

        // content scriptにメッセージ送信を依頼
        chrome.tabs.sendMessage(tab.id, { type: 'SEND_CHAT', text: shareText }, (response) => {
          if (chrome.runtime.lastError || !response?.success) {
            // 送信失敗時はクリップボードにコピー
            navigator.clipboard.writeText(shareText).then(() => {
              showStatus(response?.error || 'チャットパネルを開いてください。クリップボードにコピーしました', 'info');
            });
          } else {
            showStatus('アジェンダを全員に共有しました！', 'success');
          }
        });
      });
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
