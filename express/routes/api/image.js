/*
 * GET apis to treat image
*/
var path = require('path');
var fs = require('fs');
var spawn = require('child_process').spawn;
var fm = require('formidable');
var execSync = require('exec-sync');
var _ = require('underscore');

var DEFAULT_WIDTH = 1280;
var DEFAULT_HEIGHT = 1040;

/*
 * GET home page.
*/
exports.list = function(req, res){
    var jsonFilePath = path.join(__dirname, '../../writable/json/trimdata.json');
    var imageData = require(jsonFilePath);
    var variables = {
        idList: Object.keys(imageData),
    };


    res.send(variables);
};

/*
 * POST init image size data.
 */
exports.init = function(req, res){
    var query = req.query;
    var imageMaster = require(path.join(__dirname, '../../writable/json/masterdata.json'));
    var jsonFilePath = path.join(__dirname, '../../writable/json/trimdata.json');

    var imageId = query.imageId;
    var imageDir = path.join(__dirname, '../../../img/org/' + imageId);

    var files = fs.readdirSync(imageDir);
    var resObj = new Object();

    if (files.length === 0) {
        console.log("initialize canceled. selected base image doesn't exist");
        resObj.status = 'failure';
    } else {

        var imageData = require(jsonFilePath);

        // json の更新処理
        var imageObj = {};
        for (key in imageMaster.sizeDetail) {
            var baseFileName = files[0];
            var imageObjPerSize = new Object();
            imageObjPerSize.base    = baseFileName;
            imageObjPerSize.output  = imageMaster.sizeDetail[key]['outputFileName'];
            imageObjPerSize.x       = imageMaster.sizeDetail[key]['defaultX'];
            imageObjPerSize.y       = imageMaster.sizeDetail[key]['defaultY'];
            imageObjPerSize.width   = imageMaster.sizeDetail[key]['width'];
            imageObjPerSize.height  = imageMaster.sizeDetail[key]['height'];
            imageObjPerSize.option  = imageMaster.sizeDetail[key]['option'];
            imageObj[key] = imageObjPerSize;
        }
        imageData[imageId] = imageObj;

        fs.writeFile(jsonFilePath, JSON.stringify(imageData, null, "    "), function (err) {
            console.log(err);
            resObj.status = 'failure';
            res.send(resObj);
            return;
        });

        resObj.status = 'success';
    }
    res.send(resObj);
};

exports.ready = function(req, res) {
    var query = req.query;
    var allImageData   = require(path.join(__dirname, '../../writable/json/trimdata.json'));
    var imageData = allImageData[query.id];
    var resObj = new Object();
    if (!imageData) {
        resObj.status = 'failure';
        res.send(resObj);
        return;
    }

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

};

exports.detail = function(req, res){
    var query = req.query;
    var imagePath = path.join(__dirname, '../../public/img/org/');
    var imageMaster = require(path.join(__dirname, '../../writable/json/masterdata.json'));
    var allImageData   = require(path.join(__dirname, '../../writable/json/trimdata.json'));
    var files = [];
    var idList = [];
    var isImageExists = false;
    var imageData = allImageData[query.id];

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
            if (files.length > 0) {
                for (var i = 0; i < files.length; i++) {
                    var file = new Object(),
                        command,
                        ret;
                    file.name = files[i];
                    file.url = path.join('/img/org/' + query.id, files[i]);
                    var targetImagePath = imagePath + query.id + "/" + files[i];
                    try {
                        command = "identify -format '%w, %h' " + targetImagePath;
                        ret = execSync(command);
                    } catch (e) {
                        command = "convert " + targetImagePath + " -strip " + targetImagePath;
                        ret = execSync(command);
                        command = "identify -format '%w, %h' " + targetImagePath;
                        ret = execSync(command);
                    }
                    file.width = ret.split(',')[0];
                    file.height = ret.split(',')[1];
                    files[i] = file;
                }
                isImageExists = true;
            } else {
                console.log("未登録の画像IDを選択: id="+query.id);
            }
        } catch(e) {
            console.log("未登録の画像IDを選択: id="+query.id);
        }

        if (imageData) {
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
        }
    }
    var variables = {
        targetId: query.id,
        imageData: imageData,
        idList: idList,
        isImageExists: isImageExists,
        baseImageList: files
    };
    res.send(variables);
};

exports.download = function(req, res){
    var query = req.query;
    var destBaseDir = path.join(__dirname, '../../public/img/dest/');
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
    var imageMaster = require(path.join(__dirname, '../../writable/json/masterdata.json'));
    var jsonFilePath = path.join(__dirname, '../../writable/json/trimdata.json');

    var imageId = req.body.imageId;
    var imageData = require(jsonFilePath);

    delete req.body.imageId;
    console.log(req.body);
    // json の更新処理
    for (key in req.body) {
        if (!imageData[imageId][key]) {
            imageData[imageId][key] = new Object();
        }
        imageData[imageId][key]['base'] = req.body[key]['base'];
        imageData[imageId][key]['width'] = parseInt(req.body[key]['width'], 10);
        imageData[imageId][key]['height'] = parseInt(req.body[key]['height'], 10);
        imageData[imageId][key]['x'] = parseInt(req.body[key]['x'], 10) - (imageData[imageId][key]['width'] / 2);
        imageData[imageId][key]['y'] = parseInt(req.body[key]['y'], 10) - (imageData[imageId][key]['height'] / 2);
        imageData[imageId][key]['output'] = req.body[key]['output'];
        imageData[imageId][key]['option'] = (req.body[key]['option']) ? req.body[key]['option'] : null;
    }

    fs.writeFile(jsonFilePath, JSON.stringify(imageData, null, "    "), function (err) {
        console.log(err);
    });

    var resObj = new Object();
    resObj.status = 'success';
    res.send(resObj);
};

/*
 * POST upload image.
 */
exports.upload = function(req, res) {
    var form = new fm.IncomingForm();
    form.parse(req, function(error, fields, files) {
        if (error) {
            throw error;
        }
        for (var key in files) {
            var targetDir = path.join(__dirname, '../../public/img/org/', key);
            try {
                fs.statSync(targetDir);
            } catch(e) {
                fs.mkdirSync(targetDir, 0766);
            }
            var targetPath = path.join(targetDir, files[key].name);
            fs.rename(files[key].path, targetPath, function(err) {
                if(err){
                    console.log("アップロード失敗");
                    throw err;
                }
                fs.unlink(files[key].path, function(){
                    if (err) {
                        throw err;
                    }
                    res.redirect('back');
                });
            });
        }
    });
};

