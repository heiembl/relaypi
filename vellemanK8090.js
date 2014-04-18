/**
 * Created by roger on 4/18/14.
 */

var serialPort = require("serialport").SerialPort;

exports.version = '0.0.1';


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

    for(var i=0; i < relaylist.length; i++) {
        relayBinaryMask |= (1 << (relaylist[i] - 1));
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

/**
 * Constructor. Exports a VellemanK8090 to userspace.
 *
 * The constructor is written to function for both superusers and
 * non-superusers. See README.md for more details.
 *
 * gpio: number      // The Linux GPIO identifier; an unsigned integer.
 * direction: string // Specifies whether the GPIO should be configured as an
 *                   // input or output. The valid values are: 'in', 'out',
 *                   // 'high', and 'low'. 'high' and 'low' are variants of
 *                   // 'out' that configure the GPIO as an output with an
 *                   // initial level of high or low respectively.
 * [edge: string]    // The interrupt generating edge for the GPIO. Can be
 *                   // specified for GPIO inputs and outputs. The edge
 *                   // specified determine what watchers watch for. The valid
 *                   // values are: 'none', 'rising', 'falling' or 'both'.
 *                   // The default value is 'none'. [optional]
 * [options: object] // Additional options. [optional]
 *
 * The options argument supports the following:
 * debounceTimeout: number  // Can be used to software debounce a button or
 *                          // switch using a timeout. Specified in
 *                          // milliseconds. The default value is 0.
 */
function VellemanK8090(serialInterfacePath, options) {
    var valuePath;

    options = options || {};

    this.serialInterfacePath = serialInterfacePath || '/dev/ttyACM0';
    this.opts = {};
    this.opts.baudRate = options.baudRate || 19200;
    this.k8090commands = {
        PACKET_STX:   "04",
        PACKET_ETX:   "0f",
        GET_STATUS:   "18",
        TURN_ON:      "11",
        TURN_OFF:     "12",
        TOGGLE:       "14",
        GET_VERSION:  "71"
    };







    // Read current value before polling to prevent unauthentic interrupts.
    this.readSync();

}
exports.VellemanK8090 = VellemanK8090;



/**
 * Read the Status value asynchronously.
 *
 * [callback: (err: error, value: relay object) => {}] // Optional callback
 */
VellemanK8090.prototype.readStatus = function(callback) {

    /*
    fs.read(this.valueFd, this.readBuffer, 0, 1, 0, function(err, bytes, buf) {
        if (typeof callback === 'function') {
            if (err) return callback(err);
            callback(null, buf[0] === one[0] ? 1 : 0);
        }
    });
    */
};


/**
 * Write Status value asynchronously.
 *
 * value: relay object
 */
VellemanK8090.prototype.writeStatus = function(value) {





    var data = getHexCommand(k8090defs.TURN_OFF, [1,2,3]);
    var bytes = [];

    for(var i=0; i< data.length-1; i+=2){
        bytes.push(parseInt(data.substr(i, 2), 16));
    }

    console.log('writeHex: ' + data + " [length=" + data.length + "] writeBinary: " + bytes);
    serialPort.write(new Buffer(bytes), function(err, results) {
        if(err) {
            console.log("Error on writing: " + err);
        }
        else {

        }
    });


    /*
    var writeBuffer = value === 1 ? one : zero;
    fs.writeSync(this.valueFd, writeBuffer, 0, writeBuffer.length, 0);
    */
};

/**
 * Get GPIO options.
 *
 * Returns - object // Must not be modified
 */
VellemanK8090.prototype.options = function() {
    return this.opts;
};

