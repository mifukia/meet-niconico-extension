# Meet Niconico Comments

Google Meet のチャットメッセージをニコニコ動画風に画面上に流す Chrome 拡張機能です。

## インストール方法

1. Chrome で `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」をONにする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. このフォルダ (`meet-niconico-extension`) を選択

## 使い方

1. Google Meet の会議に参加
2. チャットパネルを開く
3. 誰かがチャットを送信すると、メッセージがニコニコ風に画面を流れます

### テスト方法

- 拡張機能のポップアップからテストコメントを送信できます
- または、開発者コンソール (F12) で `testNiconicoComment("テスト")` を実行

## 機能

- チャットメッセージを右から左に流す
- コメントが重ならないようにレーン管理
- ON/OFF 切り替え可能
- テキスト長に応じたアニメーション速度調整

## 注意事項

- Google Meet の DOM 構造が変更されると動作しなくなる可能性があります
- その場合は `content.js` の `extractAndFlowMessage` 関数を調整してください

## アイコンについて

現在のアイコンはプレースホルダーです。カスタムアイコンを使用する場合：

1. `icons/generate-icons.html` をブラウザで開く
2. 各サイズのPNGをダウンロード
3. `icons/` フォルダに配置

## ファイル構成

```
meet-niconico-extension/
├── manifest.json    # 拡張機能の設定
├── content.js       # Meet ページで動作するスクリプト
├── styles.css       # ニコニコ風アニメーション
├── popup.html       # ON/OFF切り替えUI
├── popup.js         # ポップアップの処理
└── icons/           # アイコン
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## ライセンス

MIT
