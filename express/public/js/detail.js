"use strict";

var TYPE_SIZE_ALL = 'ALL';

var mousePosition;  // マウスカーソル位置を保存するオブジェクト
var imageData;      // 各画像サイズの切り出しデータを保存するオブジェクト
var baseImageList;  // 切り出し元の画像リスト
var baseImage;      // 切り出しの元画像
var selectedSize = TYPE_SIZE_ALL;   // 選択されたサイズ名(imageDataのkey)

var wh_xy_relation = {
    'width': 'x',
    'height': 'y'
};
var xy_wh_relation = {
    'x': 'width',
    'y': 'height'
};
var wh_relation = {
    'width': 'height',
    'height': 'width',
};

var app = angular.module('imageCropper', ['ui.bootstrap']);

app.controller('mainCtrl', ['$scope', '$http', '$modal', function($scope, $http, $modal) {
    $scope.isInitialized = false;

    $scope.withSave = true;
    $scope.downloadable = true;
    $scope.imageList = [];
    $scope.baseImageIndex = 0;
    $scope.imageData;
    $scope.saveBtnEnabled = true;
    $scope.targetId;
    $scope.setTargetId = function (targetId) {
        $scope.targetId = targetId;
    };

    $scope.isMenuOpened = false;
    $scope.onClickMenu = function() {
        $scope.isMenuOpened = !$scope.isMenuOpened;
    };

    $scope.open = function (message) {
        var modalInstance = $modal.open({
            templateUrl: 'resultModal.html',
            controller: ModalInstanceCtrl,
            size: 'sm',
            resolve: {
                message: function () {
                    return message;
                }
            }
        });
    };

    var ModalInstanceCtrl = function ($scope, $modalInstance, message) {
        $scope.message = message;
        $scope.ok = function () {
            $modalInstance.dismiss('cancel');
        };
    };

    $scope.save = function() {
        var form = $('#post');
        var button = document.getElementById('saveBtn');
        if (!$scope.saveBtnEnabled) {
            return;
        }
        $scope.saveBtnEnabled = false;
        $.ajax({
            url: form.attr('action'),
            type: form.attr('method'),
            data: form.serialize(),
            timeout: 10000,
            success: function(result, textStatus, xhr) {
                setTimeout(function(){
                    console.log("success");
                    location.reload();
                }, 1500);
                $scope.open('切り出し設定の変更内容を保存しました');
                $scope.saveBtnEnabled = true;
            },
            error: function(xhr, textStatus, error) {
                $scope.open('通信に失敗しました');
                $scope.saveBtnEnabled = true;
            }
        });
    };

}]).controller('baseImageCtrl', ['$scope', '$http', function($scope, $http) {
    $scope.isShow = function() {
        return ($scope.imageList.length > 0) ? true : false;
    };
    $scope.updateImageList = function(imageList) {
        if (imageList.length > 0) {
            $scope.imageList = imageList;
        }
    };
    $scope.updateBaseImageIndex = function(imageIndex) {
        if (!_.isUndefined($scope.imageList[imageIndex])) {
            $scope.baseImageIndex = imageIndex;
            $scope.imageList[imageIndex].active = true;
        }
    };
    $scope.isSelected = function(image) {
        if (image.name == $scope.imageList[$scope.baseImageIndex].name) {
            return 'active';
        }
    };
    $scope.initBaseImage = function() {
        var initUrl = "/api/image/init?imageId=" + $scope.targetId;
        $http({method: 'POST', url: initUrl}).
        success(function(data, status, headers, config) {
            console.log('success');
            // 画像の初期切り出しが完了したことを確認。1秒に1度、計5回ポーリングを行う
            var readyCheckUrl = "/api/image/ready?id=" + $scope.targetId;
            var succeeded = false;
            var pollingSpan = 1000;
            for (var i = 1; i <= 5; i++) {
                setTimeout(function(){
                    if (succeeded) {
                        return;
                    }
                    $http({method: 'GET', url: readyCheckUrl}).
                    success(function(data, status, headers, config) {
                        if (data.status == 'success') {
                            succeeded = true;
                            window.location.href = '/detail?id=' + $scope.targetId;
                        }
                    }).
                    error(function(data, status, headers, config) {
                        console.log("now polling.... try count : " + i);
                    });
                }, pollingSpan * i);
            }
        }).
        error(function(data, status, headers, config) {
            console.log('failure');
        });
    };
}]).controller('imageDataCtrl', ['$scope', function($scope) {
    $scope.commitActionName = "/api/image/commit";
    $scope.isTpl = false;
    $scope.selectedSize = TYPE_SIZE_ALL;
    $scope.isAllSelectMode = function() {
        return ($scope.selectedSize === TYPE_SIZE_ALL) ? true : false;
    };
    $scope.setSelectedSizeAll = function() {
        $scope.selectedSize = TYPE_SIZE_ALL;
        selectedSize = TYPE_SIZE_ALL;
    };
    $scope.setSelectedSize = function(size) {
        $scope.selectedSize = size;
        selectedSize = size;
        setRect();
    };
    $scope.isShow = function() {
        return ($scope.imageData && Object.keys($scope.imageData).length > 0) ? true : false;
    };
    $scope.updateImageData = function(imageData) {
        if (imageData) {
            $scope.imageData = imageData;
            updateAllPreview();
        }
    };
    $scope.addSize = function() {
        var imageDataKeys = _.map(Object.keys($scope.imageData), function(key) {
            return parseInt(key, 10);
        });
        var maxKey = Math.max.apply(null, imageDataKeys);
        var newImageData = $.extend(true, {}, imageData[maxKey]);
        var newSizeKey = maxKey + 1;
        newImageData.id = String(newSizeKey);
        newImageData.key = String(newSizeKey);
        imageData[newSizeKey] = newImageData;
        $scope.imageData = imageData;
    };
    $scope.deleteSize = function(id) {
        delete imageData[id];
        $scope.imageData = imageData;
    };
    init();
}]);

function ready(element) {
    return new Promise(function(resolve, reject) {
        element.onload = function() {
            resolve(true);
        };
        element.onerror = function() {
            reject(false);
        };
    });
}

var initialized = false;
function init() {
    var baseImageElements;
    var p = initData();
    // 全てのベース画像の読み込み後に後続処理を実行する
    Promise.all([p])
    .then(function(){
        baseImageElements = document.querySelectorAll(".imgWrapper > img");
        var promises = _.map(baseImageElements, function(elm) {
            return ready(elm);
        });
        return promises;
    }).then(function resolve() {
        var imageDataScope = angular.element('#imageDataCtrl').scope();
        imageDataScope.imageData = imageData;
        initCanvas();

        // テーブル上で編集対象となるINPUT要素について変更監視を付加
        var changeables = document.getElementsByClassName('changeable');
        _.each(changeables, function(elm) {
            elm.onchange = function(e) {
                updateImageDataByChange(e);
            };
        });
        setTimeout(function(){
            // プレビューの初期表示処理
            updateAllPreview();
        },100);
    }, function reject() {
        console.log('画像データの読み込みに失敗');
    });

    // 画像アップロード関連の処理
    $('input[type=file]').change(function() {
        var file = $(this).prop('files')[0];
        // 画像以外は処理を停止
        if (! file.type.match('image.*')) {
            $('span').html('');
            return;
        }
        var reader = new FileReader();
        /*
        reader.onload = function() {
            var uploadImage = document.getElementById('uploadPreview');
            uploadImage.src = reader.result;
        }
        */
        reader.readAsDataURL(file);
    });
};

// inputタグ内のonchangeイベント用処理
function updateImageDataByChange(e) {
    var size, key, orgVal, convertedVal, orgAspVal, convertedAspVal, checkBtn;
    size = selectedSize;
    key = e.srcElement.name.replace(size+'[','').replace(']', '');
    orgVal = e.srcElement.value;
    // key によって、変更対象を変更する
    switch (key) {
        case 'option':
            imageData[size].option = orgVal;
            break;
        case 'x':
        case 'y':
            orgVal = Math.floor(orgVal);
            convertedVal = convertCenterPositionToClipPosition(size, key, orgVal);
            if (convertedVal == imageData[size][key]) {
                e.srcElement.value = imageData[size][key] + imageData[size][xy_wh_relation[key]] / 2;
                return;
            }
            imageData[size][key] = convertedVal;
            break;
        case 'width':
        case 'height':
            orgVal = Math.floor(orgVal);
            convertedVal = convertWidthAndHeight(size, key, orgVal);
            if (convertedVal == imageData[size][key]) {
                e.srcElement.value = imageData[size][key];
                return;
            }
            checkBtn = document.getElementById(size+'_keepAsp');
            if (checkBtn.checked) {
                // アスペクト比保持の場合の補正
                orgAspVal = Math.round(orgVal * imageData[size]['asp'][wh_relation[key]] / imageData[size]['asp'][key]);
                convertedAspVal = convertWidthAndHeight(size, wh_relation[key], orgAspVal);
                if (convertedAspVal == imageData[size][wh_relation[key]]) {
                    e.srcElement.value = imageData[size][key];
                    //e.srcElement.parentNode.childlen[] imageData[size][wh_relation[key]];
                    return;
                }
                imageData[size][wh_relation[key]] = convertedAspVal;
            }
            imageData[size][key] = convertedVal;
            // 中心点を保持して高さ/幅を変更
            imageData[size].x = imageData[size].center.x - (imageData[size].width / 2);
            imageData[size].y = imageData[size].center.y - (imageData[size].height / 2);
            break;
        default:
            return;
            break;
    }
    setImageData(imageData);
    setRect();
}

function setRect() {
    var scope = angular.element('#baseImageCtrl').scope();
    var baseImage = scope.imageList[scope.baseImageIndex];
    if (_.isUndefined(baseImage) || _.isUndefined(imageData) || _.isUndefined(imageData[selectedSize])) {
        return;
    }

    // 切り取り枠のリセット
    var wrapper = document.getElementById(baseImage.name);
    var canvas = wrapper.querySelector("canvas");
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var rectBaseObject = (imageData[selectedSize]) ? imageData[selectedSize] : imageData[0];
    if (rectBaseObject) {
        ctx.strokeRect(
            rectBaseObject.x * baseImage.scale,
            rectBaseObject.y * baseImage.scale,
            rectBaseObject.width * baseImage.scale,
            rectBaseObject.height * baseImage.scale
        );
    }
}

// width or height を枠内へと補正する
function convertWidthAndHeight(size, wh, v) {
    var key = wh_xy_relation[wh];
    var scope = angular.element('#baseImageCtrl').scope();
    var baseImage = scope.imageList[scope.baseImageIndex];

    v = (v >= 0) ? v : 0;
    v = (imageData[size][key] + v <= baseImage[wh] / baseImage.scale) ? v : (baseImage[wh] / baseImage.scale - imageData[size][key]);
    return v;
}

// size, x or y また現在選択されている中心点のそれら座標からimageDataにセットすべき x or yを導く
function convertCenterPositionToClipPosition(size, xy, v) {
    var key = xy_wh_relation[xy];
    var scope = angular.element('#baseImageCtrl').scope();
    var baseImage = scope.imageList[scope.baseImageIndex];

    // 中心座標から選択範囲の左上の座標に切り替える
    v = v - (imageData[size][key] / 2);
    v = (v >= 0) ? v : 0;
    v = (v <= (baseImage[key] / baseImage.scale - (imageData[size][key]))) ? v : (baseImage[key] / baseImage.scale - (imageData[size][key]));
    return v;
}

// canvasの表示欄の初期化
function initCanvas() {
    var x, y, rectBaseObject, rectWidth, rectHeight, railhead;
    var xy = document.getElementsByClassName('xy')[0];
    var elemX = document.getElementById('onmouseX');
    var elemY = document.getElementById('onmouseY');
    var baseX = document.getElementById('base_x');
    var baseY = document.getElementById('base_y');
    var isDragging = false;

    // 表示領域の幅を取得
    var windowWidth = window.innerWidth;
    // canvasの表示幅を取得
    var canvasWidth = windowWidth * 0.4;
    var maxCanvasHeight = window.innerHeight * 0.7;
    var baseCanvasElements = document.querySelectorAll(".imgWrapper > canvas");

    var scope = angular.element('#baseImageCtrl').scope();
    _.each(baseCanvasElements, function(canvas, i) {
        // 縮尺計算
        var scale = canvasWidth / canvas.width;
        scale = (canvas.height * scale > maxCanvasHeight) ? (maxCanvasHeight / canvas.height) : scale;
        baseImageList[i].scale = scale;
        baseImageList[i].width = parseInt(canvas.width * scale, 10);
        baseImageList[i].height = parseInt(canvas.height * scale, 10);
        scope.updateImageList(baseImageList);
        scope.$apply(); // imageListの更新をscope外から実施するため。

        canvas.width = baseImageList[i].width;
        canvas.height = baseImageList[i].height;

        canvas.onmouseover = function(e) {
            xy.style.display = "block";
        };
        canvas.onmouseout = function(e) {
            xy.style.display = "none";
        };
        canvas.onmousemove = function(e) {
            setXY(e);
            if (isDragging) {
                railhead = e.target.getBoundingClientRect();
                var ctx = this.getContext("2d");
                ctx.clearRect(0, 0, this.width, this.height);
                ctx.strokeRect(e.clientX - railhead.left - rectWidth / 2, e.clientY - railhead.top - rectHeight / 2, rectWidth, rectHeight);
            }
        };

        canvas.onmousedown = function(e) {
            var baseImage = scope.imageList[scope.baseImageIndex];
            var rectBaseObject = (imageData[selectedSize]) ? imageData[selectedSize] : imageData[0];
            isDragging = true;

            rectWidth = parseInt(rectBaseObject.width * baseImage.scale, 10);
            rectHeight = parseInt(rectBaseObject.height * baseImage.scale, 10);

            railhead = e.target.getBoundingClientRect();
            var ctx = this.getContext("2d");
            ctx.clearRect(0, 0, this.width, this.height);
            ctx.strokeRect(e.clientX - railhead.left - rectWidth / 2, e.clientY - railhead.top - rectHeight / 2, rectWidth, rectHeight);
        };

        canvas.onmouseup = function(e) {
            isDragging = false;
            setImagePosition(e);
            scope.$apply(); // imageListの更新をscope外から実施するため。
        };
    });

    // 画像中のカーソルのポジションを表示する
    function setXY(e)
    {
        xy.style.top = parseInt(e.pageY, 10)+10+"px";
        xy.style.left = parseInt(e.pageX, 10)+10+"px";

        mousePosition = getMousePosition(e);
        elemX.innerHTML = mousePosition.x;
        elemY.innerHTML = mousePosition.y;
    }

    // 画像のx,y座標をセット
    function setImagePosition(e)
    {
        // クリック時の終点の座標を取得する
        mousePosition = getMousePosition(e);
        elemX.innerHTML = mousePosition.x;
        elemY.innerHTML = mousePosition.y;

        // imageDataの基準点を更新
        if (selectedSize === TYPE_SIZE_ALL) {
            baseX.innerHTML = mousePosition.x;
            baseY.innerHTML = mousePosition.y;
        }
        _.each(imageData, function(data, size) {
            // 特定のサイズに関する調整の際の考慮
            if ((selectedSize !== TYPE_SIZE_ALL) && (selectedSize != size)) {
                return;
            }

            data.base = scope.imageList[scope.baseImageIndex].name;
            data.x = convertCenterPositionToClipPosition(size, 'x', mousePosition.x);
            data.y = convertCenterPositionToClipPosition(size, 'y', mousePosition.y);
        });
        setImageData(imageData);
    }
}

// イメージオブジェクトの更新と、関連する要素の更新を行なう
function setImageData(orgData)
{
    _.each(orgData, function(data) {
        // アスペクト比保持用の項目を追加
        data['asp'] = [];
        data['asp']['width'] = data['width'];
        data['asp']['height'] = data['height'];
        // 幅の調整時用に中心位置を追加
        data['center'] = [];
        data['center']['x'] = data['x'] + (data['width'] / 2);
        data['center']['y'] = data['y'] + (data['height'] / 2);
    });
    imageData = orgData;
    var scope = angular.element('#imageDataCtrl').scope();
    scope.updateImageData(imageData);
}

// 表示初期化のためのajax処理
// promiseを返す
function initData()
{
    return new Promise(function(resolve, reject) {
        var requestParams = getQueryString();
        var baseImageGetUrl = '/api/image/get';
        var requestUrl = baseImageGetUrl+'/?id='+requestParams['id'];
        sendRequest("GET", requestUrl, false, false, function(res) {
            var parsedRes = JSON.parse(res.response);
            if (!parsedRes.targetId || parsedRes.baseImageList.length === 0) {
                var imageDataDiv = document.getElementById('imageDataCtrl');
                imageDataDiv.style.display = 'none';
            }

            // set target id
            var mainScope = angular.element('#mainCtrl').scope();
            mainScope.setTargetId(parsedRes.targetId);
            baseImageList = _.map(parsedRes.baseImageList, function(image, key) {
                image.index = key;
                return image;
            });

            var baseImageScope = angular.element('#baseImageCtrl').scope();
            baseImageScope.updateImageList(baseImageList);
            baseImageScope.updateBaseImageIndex(0);

            if (parsedRes.imageData && Object.keys(parsedRes.imageData).length > 0) {
                setImageData(parsedRes.imageData);
                mainScope.isInitialized = true;
            }
            initialized = true;
            resolve();
        });
    });
}

function updatePreview(size, canvas)
{
    var data = imageData[size];
    var drawWidth   = data.width;
    var drawHeight  = data.height;

    if (!canvas) {
        canvas = document.getElementById(size+'_prev');
    }

    // 初期化:translate, scale情報も初期化したいので、canvasサイズを変更することで初期化
    if (data.option && data.option.indexOf("-resize") !== -1) {
        var options = data.option.split(" ");
        var resizeSetting, isNextResizeSetting = false;
        _.each(options, function(option) {
            if (isNextResizeSetting) {
                resizeSetting = option.split("x");
                isNextResizeSetting = false;
            }
            if (option == '-resize') {
                isNextResizeSetting = true;
            }
        });
        drawWidth       = parseInt(resizeSetting[0], 10);
        drawHeight      = parseInt(resizeSetting[1], 10);
    }
    canvas.width = drawWidth;
    canvas.height = drawHeight;

    var ctx = canvas.getContext('2d');

    // 反転チェック
    if (data.option && data.option.indexOf("-flop") !== -1) {
        ctx.translate(drawWidth, 0);
        ctx.scale(-1, 1);
    }

    var trimLeftTopX = data.x;
    var trimLeftTopY = data.y;

    var baseImage = document.getElementById(data.base).querySelector("img");

    // 引数 : (元画像, 切取り始点X, 切取り始点Y, 切取り幅, 切取り高さ, 描画始点X, 描画始点Y, 描画幅, 描画高さ)
    ctx.drawImage(baseImage, trimLeftTopX, trimLeftTopY, data.width, data.height, 0, 0, drawWidth, drawHeight);
}

// イメージオブジェクトをもとにプレビュー表示を更新する
function updateAllPreview()
{
    if (initialized == false) {
        return;
    }
    _.each(imageData, function(data, size) {
        if ((selectedSize !== TYPE_SIZE_ALL) && (selectedSize != size)) {
           return;
        }
        updatePreview(size);
    });
}

function getMousePosition(e)
{
    var imageWrapper, canvas, imgX, imgY, obj, imgWidth, imgHeight, base;
    canvas = e.currentTarget;
    obj = new Object();
    if(e) {
        obj.x = e.pageX;
        obj.y = e.pageY;
    } else {
        obj.x = event.x + document.body.scrollLeft;
        obj.y = event.y + document.body.scrollTop;
    }
    imgX = canvas.parentNode.offsetLeft;
    imgY = canvas.parentNode.offsetTop;
    imgWidth = canvas.width;
    imgHeight = canvas.height;

    // 画像外を選択範囲とすることを回避。
    obj.x = (obj.x - imgX >= 0) ? (obj.x - imgX) : 0;
    obj.y = (obj.y - imgY >= 0) ? (obj.y - imgY) : 0;
    obj.x = (obj.x > imgWidth) ? imgWidth : obj.x;
    obj.y = (obj.y > imgHeight) ? imgHeight : obj.y;

    _.each(baseImageList, function(baseImage) {
        if (!base && (baseImage.name === canvas.parentNode.id)) {
            base = baseImage;
        }
    });

    obj.x = Math.floor(obj.x / base.scale);
    obj.y = Math.floor(obj.y / base.scale);
    return obj;
}

// クエリパラメータを分割する
function getQueryString()
{
    var result = {};
    if (1 < window.location.search.length) {
        // 最初の1文字 (?記号) を除いた文字列を取得する
        var query = window.location.search.substring(1);
        // クエリの区切り記号 (&) で文字列を配列に分割する
        var parameters = query.split('&');
        _.each(parameters, function(parameter) {
            // パラメータ名とパラメータ値に分割する
            var element = parameter.split('=');
            var paramName = decodeURIComponent(element[0]);
            var paramValue = decodeURIComponent(element[1]);
            // パラメータ名をキーとして連想配列に追加する
            result[paramName] = paramValue;
        });
    }
    return result;
}

// XMLHttpRequestオブジェクト生成
function createHttpRequest()
{
    var xmlhttp = null;
    if(window.ActiveXObject){
        try {
            // MSXML2以降用
            xmlhttp = new ActiveXObject("Msxml2.XMLHTTP");
        } catch (e) {
            try {
                // 旧MSXML用
                xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
            } catch (e2) {

            }
        }
    } else if(window.XMLHttpRequest){
        // Win Mac Linux m1,f1,o8 Mac s1 Linux k3用
        xmlhttp = new XMLHttpRequest();
    } else {

    }
    if (xmlhttp == null) {
        alert("Can not create an XMLHTTPRequest instance");
    }
    return xmlhttp;
}

// ファイルにアクセスし受信内容を確認
function sendRequest(method, url, data, async, callback)
{
    var xmlhttp = createHttpRequest();
    // 受信時に起動するイベント
    xmlhttp.onreadystatechange = function() {
        // readyState値は4で受信完了
        if (xmlhttp.readyState == 4) {
            callback(xmlhttp);
        }
    }
    xmlhttp.open(method, url, async);
    xmlhttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    xmlhttp.send(data);
}
