#! /bin/sh
# 30秒間隔で、各IDに紐づく画像を圧縮していく処理。
cd `dirname $0`
ls ../img/dest | while read ln; do echo grunt optimizeimage-perId:$ln; grunt optimizeimage-perId:$ln; sleep 30s; done
