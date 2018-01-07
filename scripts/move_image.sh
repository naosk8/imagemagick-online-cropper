#!/bin/bash
cd `dirname $0`

if [ $# -ne 1 ]; then
    echo "書き出し先の ace/assets:/data/img/unit のパスを入力してください" 1>&2
    exit 1
fi

echo ""
echo "次のディレクトリに/img/dest/以下のフォルダをコピーします。よろしいですか。"
echo "$1"
echo ""
echo "y or n"
echo ""

read answer

case $answer in
    y)
        echo -e "tyeped yes.\n"
        ls ../img/dest/ | while read ln; do \
            tmp=`echo $ln | sed -e s/unit0// | sed -e s/a/1/ | sed -e s/b/2/ | sed -e s/c/3/ | sed -e s/d/4/`;
            echo "making dir and copying... "  $ln  " => "  $tmp;
#            echo mkdir -p $1/$tmp;
#            echo cp -r ../img/dest/$ln/* $1/$tmp/;
            mkdir -p $1/$tmp;
            cp -r ../img/dest/$ln/* $1/$tmp/;
        done
        ;;
    n)
        echo -e "tyeped no.\n"
        ;;
    *)
        echo -e "cannot understand $answer.\n"
        ;;
esac
