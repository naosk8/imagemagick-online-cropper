/*
 * GET page to edit template
*/

var path = require('path');

exports.edit = function(req, res){
    var variables = {};
    res.render('template/edit', variables);
};
