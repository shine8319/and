// /dev/ttyFinger
// /dev/ttyUSBJJ
// /dev/ttyRFID


var SerialPort  = require('serialport')
var jjPort = '/dev/ttyUSBJJ';

// setting up the serial connection

var connectArd = function() {
  var jjSerial = new SerialPort();
  jjSerial.open(jjPort, {
    baudRate: 9600,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    flowControl: false
  });

  // do something with incoming data
  jjSerial.on('data', function (data) {
    console.log(data);
  });

  jjSerial.on('close', function(){
    console.log('JJboard PORT CLOSED');
    reconnectArd();
  });

  jjSerial.on('error', function (err) {
    console.error("error", err);
    reconnectArd();
  });

}

connectArd();

// check for connection errors or drops and reconnect
var reconnectArd = function () {
  console.log('INITIATING RECONNECT');
  setTimeout(function(){
    console.log('RECONNECTING TO JJboard');
    connectArd();
  }, 2000);
};
