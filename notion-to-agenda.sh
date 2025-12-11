#!/bin/bash
# notion-to-agenda.sh
# NotionからエクスポートしたCSV/MDをClaudeで解析してアジェンダJSONに変換

set -e

# 引数チェック
if [ $# -lt 1 ]; then
  echo "Usage: $0 <file> [output_file]"
  echo "Example: $0 meeting-agenda.md agenda.json"
  echo "         $0 meeting-agenda.csv agenda.json"
  echo ""
  echo "Supported formats: .md, .csv, .txt"
  exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="${2:-agenda.json}"

# ファイル存在チェック
if [ ! -f "$INPUT_FILE" ]; then
  echo "Error: File not found: $INPUT_FILE"
  exit 1
fi

# ファイルの内容を読み込み
FILE_CONTENT=$(cat "$INPUT_FILE")

# 拡張子を取得
EXT="${INPUT_FILE##*.}"

# Claudeに解析させる
echo "Claudeで解析中... ($EXT ファイル)"

claude -p "以下のデータを解析して、会議のアジェンダ（議題）リストに変換してください。

【重要】出力形式は必ず以下のJSONのみ（説明文や前置きは一切不要）:
{\"1\": \"議題1のテキスト\", \"2\": \"議題2のテキスト\", ...}

ルール:
- 議題の番号は1から順番に振る
- 議題のテキストは簡潔に（長すぎる場合は20文字程度に要約）
- 関係ないカラム/行（日付、担当者、メモ、説明文など）は無視
- 議題・トピック・アジェンダとして意味のある項目だけを抽出
- 見出しや箇条書きから議題を判断
- JSONのみ出力（\`\`\`json不要、説明不要）

データ:
$FILE_CONTENT" > "$OUTPUT_FILE"

echo ""
echo "完了: $OUTPUT_FILE"
echo ""
echo "--- 内容 ---"
cat "$OUTPUT_FILE"
echo ""
echo "------------"
echo ""
echo "拡張機能のポップアップで「🤖 AI」ボタンからこのファイルを読み込んでください"
