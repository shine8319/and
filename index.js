// Setup basic express server
var express = require('express');
// var jjport = require('./routes/jjboard.js')
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var fs = require('fs');
var redis = require("redis")
var ini = require('ini');
var btoa = require('btoa');
var exec = require( "child_process" ).exec;
var config = ini.parse(fs.readFileSync('./settings.ini', 'utf-8'));
console.log(config.redisMaster)
var subscriber = redis.createClient(6379,config.redisMaster.redisIP)
var publisher  = redis.createClient(6379,config.redisMaster.redisIP);
//var io = require('../..')(server);
var io = require('socket.io')(server);
var port = process.env.PORT || 7001;

var fingerverifystart = false;
require('date-util');




subscriber.on("message", function(channel, message) {
  //console.log("Message '" + message + "' on channel '" + channel + "' arrived!")


  if( channel == "Verify" ) IdentifyCallback(message)
  else if( channel == "BACSApiResponse" ) ApiCallback(message)
  else if( channel == "ttyfingerenroll" ) FingerEnrollCallback(message)
  else if( channel == "ttyfingerdelete" ) FingerEnrollCallback(message)
  else if( channel == "ttyfingerguide" ) FingerGuideCallback(message)
  else if( channel == "BACSModule" ) CardCallback(message)

});
// from core (callback)
subscriber.subscribe("Verify");
subscriber.subscribe("BACSApiResponse");

subscriber.subscribe("ttyfingerguide");
subscriber.subscribe("ttyfingerenroll");
subscriber.subscribe("ttyfingerdelete");

subscriber.subscribe("BACSModule");



// function intervalFunc() {
//   //console.log('finger identify');
//   publisher.publish("ttyfinger", "verify");
// }
//
// setInterval(intervalFunc, 1000);


function ApiCallback(message) {
  var parseData = JSON.parse(message);


  var notAcceptable = true
  if( !parseData.hasOwnProperty('response') ) {
    console.log("no exist response property!!")
    return
  }


  if( parseData.response == "user;template;enrollment;") {
    if( !parseData.hasOwnProperty('userid') ) notAcceptable = false
    if( !parseData.hasOwnProperty('templates') ) notAcceptable = false
    if( notAcceptable == false ) {
      console.log("Json parse error!!")
      return
    }
    //console.log(parseData.templates[0].image)
    io.emit('enrollimg', "data:image/png;base64,"+ parseData.templates[0].image);
  }
  else if( parseData.response == "history;verify;") {
    // "BACSApiResponse" "{\"response\":\"history;verify;\",\"date\":\"2018-07-09 20:54:27\",\"module\":52,\"userid\":\"713\",\"verify\":0,\"username\":\"Justin\"}"
    // "BACSApiResponse" "{\"response\":\"history;verify;\",\"date\":\"2018-07-09 21:00:03\",\"module\":52,\"userid\":\"null\",\"verify\":-1,\"username\":\"fail\"}"
    var strModule = "null"
    if( parseData.module == "51" || parseData.module == "54" ) strModule = "Finger"
    else if( parseData.module == '52' ) strModule = "Face"
    else if( parseData.module == '55' ) strModule = "Card"

    if( parseData.userid == "null" || parseData.userid == null) {
      console.log("identify fail")

      io.emit('identifyLog', parseData.date + " - " + "identify fail" + " (" + strModule + ")")
      fs.readFile("/home/bacs/host/public/images/image_02.png", function(err, data){
        io.emit('imageConversionByServer', "data:image/png;base64,"+ data.toString("base64"));
      });
    } else {
      //io.emit('identifyLog', parseData.date + " - " + parseData.username + " (" + parseData.userid + ")")
      io.emit('identifyLog', parseData.date + " - " + "[" + parseData.userid + "]" + parseData.username + " (" + strModule + ")")
      fs.readFile("/home/bacs/Face/faceModule/" + parseData.userid + ".bmp", function(err, data){
        io.emit('imageConversionByServer', "data:image/png;base64,"+ data.toString("base64"));
      });
    }

  }
  else if( parseData.response == "user;account;search;") {
    io.emit('accountsearch', parseData.userids)
    console.log(parseData.userids)
  }

}

// function IdentifyCallback(message) {
// 	console.log("set GUI '" + message)
//   io.emit('identifyLog', message);
//
//   fs.readFile(message, function(err, data){
//     //io.emit('imageConversionByClient', { image: true, buffer: data });
//     io.emit('imageConversionByServer', "data:image/png;base64,"+ data.toString("base64"));
//
//
//     // socket.broadcast.emit('new message', {
//     //   username: socket.username,
//     //   message: data
//     // });
// });
// }
function FingerGuideCallback(message) {
  // var parseData = message.split(';');
  // var msg = parseData[0]

  console.log(message)

  io.emit('fingerenroll',message)

  if( message == "Sensor_fail"){
    subscriber.subscribe("ttyfingerguide");
    subscriber.subscribe("ttyfingerenroll");
    subscriber.subscribe("ttyfingerdelete");
  }

}



function CardCallback(message) {

  console.log(message)

  var parseData = message.split(';');
  var command = parseData[0]
  if( command != 'verify' ) {
      //console.log('not result')
      return
  }
  var success = parseData[1]
  var moduletype = parseData[2]

  // face detect
  if( moduletype == '1' ) {
    if( fingerverifystart == false ) {
      fingerverifystart = true

       publisher.publish("ttyfinger", "verify");
    }
  }

  if( moduletype == '0' ) {

      console.log("finger verify result")
    if( fingerverifystart == true ) {
      fingerverifystart = false
    }
    //var curtime = new Date().format("yyyymmddHHMMss.l");
    var curtime = new Date().format("yyyy-mm-dd HH:MM:ss");
    if( success == '1' ) {

      //"PUBLISH" "Verify" "result;3;0;fail;"
      publisher.publish("Verify", "result;3;0;fail;");
      io.emit('identifyLog', curtime + " - " + "identify fail(fingerprint)");
      fs.readFile("/home/bacs/host/public/images/image_02.png", function(err, data){
        io.emit('imageConversionByServer', "data:image/png;base64,"+ data.toString("base64"));
      });
    }

  }



  if( success != '0' || moduletype != '4' ) return

  var card = parseData[3]

  io.emit('carddata',card)


  console.log(card)

}


function FingerEnrollCallback(message) {
  var parseData = message.split(';');
  var success = parseData[0]
  var data = parseData[1]

  if( success == 1 ) {
    io.emit('fingerenroll','Success')
    // fs.readFile("/home/bacs/host/img/image_bio_finger_s.png", function(err, data){
    //   io.emit('fingerenroll', "data:image/png;base64,"+ data.toString("base64"));
    // });
  } else {
    io.emit('fingerenroll','Fail')
    // fs.readFile("/home/bacs/host/img/image_bio_finger_f.png", function(err, data){
    //   io.emit('fingerenroll', "data:image/png;base64,"+ data.toString("base64"));
    // });
  }
}

function IdentifyCallback(message) {
  var parseData = message.split(';');
  var command = parseData[0]
  if( command != 'result' ) {
      //console.log('not result')
      return
  }
  var module = parseData[1]
  var id = parseData[2]
  var name = parseData[3]
  console.log("name : " + name);
  //var curtime = new Date().format("yyyy-mm-dd HH:MM:ss.l");
  var curtime = new Date().format("yyyy-mm-dd HH:MM:ss");
  var json = {};
  json.response = 'history;verify;'
  json.date = curtime
  json.module = parseInt(module)+0x33
  if( name == 'fail') {
    json.userid = 'null'
    json.verify = -1
  }else {
    json.userid = id
    json.verify = 0
  }
 json.username = name

  publisher.publish("BACSApiResponse", JSON.stringify(json));

  if( module == '4' && json.verify == 0) publisher.publish("Verify", "photo;4;" + id + ";" + name + ";");
}


server.listen(port, () => {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

var numUsers = 0;

io.on('connection', (socket) => {
  var addedUser = false;

  socket.on('faceenroll', function(msg){

    console.log('faceenroll: ' + msg);

    // var parseData = msg.split(';');
    // //cmdtype
    // var id = parseData[0]
    // var name = parseData[1]
    // console.log(id)
    // console.log(name)
    // var json = {};
    // json.request = "user;account;add;"
    // json.userid = id
    // json.username = name
    // publisher.publish("BACSApiRequest", JSON.stringify(json));

    publisher.publish("Enroll", "1;" + msg + ";" + ";;;");
  });
  socket.on('facedelete', function(msg){

    console.log('facedelete: ' + msg);

    var json = {};
    var facemodule = [];
    facemodule[0] = 52
    json.request = "user;template;delete;"
    json.userid = msg
    json.module = facemodule
    publisher.publish("BACSApiRequest", JSON.stringify(json));

  });

  socket.on('fingerenroll', function(msg){

    publisher.publish("ttyfinger", "enroll;" + msg + ";");
    console.log('fingerenroll: ' + msg);
  });
  socket.on('fingerdelete', function(msg){
    publisher.publish("ttyfinger", "delete;" + msg + ";");
    console.log('fingerdelete: ' + msg);
  });
  socket.on('cardenroll', function(msg){
    var parseData = msg.split(';');

    var id = parseData[0]
    var csn = parseData[1]
    console.log(id)
    console.log(csn)
    var json = {};
    var moduletemplate = [];
    //moduletemplate[0] = btoa(csn)

    var b64string = csn
    // var buf = new Buffer(b64string, 'base64').toString("ascii"); // Ta-da
    var buf = new Buffer(b64string, 'ascii').toString("base64"); // Ta-da
    // if (typeof Buffer.from === "function") {
    //     // Node 5.10+
    //     buf = Buffer.from(b64string, 'base64'); // Ta-da
    // } else {
    //     // older Node versions
    //     buf = new Buffer(b64string, 'base64'); // Ta-da
    // }

    moduletemplate[0] = buf
    console.log(moduletemplate[0])
    var moduletype = [];
    moduletype[0] = 55
    json.request = "user;template;add;"
    json.userid = id
    json.module = moduletype
    json.template = moduletemplate
    publisher.publish("BACSApiRequest", JSON.stringify(json));
    console.log('cardenroll: ' + msg);
  });


  socket.on('accountsearch', function(msg){
    //console.log('accountsearch: ' + msg);
    var json = {};
    json.request = "user;account;search;"
    publisher.publish("BACSApiRequest", JSON.stringify(json));
  });
  socket.on('accountadd', function(msg){
    var parseData = msg.split(';');

    var id = parseData[0]
    var name = parseData[1]
    console.log(id)
    console.log(name)
    var json = {};
    json.request = "user;account;add;"
    json.userid = id
    json.username = name
    publisher.publish("BACSApiRequest", JSON.stringify(json));
  });

  socket.on('restartidentify', function(msg){
    exec("sudo killall BACSModule", function(error, stdout, stderr) {
        if(error !== null) {
            console.log("getLoad : " + error);
        }
    });
    exec("sudo killall ttyFinger", function(error, stdout, stderr) {
        if(error !== null) {
            console.log("getLoad : " + error);
        }
    });
    exec("sudo killall nodejs", function(error, stdout, stderr) {
        if(error !== null) {
            console.log("getLoad : " + error);
        }
    });
  });


  socket.on('accountdelete', function(msg){
    // var parseData = msg.split(';');

    console.log(msg)

    var json = {};
    json.request = "user;account;delete;"
    json.userid = msg
    publisher.publish("BACSApiRequest", JSON.stringify(json));
  });
  // when the client emits 'new message', this listens and executes
  socket.on('new message', (data) => {
    console.log('new message')
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', (username) => {
    console.log('add user')
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', () => {
    console.log('typing')
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', () => {
    console.log('stop typing')
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', () => {
    console.log('disconnect')
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
