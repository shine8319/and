// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var fs = require('fs');
var redis = require("redis")
  , subscriber = redis.createClient()
var io = require('../..')(server);
var port = process.env.PORT || 1234;

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
  });
  socket.on('facecancel', function(msg){

    console.log('facecancel: ' + msg);
  });

  socket.on('fingerenroll', function(msg){

    console.log('fingerenroll: ' + msg);
  });
  socket.on('fingercancel', function(msg){

    console.log('fingercancel: ' + msg);
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


subscriber.on("message", function(channel, message) {
  console.log("Message '" + message + "' on channel '" + channel + "' arrived!")


  if( channel == "Verify" ) IdentifyCallback(message)

});
// from core (callback)
subscriber.subscribe("Verify");

function IdentifyCallback(message) {
	console.log("set GUI '" + message)
  io.emit('identifyLog', message);

  fs.readFile(message, function(err, data){
    //io.emit('imageConversionByClient', { image: true, buffer: data });
    io.emit('imageConversionByServer', "data:image/png;base64,"+ data.toString("base64"));


    // socket.broadcast.emit('new message', {
    //   username: socket.username,
    //   message: data
    // });
});
}
