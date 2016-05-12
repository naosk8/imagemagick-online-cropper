/*
 * GET image detail page.
*/

var fs = require('fs');
var path = require('path');
var execSync = require('exec-sync');

exports.detail = function(req, res){
    var query = req.query;
    var imagePath = path.join(__dirname, '../public/img/org/');
    var allImageData   = require(path.join(__dirname, '../writable/json/trimdata.json'));
    var imageData;
    var files = [];

    if (!query.id) {
        res.redirect('/');
    }
    if (query.id) {
        imageData = allImageData[query.id];
        try {
            // ファイル存在チェック
            fs.statSync(imagePath + query.id);
            files = fs.readdirSync(imagePath + query.id);
            if (files.length > 0) {
                for (var i = 0; i < files.length; i++) {
                    var file = new Object(),
                        command,
                        ret;
                    file.name = files[i];
                    file.url = path.join('/img/org/' + query.id, files[i]);
                    command = "identify -format '%w, %h' " + imagePath + query.id + "/" + files[i];
                    ret = execSync(command);
                    file.width = ret.split(',')[0];
                    file.height = ret.split(',')[1];
                    files[i] = file;
                }
            } else {
                console.log("未登録の画像IDを選択: id="+query.id);
            }
        } catch(e) {
            console.log("未登録の画像IDを選択: id="+query.id);
        }

        if (imageData) {
        // added trimmed image data path
            for (var key in imageData) {
                var url = path.join('/img/dest/', query.id, imageData[key]['output']);
                imageData[key]['url'] = url;
                // 初期化直後の遅延対策
                try {
                    var imageInfo = fs.statSync(path.join(__dirname, '../public/' + url));
                    imageData[key]['size'] = (Math.round(imageInfo.size / 100) / 10) + "KB";
                } catch (e) {
                    imageData[key]['size'] = "-";
                }
            }
        }
    }
    var variables = {
        targetId:   query.id,
        imageData:  imageData,
    };
    res.render('detail', variables);
};
