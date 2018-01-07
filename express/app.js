
/**
 * Module dependencies.
 */

var express = require('express');
var path = require('path');
var http = require('http');
var routes = {
    index:  require('./routes/index.js'),
    detail: require('./routes/detail.js'),
    template: require('./routes/template.js'),
    api: {
        image: require('./routes/api/image.js'),
        template: require('./routes/api/template.js')
    }
};

var app = express();
var ECT = require('ect');
var ectRenderer = ECT({ watch: true, root: __dirname + '/views', ext : '.ect' });

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ect');
app.engine('ect', ectRenderer.render);
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
// 静的コンテンツ
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'writable')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// routing
/* 共通の下処理が必要になれば下記の通り設定
app.all('/', function(req, res, next) {
    console.log(req.body);
    next();
});
*/
// index
app.get('/', routes.index.index);
// detail
app.get('/detail', routes.detail.detail);
app.post('/api/image/commit', routes.api.image.commit);
app.post('/api/image/upload', routes.api.image.upload);
app.get('/api/image/list', routes.api.image.list);
app.get('/api/image/get', routes.api.image.detail);
app.post('/api/image/init', routes.api.image.init);
app.get('/api/image/download', routes.api.image.download);
app.get('/api/image/ready', routes.api.image.ready);
// template/edit
app.get('/template/edit', routes.template.edit);
app.get('/api/template/get', routes.api.template.get);
app.post('/api/template/commit', routes.api.template.commit);

app.listen(app.get('port'));

