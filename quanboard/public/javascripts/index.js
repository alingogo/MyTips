var newNote = {};
var socket = io.connect();
var new_note_id = "";
var lock = false;

jQuery(function(){
  jQuery.fn.stickyNotes.tempNote = function(note){

    if ( lock ) { return; }
    lock = true;
    var pos_x = 100;
    var pos_y = 760;
    var note_id = (new Date).getTime().toString();
    new_note_id = note_id;

    var _note_content = jQuery(document.createElement('textarea'));
    var _div_note   =       jQuery(document.createElement('div')).addClass('jStickyNote');
    var _div_background = jQuery.fn.stickyNotes.createNoteBackground();

    _div_note.append(_note_content);
    var _div_delete =       $(document.createElement('div'))
                                              .addClass('jSticky-delete')
                                              .click(function(){jQuery.fn.stickyNotes.deleteNote(this);});
    var _div_wrap   =       $(document.createElement('div'))
                                        .addClass("tempnote")
                                        .css({'position':'absolute','top':pos_x,'left':pos_y, 'float' : 'left'})
                                        .attr("id", "note-" + note_id)
                                        .append(_div_background)
                                        .append(_div_note)
                                        .append(_div_delete);
    _div_wrap.addClass('jSticky-medium');
    _div_wrap.draggable({containment: '#sticky-container', scroll: false, stop: function(event, ui){jQuery.fn.stickyNotes.movedNote(note_id)}});


    $('#model').append(_div_wrap);
    jQuery("#note-" + note_id).click(function() {
      return false;
    })
    var note = {"id":note_id,
                "text":"",
                "pos_x": pos_x,
                "pos_y": pos_y,
                "width": jQuery(_div_wrap).width(),
                "height": jQuery(_div_wrap).height()};
    jQuery(_note_content).css({
              'width': jQuery("#note-" + note_id).width() - 44,
              'height': jQuery("#note-" + note_id).height() - 15
    });
  }
});

var stopEdit = function() {
                 text = $("#note-" + new_note_id).find('textarea').val();
                 var _p_note_text =      $(document.createElement('p')).attr("id", "p-note-" + new_note_id)
                                                                       .html("<pre>" + text + "</pre>");
                 $("#note-" + new_note_id).find('textarea').replaceWith(_p_note_text);
                 $("#p-note-" + new_note_id).dblclick(function() {
                        jQuery.fn.stickyNotes.editNote(this);
                 });
                 lock = false;
}

var droppedNote = function(e, ui){
  if (ui.draggable.hasClass("tempnote"))   {
    var pos = ui.draggable.position();

    var pos_sticky = jQuery("#sticky-container").position();
    var note = {
        "id": new_note_id,
        "text": jQuery("#p-note-" + new_note_id).html(),
        "pos_x": parseInt(pos.left - pos_sticky.left),
        "pos_y": parseInt(pos.top - pos_sticky.top),
        "width": 80,
        "height": 60
    }
    var board_id = jQuery("#boardid").text();
    socket.emit('edited', {boardid: board_id, my: note});
    ui.draggable.hide();
    jQuery.fn.stickyNotes.renderNote(note);
    jQuery.fn.stickyNotes.notes.push(note);
  }
}

var edited = function(note) {
  var board_id = jQuery("#boardid").text();
  socket.emit('edited', {boardid: board_id, my: note});
}
var created = function(note) {
  //socket.emit('created', {my: note});
}

var deleted = function(note) {
  var board_id = jQuery("#boardid").text();
  socket.emit('deleted', {boardid: board_id, my: note});
}

var moved = function(note) {
  var board_id = jQuery("#boardid").text();
  socket.emit('moved', {boardid: board_id, my: note});
}

var resized = function(note) {
  var board_id = jQuery("#boardid").text();
  socket.emit('resized', {boardid: board_id, my: note});
}

var showppt = function(){
  var c = jQuery(".current_note");
  var id = "-1";
  if ( c.size() != 0 ) {
    id = c.attr("id").split("-")[1];
  }

  socket.emit('showme', {current: id});
}

/**
 * 初期化
 */
jQuery(document).ready(function() {
  var notes_arr = new Array();
  jQuery(".comment").each(function(i, e){
    var note = {};
    note.id     = jQuery(e).find("p").eq(0).text();
    note.text   = jQuery(e).find("p").eq(1).text();
    note.pos_x  = parseInt(jQuery(e).find("p").eq(2).text());
    note.pos_y  = parseInt(jQuery(e).find("p").eq(3).text());
    note.width  = parseInt(jQuery(e).find("p").eq(4).text());
    note.height = parseInt(jQuery(e).find("p").eq(5).text());
    notes_arr.push(note);
  });

  var options = {
     notes: notes_arr
    ,resizable: true
    ,controls: false
    ,editCallback: edited
    ,createCallback: created
    ,deleteCallback: deleted
    ,moveCallback: moved
    ,resizeCallback: resized
  };
  jQuery("#notes").stickyNotes(options);

  jQuery("#ppt").click(showppt);

  jQuery("#new button.create").click(jQuery.fn.stickyNotes.tempNote);
  jQuery("#new button.over").click(stopEdit);
  jQuery("#sticky-container").droppable({
         drop: droppedNote
  });
  jQuery("#sticky-container").css("background", "url(\"../images/"+jQuery("#bgname").text()+"\") no-repeat top left");
});


/**
 * サーバーを監視して対応する
 */

socket.on('b_created', function(data){
  var mydata = data.my;
  var note = {};
  note.id = mydata.id;
  note.text = mydata.text;
  note.pos_x = parseInt(mydata.pos_x);
  note.pos_y = parseInt(mydata.pos_y);
  note.width = parseInt(mydata.width);
  note.height = parseInt(mydata.height);

  jQuery.fn.stickyNotes.renderNote(mydata);
});

socket.on('b_edited', function(data){
  var mydata = data.my;
  var note = {};
  var _edit = jQuery("#p-note-" + mydata.id);
  if ( _edit.size() != 0 ) {
    _edit.hide('clip', {}, 500, function(){
                                  jQuery(this).html("<pre>" + mydata.text + "</pre>");
                                  jQuery(this).show('clip', {}, 1000, function(){});
                                });
  } else {
    note.id = mydata.id;
    note.text = mydata.text;
    note.pos_x = parseInt(mydata.pos_x);
    note.pos_y = parseInt(mydata.pos_y);
    note.width = parseInt(mydata.width);
    note.height = parseInt(mydata.height);

    jQuery.fn.stickyNotes.renderNote(mydata);
    jQuery.fn.stickyNotes.notes.push(note);   
  }
});

socket.on('b_moved', function(data){
  var mydata = data.my;
  jQuery("#note-" + mydata.id).animate({top: mydata.pos_y, left: mydata.pos_x});
});

socket.on('b_resized', function(data){
  var mydata = data.my;
  jQuery("#note-" + mydata.id).animate({width: mydata.width, height: mydata.height});
});

socket.on('b_deleted', function(data){
  var mydata = data.my;
  jQuery("#note-" + mydata.id).hide("explode", {}, 1000, function(){});
});

socket.on('next', function(data){
  var current = data.current;
  var next = data.next;
  if ( current != null ) { //close and open
    current1 = current[0];
    jQuery(".current_note").animate({top: current1.pos_y,
                                     left: current1.pos_x,
                                     width: current1.width,
                                     height: current1.height},
                                     {complete: function(){
                                       jQuery("#note-" + next.id).animate({top: 50, left: 50, width: 650, height: 650}).css({"z-index": "2000"}).addClass("current_note");
                                       jQuery("#p-note-" + next.id).css({'font-size':'8ex'});
                                     }})
                           .removeClass("current_note")
                           .css({'z-index':'1000'});;
    jQuery("#p-note-" + current1.id).css({"z-index": "1000", 'font-size':'14px'})
  } else {          //only open
    jQuery("#note-" + next.id).animate({top: 50, left: 50, width: 650, height: 650})
                              .css({"z-index": "2000"})
                              .addClass("current_note");
    jQuery("#p-note-" + next.id).css({'font-size':'8ex'});
  }
});
