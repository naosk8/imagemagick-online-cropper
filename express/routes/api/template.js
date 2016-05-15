/*
 * GET apis to treat image template
*/
var path = require('path');
var fs = require('fs');
var execSync = require('exec-sync');

var DEFAULT_WIDTH = 1280;
var DEFAULT_HEIGHT = 1040;

var SAMPLE_IMAGE_ID = 'template';

exports.get = function(req, res){
    var imagePath = path.join(__dirname, '../../public/img/org/');
    var imageMaster = require(path.join(__dirname, '../../writable/json/masterdata.json'));
    var files = [];
    var imageData = imageMaster['sizeDetail'];

    files = fs.readdirSync(imagePath + SAMPLE_IMAGE_ID);
    if (files.length > 0) {
        for (var i = 0; i < files.length; i++) {
            var file = new Object(),
                command,
                ret;
            file.name = files[i];
            file.base = files[i];
            file.url = path.join('/img/org/' + SAMPLE_IMAGE_ID, files[i]);
            var targetImagePath = imagePath + SAMPLE_IMAGE_ID + "/" + files[i];
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
    }
    if (imageData) {
        // added trimmed image data path
        for (var key in imageData) {
            imageData[key]['base'] = files[0].base;
            imageData[key]['key'] = key;
        }
    }

    var variables = {
        imageData: imageData,
        isImageExists: true,
        baseImageList: files
    };
    res.send(variables);
};

/*
 * POST commit image size data.
 */
exports.commit = function(req, res){
    var jsonFilePath = path.join(__dirname, '../../writable/json/masterdata.json');
    var imageMaster = require(jsonFilePath);
    var imageTrimData = imageMaster['sizeDetail'];

    delete req.body.imageId;
    // 保存用にtemplateデータを更新
    var newTemplate = new Object();
    for (key in req.body) {
        newTemplate[key] = new Object();
        newTemplate[key]['id'] = key;
        newTemplate[key]['inputFileSuffix'] = req.body[key]['base'];
        newTemplate[key]['output'] = req.body[key]['output'];
        newTemplate[key]['width'] = parseInt(req.body[key]['width'], 10);
        newTemplate[key]['height'] = parseInt(req.body[key]['height'], 10);
        newTemplate[key]['defaultX'] = parseInt(req.body[key]['x'], 10) - (newTemplate[key]['width'] / 2);
        newTemplate[key]['defaultY'] = parseInt(req.body[key]['y'], 10) - (newTemplate[key]['height'] / 2);
        newTemplate[key]['option'] = (req.body[key]['option']) ? req.body[key]['option'] : null;
    }

    imageMaster['sizeDetail'] = newTemplate;
    fs.writeFile(jsonFilePath, JSON.stringify(imageMaster, null, "    "), function (err) {
        if (err) {
            console.log(err);
        }
    });

    var resObj = new Object();
    resObj.status = 'success';
    res.send(resObj);
};

