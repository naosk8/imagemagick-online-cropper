var path = require('path');
var fs = require("fs");
var exec = require('child_process').exec;
var Promise = require('promise');
var _ = require('underscore');
var Datastore = require('nedb');
var db = {};

var originalImagePath       = path.join(__dirname, "../img/org");
var destinationImagePath    = path.join(__dirname, "../img/dest");
var partsImagePath          = path.join(__dirname, "../img/parts");

var trimData = {};
var bkupTrimData = {};

db.trim_setting = new Datastore({ filename: path.join(__dirname, '../db/trim_setting.db'), autoload: true });
db.bkup_trim_setting = new Datastore({ filename: path.join(__dirname, '../db/bkup/trim_setting.db'), autoload: true });

var dataInitPromiseList = [];
dataInitPromiseList.push(new Promise(function(resolve, reject) {
    db.trim_setting.find({},function(err, data) { // 全件取得
        if (err != null) { reject(err); }
        trimData = data;
        resolve();
    });
}));
dataInitPromiseList.push(new Promise(function(resolve, reject) {
    db.bkup_trim_setting.find({},function(err, data) { // 全件取得
        if (err != null) { reject(err); }
        bkupTrimData = data;
        resolve();
    });
}));

Promise.all(dataInitPromiseList)
.then(function() {
    var promiseList = [];
    _.each(trimData, function(trimDataForEach, index) {
        var id = trimDataForEach.key;
        var destinationDir = destinationImagePath+"/"+id;
        var trimDataPerId = trimDataForEach.data;
        try {
            fs.statSync(destinationDir);
        } catch (e) {
            console.log("mkdir -p "+destinationDir);
            fs.mkdirSync(destinationDir, 0766);
        }

        promiseList.push(new Promise(function(res) {
            db.bkup_trim_setting.find({key: id}, function(err, data) {
                var bkupTrimDataPerId;
                if (data.length > 0) {
                    bkupTrimDataPerId = data[0].data;
                }
                var promises = cropPerId(id, trimDataPerId, bkupTrimDataPerId);
                if (promises.length == 0) {
                    res();
                } else {
                    Promise.all(promises).then(function() {
                        res(id);
                    });
                }
            });
        }));
    });

    Promise.all(promiseList)
    .then(function(targetIdList) {
        if (targetIdList.length == 0) {
            reject();
            return;
        }
        _.each(targetIdList, function(id) {
            if (!id) {
                return;
            }
            var optimizeCommand = 'grunt optimizeimage-perId:'+id;
            console.log(optimizeCommand);
            console.log("skipped! please exec command manually.");
            return;
            exec(optimizeCommand, function(err, stdout, stderr) {
                if (err) {
                    console.log("optimize failed. id:"+id+", command="+optimizeCommand);
                    throw err;
                }
                console.log("optimize succeeded. id:"+id+", command="+optimizeCommand);
            });
        });
    });
});

function cropPerId(id, trimDataPerId, bkupTrimDataPerId) {
    var destinationDir = destinationImagePath+"/"+id;
    var promiseList = [];
    _.each(trimDataPerId, function(data, size) {
        // 前回編集時点から存在し、内容に変更がない場合はスキップ
        if ((typeof bkupTrimDataPerId !== 'undefined')
            && (typeof bkupTrimDataPerId[size] !== 'undefined')
            && (JSON.stringify(data) === JSON.stringify(bkupTrimDataPerId[size]))
        ) {
//            console.log("crop skipped.  id="+id+", size="+size);
            return;
        }

        var trimSettings = data['width']+"x"+data['height']+"+"+data['x']+"+"+data['y'];
        var orgImg = originalImagePath+"/"+id+"/"+data['base'];
        var destImg = destinationDir+"/"+data['output'];
        var options = (data['option']) ? data['option'] : "";
        var optionBeforeOutputFileName = '';
        if (options.indexOf('-png8') > -1) {
            // convertのoptionではないので、別途実行する。
            options = options.replace("-png8", "");
            optionBeforeOutputFileName = 'png8:';
        }
        var command = 'convert '+orgImg+' -crop '+trimSettings+' '+options+' ';
        // HL.pngのみ、背景が特殊なので別途合成する
        // if (data['output'] == 'HL.png') {
        //     command += partsImagePath+'/bg_HL.png -reverse -composite ';
        // }
        command += optionBeforeOutputFileName+destImg;

        var promise = new Promise(function(resolve, reject) {
            exec(command, function(err, stdout, stderr) {
                if(err) {
                    console.log("error has occured when cropping");
                    reject('ng');// throw err;
                }
                console.log("crop executed. id="+id+", size="+size+", command="+command);
                resolve(id);
            });
        });
        promiseList.push(promise);
    });

    if (promiseList.length > 0) {
        db.bkup_trim_setting.update({key: id}, {key: id, data:trimDataPerId});
    } else {
        console.log("crop skipped.  id="+id);
    }

    return promiseList;
};
