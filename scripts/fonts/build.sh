#!/bin/sh
# 同梱フォントの取得とサブセット化。node scripts/fonts/build.mjs の薄い包み
set -e
cd "$(dirname "$0")/../.."
exec node scripts/fonts/build.mjs "$@"
