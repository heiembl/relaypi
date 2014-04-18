
/*
 * GET users listing.
 */
/*
var ledStatus = 0;
var lastChangeDate = (new Date()).getTime();

var Gpio = require('onoff').Gpio,
    led = new Gpio(24, 'out'),
    button = new Gpio(23, 'in', 'both');

console.log('GPIO init');

led.writeSync(1);
setTimeout(function(){ led.writeSync(0) }, 100);

button.watch(function(err, value) {
    if (err) exit();

    console.log(new Date() + 'Button value: ' + value);

    if(value == 1 && (new Date()).getTime() - 250 > lastChangeDate) {
        if(ledStatus == 0 ) {
            ledStatus = 1;
        } else {
            ledStatus = 0;
        }
        lastChangeDate = (new Date()).getTime();

        led.writeSync(ledStatus);
    }
});

function exit() {
    console.log('close GPIO...');
    led.unexport();
    button.unexport();
    process.exit();
}

process.on('SIGINT', exit);
*/

var k8090defs = {
    PACKET_STX:   "04",
    PACKET_ETX:   "0f",
    GET_STATUS:   "18",
    RETRIEVE_STATUS: "51",
    TURN_ON:      "11",
    TURN_OFF:     "12",
    TOGGLE:       "14",
    GET_VERSION:  "71"
};

var SerialPort = require("serialport").SerialPort
var serialPort = new SerialPort("/dev/ttyACM0", {
    baudrate: 19200
}, false); // this is the openImmediately flag [default is true]

serialPort.open(function () {
    console.log('opened /dev/ttyACM0');
    serialPort.on('data', function(data) {

        var hexString = data.toString('hex');

        console.log('data received: ' + hexString);

        if(hexString.length != 14) {
            console.log("invalid packet size!")
            return;
        }

        // Aufbau:
        // 8-Bit STX
        // 8-Bit COMMAND
        // 8-Bit MASK
        // 8-Bit PARAM1
        // 8-Bit PARAM2
        // 8-BIT CHECKSUM
        // 8-BIT ETX
        packetSTX = parseInt(hexString.substr(0, 2), 16);
        packetCMD = parseInt(hexString.substr(2, 2), 16);
        packetMASK = parseInt(hexString.substr(4, 2), 16);
        packetPARAM1 = parseInt(hexString.substr(6, 2), 16);
        packetPARAM2 = parseInt(hexString.substr(8, 2), 16);
        packetCHECKSUM = parseInt(hexString.substr(10, 2), 16);
        packetETX = parseInt(hexString.substr(12, 2), 16);


        var checkSum = 0x101 + ~(packetSTX + packetCMD + packetMASK + packetPARAM1 + packetPARAM2);

        if(checkSum != packetCHECKSUM) {
            console.log("invalid packet checksum!");
            return;
        }

        if( parseInt(k8090defs.RETRIEVE_STATUS, 16) == packetCMD) {
            var relayStatus = {
                relay1: ((packetPARAM1 & (1 << 0)) ? 'on' : 'off'),
                relay2: ((packetPARAM1 & (1 << 1)) ? 'on' : 'off'),
                relay3: ((packetPARAM1 & (1 << 2)) ? 'on' : 'off'),
                relay4: ((packetPARAM1 & (1 << 3)) ? 'on' : 'off'),
                relay5: ((packetPARAM1 & (1 << 4)) ? 'on' : 'off'),
                relay6: ((packetPARAM1 & (1 << 5)) ? 'on' : 'off'),
                relay7: ((packetPARAM1 & (1 << 6)) ? 'on' : 'off'),
                relay8: ((packetPARAM1 & (1 << 7)) ? 'on' : 'off')
            }

            var relayLog = [];
            for(var i = 0; i < 8; i++) {
                relayLog.push("relay" + (i+1) + ":" + ((packetPARAM1 & (1 << i)) ? 'on' : 'off'));
            }

            console.log("got status: " + relayLog);

            process.exit();
        }


        if( parseInt(k8090defs.GET_VERSION, 16) == packetCMD) {


            console.log("got firmware version: " + (packetPARAM1 - 16 + 2010) + "." + packetPARAM2 );

            process.exit();
        }


    });


    //Usefull Functions
    function checkBin(n){return/^[01]{1,64}$/.test(n)}
    function checkDec(n){return/^[0-9]{1,64}$/.test(n)}
    function checkHex(n){return/^[0-9A-Fa-f]{1,64}$/.test(n)}
    function pad(s,z){s=""+s;return s.length<z?pad("0"+s,z):s}
    function unpad(s){s=""+s;return s.replace(/^0+/,'')}

//Decimal operations
    function Dec2Bin(n){if(!checkDec(n)||n<0)return 0;return n.toString(2)}
    function Dec2Hex(n){if(!checkDec(n)||n<0)return 0;return n.toString(16)}

//Binary Operations
    function Bin2Dec(n){if(!checkBin(n))return 0;return parseInt(n,2).toString(10)}
    function Bin2Hex(n){if(!checkBin(n))return 0;return parseInt(n,2).toString(16)}

//Hexadecimal Operations
    function Hex2Bin(n){if(!checkHex(n))return 0;return parseInt(n,16).toString(2)}
    function Hex2Dec(n){if(!checkHex(n))return 0;return parseInt(n,16).toString(10)}


    function getHexCommand(command, relaylist) {

        var relayBinaryMask = 0x00;

        if( Object.prototype.toString.call( relaylist ) === '[object Array]' ) {
            for (var i = 0; i < relaylist.length; i++) {
                relayBinaryMask |= (1 << (relaylist[i] - 1));
            }
        }

        // Aufbau:
        // 8-Bit STX
        // 8-Bit COMMAND
        // 8-Bit MASK
        // 8-Bit PARAM1
        // 8-Bit PARAM2
        // 8-BIT CHECKSUM
        // 8-BIT ETX
        var checkSum = 0;
        var hexData = "";

        hexData += pad(k8090defs.PACKET_STX,2);
        checkSum += parseInt(k8090defs.PACKET_STX, 16);

        hexData += pad(command);
        checkSum += parseInt(command, 16);

        hexData += pad(relayBinaryMask, 2);
        checkSum += relayBinaryMask;

        hexData += pad("00", 2);
        checkSum += 0;

        hexData += pad("00", 2);
        checkSum += 0;

        hexData += pad(Dec2Hex(0x101 + ~checkSum),2);
        hexData += pad(k8090defs.PACKET_ETX);

        return hexData;
    };

    var writeDevice = function() {

        var data = getHexCommand(k8090defs.GET_VERSION); //, [1,2,3]
        var bytes = [];

        for(var i=0; i< data.length-1; i+=2){
            bytes.push(parseInt(data.substr(i, 2), 16));
        }

        serialPort.flush(function(err, results) {
            console.log('flush err ' + err);
        });

        console.log('writeHex: ' + data + " [length=" + data.length + "] writeBinary: " + bytes);
        serialPort.write(new Buffer(bytes), function(err, results) {
            console.log('err ' + err);
            //console.log('results ' + results);

            //serialPort.read()
        });
    };

    writeDevice();


});




exports.index = function(req, res){
    res.render('index', { title: 'RelayPi' });
};

exports.list = function(req, res){
  res.send("respond with a resource");
};
