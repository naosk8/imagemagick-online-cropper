/*
 * GET image detail page.
*/

var fs = require('fs');
var path = require('path');
var execSync = require('child_process').execSync;

var Datastore = require('nedb');
var db = {};
db.trim_setting = new Datastore({ filename: path.join(__dirname, '../../db/trim_setting.db') });

exports.detail = function(req, res){
    db.trim_setting.loadDatabase();
    var query = req.query;
    var imagePath = path.join(__dirname, '../public/img/org/');
    var imageData;
    var files = [];

    if (!query.id) {
        res.redirect('/');
        return;
    }

    try {
        // ファイル存在チェック
        fs.statSync(imagePath + query.id);
        files = fs.readdirSync(imagePath + query.id);
        if (files.length > 0) {
            for (var i = 0; i < files.length; i++) {
                var file = new Object(), command, ret;
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

    db.trim_setting.find({key: query.id}, function(err, data) {
        if (data.length > 0) {
            imageData = data[0].data;
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
        var variables = {
            targetId:   query.id,
            imageData:  imageData,
        };
        res.render('detail', variables);
    });
};
