// Meet Niconico Comments - Background Script
// Claude API を呼び出してAIコメントを生成

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// 会話履歴を保持
let conversationHistory = [];
let lastAICommentTime = 0;
const AI_COMMENT_INTERVAL = 30000; // 30秒間隔

// Claude API を呼び出す
async function callClaudeAPI(apiKey, messages) {
  const systemPrompt = `あなたはGoogle Meetの会議に参加しているAIアシスタントです。
チャットの会話を見て、ニコニコ動画のコメントのように短くて面白いツッコミや感想を入れてください。

ルール:
- 20文字以内で簡潔に
- 絵文字OK
- ツッコミ、共感、驚き、笑いなど
- たまに有益な補足情報も
- 日本語で

例:
- "それな"
- "わかる〜"
- "まじか！"
- "草"
- "天才かよ"
- "それ大事"
- "あるある"`;

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `以下の会議チャットの流れを見て、1つだけ短いコメントを返してください:\n\n${messages}`
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Meet Niconico AI] API Error:', error);
      return null;
    }

    const data = await response.json();
    return data.content[0]?.text?.trim();
  } catch (error) {
    console.error('[Meet Niconico AI] Error calling Claude:', error);
    return null;
  }
}

// メッセージハンドラー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NEW_CHAT_MESSAGE') {
    // 会話履歴に追加
    const { author, text } = message;
    conversationHistory.push(`${author || '匿名'}: ${text}`);

    // 最新10件だけ保持
    if (conversationHistory.length > 10) {
      conversationHistory = conversationHistory.slice(-10);
    }

    // API キーを取得してAIコメント生成を試みる
    chrome.storage.sync.get(['apiKey', 'aiEnabled'], async (result) => {
      if (!result.apiKey || !result.aiEnabled) {
        return;
      }

      const now = Date.now();
      // 一定間隔でのみAIコメントを生成（5件以上たまったら）
      if (conversationHistory.length >= 3 && now - lastAICommentTime > AI_COMMENT_INTERVAL) {
        lastAICommentTime = now;

        const messagesText = conversationHistory.join('\n');
        const aiComment = await callClaudeAPI(result.apiKey, messagesText);

        if (aiComment) {
          // Content script にAIコメントを送信
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
              chrome.tabs.sendMessage(tabs[0].id, {
                type: 'AI_COMMENT',
                text: aiComment
              });
            }
          });
        }
      }
    });

    sendResponse({ success: true });
  }

  if (message.type === 'CLEAR_HISTORY') {
    conversationHistory = [];
    lastAICommentTime = 0;
    sendResponse({ success: true });
  }

  return true;
});

console.log('[Meet Niconico AI] Background script loaded');
