# 加工しやすくなるよう、サイズごとに各IDの画像のサイズを調整する
cd `dirname $0`

ls ../img/original/**/** | \
while read ln; do
    outputpath=`echo $ln | sed -e 's/original/org/g'`;
    # echo $outputpath

    # すでに画像を変換済みであれば、再処理を行わない
    if [ -e $outputpath ]; then
        echo "already exists: " . $outputpath;
        continue;
    fi

    # フォルダの初期化を行う
    dname=$(dirname $outputpath)
    # echo $dname
    if [ -e $dname ]; then
        pass
    else
        mkdirCmd="mkdir -p $dname";
        # echo $mkdirCmd;
        eval $mkdirCmd;
    fi

    # デフォルトの補正コマンド。余白を設けるために、縦横3倍の透過画像の上、中央に元画像を配置する。
    size=(`identify -format "%w %h" $ln`);
    # echo ${size[0]};
    # echo ${size[1]};
    width=`expr ${size[0]} \* 2`;
    height=`expr ${size[1]} \* 2`;
    offsetX=`expr ${size[0]} / 2`;
    offsetY=`expr ${size[1]} / 2`;
    png_outputpath="${outputpath%.*}.png"
    convertCmd=`printf "convert -size %dx%d xc:none $ln -geometry +%d+%d -composite $png_outputpath" $width $height $offsetX $offsetY`;

    echo $convertCmd;
    eval $convertCmd;
done
