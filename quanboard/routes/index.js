
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Express' })
};

exports.create = function(req, res){
  res.render('create', { title: 'create board' })
}
