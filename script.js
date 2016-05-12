var fs = require("fs");
var exec = require('child_process').exec;
var Promise = require('promise');
var _ = require('underscore');

var originalImagePath = "img/org";
var destinationImagePath = "img/dest"

var trimData = require('./json/trimdata.json');
var bkupTrimData = require('./json/bkup/trimdata.json');

_.each(trimData, function(trimDataPerId, id) {
    var destinationDir = destinationImagePath+"/"+id;
    try {
        fs.statSync(destinationDir);
    } catch (e) {
        console.log("mkdir -p "+destinationDir);
        fs.mkdirSync(destinationDir, 0766);
    }

    var promiseList = [];
    _.each(trimDataPerId, function(data, size) {
        // 前回編集時点から存在し、内容に変更がない場合はスキップ
        if ((typeof bkupTrimData[id] !== 'undefined')
            && (typeof bkupTrimData[id][size] !== 'undefined')
            && (JSON.stringify(data) === JSON.stringify(bkupTrimData[id][size]))
        ) {
            console.log("crop skipped.  id="+id+", size="+size);
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
        var command = 'convert '+orgImg+' -crop '+trimSettings+' '+options+' '+optionBeforeOutputFileName+destImg;
        var promise = new Promise(function(onFulfilled, onRejected) {
            exec(command, function(err, stdout, stderr) {
                if(err) {
                    onRejected('ng');
                    // throw err;
                }
                console.log("crop executed. id="+id+", size="+size+", command="+command);
                onFulfilled(id);
            });
        });
        promiseList.push(promise);
    });
    if (promiseList.length === 0) {
        return;
    }

    Promise.all(promiseList).then(function(ret) {
        var optimizeCommand = 'grunt optimizeimage-perId:'+id;
        console.log(optimizeCommand);
        exec(optimizeCommand, function(err, stdout, stderr) {
            if (err) {
                console.log("optimize failed. id:"+id+", command="+optimizeCommand);
                throw err;
            }
            console.log("optimize succeeded. id:"+id+", command="+optimizeCommand);
        });
    });
});
