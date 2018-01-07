/*
 * GET apis to treat image
*/
var path = require('path');
var fs = require('fs');
var spawn = require('child_process').spawn;
var fm = require('formidable');
var execSync = require('child_process').execSync;
var _ = require('underscore');

var Datastore = require('nedb');
var db = {};
db.trim_setting = new Datastore({ filename: path.join(__dirname, '../../../db/trim_setting.db'), autoload: true });

var PATH_TO_MASTERDATA      = '../../writable/json/masterdata.json';
var PATH_TO_IMAGE_ORIGINAL_DIR   = '../../../img/original/';
var PATH_TO_IMAGE_ORG_DIR   = '../../../img/org/';
var PATH_TO_IMAGE_DEST_DIR  = '../../../img/dest/';
var DEFAULT_WIDTH = 1280;
var DEFAULT_HEIGHT = 1040;

/*
 * GET home page.
*/
exports.list = function(req, res){
    // 設定データでなく、存在する画像ディレクトリをベースにIDリストを設ける
    var imageDir = path.join(__dirname, PATH_TO_IMAGE_ORG_DIR);
    var dirs = fs.readdirSync(imageDir);

    var variables = {
        idList: dirs, // Object.keys(imageData),
    };

    res.send(variables);
};

function imageInitialize(imageId) {
    var imageMaster = require(path.join(__dirname, PATH_TO_MASTERDATA));
    var imageDir = path.join(__dirname, PATH_TO_IMAGE_ORG_DIR + imageId);
    var files = fs.readdirSync(imageDir);

    if (files.length === 0) {
        return false;
    }

    command = "identify -format '%w, %h' " + path.join(imageDir, files[0]);
    ret = execSync(command).toString();
    width = parseInt(ret.split(',')[0]);
    height = parseInt(ret.split(',')[1]);

    // json の更新処理
    var imageObj = {};
    for (key in imageMaster.sizeDetail) {
        var baseFileName = files[0];
        var imageObjPerSize = new Object();
        imageObjPerSize.base    = files[0];
        imageObjPerSize.output  = files[0];
        imageObjPerSize.x       = width / 2 - height / 4;
        imageObjPerSize.y       = height / 2 - height / 4;
        imageObjPerSize.width   = height / 2;
        imageObjPerSize.height  = height / 2;
        imageObjPerSize.option  = imageMaster.sizeDetail[key]['option'];
        imageObj[key] = imageObjPerSize;
    }
    db.trim_setting.insert({
        key: imageId,
        data: imageObj
    });
    return true;
}

/*
 * POST init image size data.
 */
exports.init = function(req, res){
    var query = req.query;
    var imageId = query.imageId;

    var result = imageInitialize(imageId);
    var resObj = new Object();
    if (result) {
        resObj.status = 'success';
    } else {
        console.log("initialize canceled. selected base image doesn't exist");
        resObj.status = 'failure';
    }
    res.send(resObj);
};

exports.ready = function(req, res) {
    var query = req.query;
    var imageData;
    var resObj = new Object();
    db.trim_setting.find({key: query.id}, function(err, data) {
        if (data.length == 0) {
            resObj.status = 'failure';
            res.send(resObj);
            return;
        }
        imageData = data[0].data;

        for (var key in imageData) {
            imageData[key]['key'] = key;
            var url = path.join('/img/dest/', query.id, imageData[key]['output']);
            imageData[key]['url'] = url;
            try {
                var imageInfo = fs.statSync(path.join(__dirname, '../../public/' + url));
            } catch (e) {
                resObj.status = 'failure';
                res.send(resObj);
                return;
            }
        }
        resObj.status = 'success';
        res.send(resObj);
    });
};

exports.detail = function(req, res){
    var query = req.query;
    var imagePath = path.join(__dirname, PATH_TO_IMAGE_ORG_DIR);
    var imageMaster = require(path.join(__dirname, PATH_TO_MASTERDATA));
    var files = [];
    var idList = [];
    var isImageExists = false;
    var imageData;
    var baseImageList = [];

    if (!query.id) {
        files = fs.readdirSync(imagePath);
        if (files) {
            files.filter(function(file){
                return !fs.statSync(imagePath+file).isFile();
            }).forEach(function (file) {
                idList.push(file);
            });
        }
    } else {
        try {
            // ファイル存在チェック
            fs.statSync(imagePath + query.id);
            files = fs.readdirSync(imagePath + query.id);
            for (var i = 0; i < files.length; i++) {
                var file = new Object(), command, ret;
                file.name = files[i];
                file.url = path.join('/img/org/' + query.id, files[i]);
                var targetImagePath = imagePath + query.id + "/" + files[i];
                try {
                    command = "identify -format '%w, %h' " + targetImagePath;
                    ret = execSync(command).toString();
                } catch (e) {
                    command = "convert " + targetImagePath + " -strip " + targetImagePath;
                    execSync(command);
                    command = "identify -format '%w, %h' " + targetImagePath;
                    ret = execSync(command).toString();
                }
                file.width = parseInt(ret.split(',')[0]);
                file.height = parseInt(ret.split(',')[1]);
                baseImageList[i] = file;
            }

            if (files.length > 0) {
                isImageExists = true;
            } else {
                console.log("未登録の画像IDを選択: id="+query.id);
            }
        } catch(e) {
            console.log("未登録の画像IDを選択: id="+query.id);
        }
    }
    var variables = {
        targetId: query.id,
        imageData: {},
        idList: idList,
        isImageExists: isImageExists,
        baseImageList: baseImageList
    };

    if (isImageExists && query.id) {
        db.trim_setting.find({key: query.id}, function(err, data) {
            if (data.length == 0) {
                res.send(variables);
                return;
            }
            imageData = data[0].data;
            // added trimmed image data path
            for (var key in imageData) {
                imageData[key]['key'] = key;
                var url = path.join('/img/dest/', query.id, imageData[key]['output']);
                imageData[key]['url'] = url;
                try {
                    var imageInfo = fs.statSync(path.join(__dirname, '../../public/' + url));
                    imageData[key]['size'] = (Math.round(imageInfo.size / 100) / 10) + "KB";
                } catch (e) {
                    imageData[key]['size'] = "-";
                }
            }
            variables.imageData = imageData;
            res.send(variables);
        });
    } else {
        res.send(variables);
    }
};

exports.download = function(req, res){
    var query = req.query;
    var destBaseDir = path.join(__dirname, PATH_TO_IMAGE_DEST_DIR);
    var outputZipPath = path.join(__dirname, '../../public/download/'+query.imageId+'.zip');

    process.chdir(destBaseDir);
    var child = spawn('zip', ['-r', outputZipPath, query.imageId]);
    child.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
    });
    child.on('exit', function (code) {
        console.log('child process exited with code ' + code);
        // 圧縮処理実行後に順次配信処理を実行
        try {
            // ファイルの存在チェック
            var buf = fs.readFileSync(outputZipPath);
            res.contentType('zip');
            res.download(outputZipPath, query.imageId+'.zip', function(err) {
                console.log('ファイルダウンロード完了');
                fs.unlink(outputZipPath);
                console.log('zipファイル削除完了');
            });
        } catch (e) {
            console.log("ダウンロード対象のファイルが存在しません");
            res.send("faled to download image file");
        }
    });
};

/*
 * POST commit image size data.
 */
exports.commit = function(req, res){
    var imageId = req.body.imageId;

    delete req.body.imageId;
    // json の更新処理
    var imageDataPerId = {};
    for (key in req.body) {
        imageDataPerId[key] = new Object();
        imageDataPerId[key]['base'] = req.body[key]['base'];
        imageDataPerId[key]['width'] = parseInt(req.body[key]['width'], 10);
        imageDataPerId[key]['height'] = parseInt(req.body[key]['height'], 10);
        imageDataPerId[key]['x'] = parseInt(req.body[key]['x'], 10) - (imageDataPerId[key]['width'] / 2);
        imageDataPerId[key]['y'] = parseInt(req.body[key]['y'], 10) - (imageDataPerId[key]['height'] / 2);
        imageDataPerId[key]['output'] = req.body[key]['output'];
        imageDataPerId[key]['option'] = (req.body[key]['option']) ? req.body[key]['option'] : null;
    }
    db.trim_setting.update({key: imageId}, {
        key: imageId,
        data: imageDataPerId
    });
    var resObj = new Object();
    resObj.status = 'success';
    res.send(resObj);
};

/*
 * POST upload image.
 */
exports.upload = function(req, res) {
    var targetPath = "";
    var form = new fm.IncomingForm();
    var imageId;

    form.multiples = true;
    form.keepExtensions = true;
    form
    .on('field', function(field, image_id) {
        imageId = image_id;
        targetPath = path.join(__dirname, PATH_TO_IMAGE_ORIGINAL_DIR, image_id);
        try {
            fs.statSync(targetPath);
        } catch(e) {
            fs.mkdirSync(targetPath, 0766);
        }
    })
    .on('fileBegin', function(name, file) {
        file.path = path.join(targetPath, file.name);
        console.log(file.path);
    })
    .on('end', function() {
        var cmd = path.join(__dirname, "../../../scripts/convert_original_image_to_cropbase.sh");
        console.log(cmd);
        execSync(cmd);

        // execute initialization
        imageInitialize(imageId);
        // TODO: apply API-ready-check. This is a bad manner to wait for initial image cropping.
        setTimeout(function() {
            res.redirect('back');
        }, 1000);
    })
    .on('error', function(err) {
        console.log("failed to upload.");
        throw err;
    });

    form.parse(req);
};

