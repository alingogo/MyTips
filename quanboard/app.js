
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , io = require('socket.io')
  , mongoose = require('mongoose')
  , form = require('connect-form')

var app = module.exports = express.createServer(
  form({ 
      keepExtensions: true
    , uploadDir: "public/images"
   })
);
var mongoUri = 'http://127.0.0.1:27017/qboards';
var Schema = mongoose.Schema;
var boardschema = new Schema({
      filename :String
    , title    :String
});
var commentschema = new Schema({
    id     :Number,
    board  :String,
    text   :String,
    pos_x  :String,
    pos_y  :String,
    width  :String,
    height :String
});

/**
 * Configuration
 */

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  //app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
  mongoose.connect(mongoUri);
});
var Board   = mongoose.model('Board', boardschema)
var Comment = mongoose.model('Comment', commentschema);

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

/**
 * Routes
 */

app.get('/index', function(req, res){
  Board.find({}, function(err, boards){
    res.render('index', {title: 'Board', boards: boards})
  })
});

app.get('/content/:id', function(req, res){
  Board.find({ _id: req.params.id }, function(err, board){
    Comment.find({ board: req.params.id}, function(err, comments){
      res.render('content', {title: 'quanBoard',comments: comments, board: board});
    });
  });
});

app.get('/create', routes.create);

app.post('/upload', function(req, res, next){
  // connect-form adds the req.form object
  // we can (optionally) define onComplete, passing
  // the exception (if any) fields parsed, and files parsed
  req.form.complete(function(err, fields, files){
    if (err) {
      next(err);
    } else {
      var board = new Board();
      board.filename = files.upload.filename;
      board.title    = fields.title;
      board.save(function(err){
        if (!err) console.log('Success!');
      });
      console.log('\nuploaded %s to %s'
        , files.upload.filename
        , files.upload.path);
      res.redirect('/content/'+board._id);
    }
  });

  // We can add listeners for several form
  // events such as "progress"
  req.form.on('progress', function(bytesReceived, bytesExpected){
    var percent = (bytesReceived / bytesExpected * 100) | 0;
    process.stdout.write('Uploading: %' + percent + '\r');
  });

  req.form.on('fileBegin', function(name, file){
    file.path = req.form.uploadDir + "/" + file.name;
  })
})

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);

/**
 * process
 */

io = io.listen(app)
io.sockets.on('connection', function(socket){

  /* 新規 */
  socket.on('created', function(data){
    console.log(data);
    var mydata = data.my;
    var comment = new Comment();
    comment.id     = mydata.id;
    comment.text   = mydata.text;
    comment.pos_x  = mydata.pos_x;
    comment.pos_y  = mydata.pos_y;
    comment.width  = mydata.width;
    comment.height = mydata.height;
//console.log(comment.pos_y);
    comment.save(function(err){
      if (!err) console.log('Success!');
    });

    socket.broadcast.emit('b_created', {my: mydata});
  });

  /* 移動 */
  socket.on('moved', function(data){
    var mydata = data.my;
    Comment.find({id : mydata.id}, function (err, comment) {
      if (!err && comment) {
        Comment.update( { id: mydata.id }, 
                        { $set: { pos_x: mydata.pos_x,
                                  pos_y: mydata.pos_y
                                }}, 
                        { upsert: false, multi: true }, 
                        function(err) {}
                      );
      } else {
        console.log(err);
      }
    });

    socket.broadcast.emit('b_moved', {my: mydata});   
  });

  /* リサイズ */
  socket.on('resized', function(data){
    var mydata = data.my;
    Comment.find({id : mydata.id}, function (err, comment) {
      if (!err && comment) {
        Comment.update( { id: mydata.id }, 
                        { $set: { width: mydata.width,
                                  height: mydata.height
                                }}, 
                        { upsert: false, multi: true }, 
                        function(err) {}
                      );
      } else {
        console.log(err);
      }
    });

    socket.broadcast.emit('b_resized', {my: mydata});   
  });

  /* 編集 */
  socket.on('edited', function(data){
    var mydata = data.my;
//console.log(data);
    Comment.find({id : mydata.id}, function (err, comment) {
      if (!err && comment.length != 0) {
        Comment.update( { id: mydata.id }, 
                        { $set: {text: mydata.text,
                                }}, 
                        { upsert: false, multi: true }, 
                        function(err) {if(err){console.log("errrrrrrrrrrrrr");}}
                      );
      } else {
        var comment = new Comment();
        comment.board  = data.boardid;
        comment.id     = mydata.id;
        comment.text   = mydata.text;
        comment.pos_x  = mydata.pos_x;
        comment.pos_y  = mydata.pos_y;
        comment.width  = mydata.width;
        comment.height = mydata.height;
//console.log(comment);
        comment.save(function(err){
          if (!err) console.log('Success!');
        });
      }
    });

    socket.broadcast.emit('b_edited', {my: mydata});   
  });

  /* 削除 */
  socket.on('deleted', function(data){
    var mydata = data.my;
    Comment.find({id : mydata.id}, function (err, comment) {
      if (!err && comment) {
        Comment.remove( { id: mydata.id }, 
                        function(err) {}
                      );
      } else {
        console.log(err);
      }
    });

    socket.broadcast.emit('b_deleted', {my: mydata});  
  });

  /* ppt */
  socket.on('showme', function(c){
    var current = {};
    var cnote = null;
    var note = {};
    if ( c.current == '-1' ) {
      current.pos_x = -1;
      cnote = null;    
      Comment.find({}, function (err, comments) {
        if (!err && comments) {
          comments.sort(function(a, b){
            return parseInt(a.pos_x) - parseInt(b.pos_x)
          });
          for (i=0;i<comments.length;i++){
            if ( comments[i].pos_x > current.pos_x ) {
              note = comments[i];
//console.log(note);
              break;   
            }
          }
        } else {
          console.log(err);
        }
        socket.emit('next', {current: cnote, next: note});
        socket.broadcast.emit('next', {current: cnote, next: note});
      });
    } else {
      Comment.find({id: c.current}, function(e, com){
        var cnote = com;
        var note = com;
        Comment.find({}, function (err, comments) {
          if (!err && comments) {
            comments.sort(function(a, b){
              return parseInt(a.pos_x) - parseInt(b.pos_x)
            });
            for (i=0;i<comments.length;i++){
//console.log(i);
//console.log(parseInt(comments[i].pos_x));
//console.log(cnote);
              if ( parseInt(comments[i].pos_x) > parseInt(cnote[0].pos_x) ) {
                note = comments[i];
//console.log("aaa.............");
                break;   
              }
            }
          } else {
            console.log(err);
          }
          socket.emit('next', {current: cnote, next: note});
          socket.broadcast.emit('next', {current: cnote, next: note});
        });
      });
    }

/*
check_send = function(cnote, note){
    Comment.find({}, function (err, comments) {
      if (!err && comments) {
        comments.sort(function(a, b){
          return parseInt(a.pos_x) - parseInt(b.pos_x)
        });
        for (i=0;i<comments.length;i++){
          if ( comments[i].pos_x > current.pos_x ) {
            note = comments[i];
console.log(note);
            break;   
          }
        }
      } else {
        console.log(err);
      }

      socket.emit('next', {current: cnote, next: note});
      socket.broadcast.emit('next', {current: cnote, next: note});
    });
}
*/
  }); //ppt end

});//connection end
