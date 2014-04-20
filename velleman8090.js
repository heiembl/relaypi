/**
 * Created by roger on 4/18/14.
 */

var SerialPort = require("serialport").SerialPort;

exports.version = '0.0.1';

// Hexadecimal 2 digit Definitions of the supported Commands of the Velleman 8090 card
var Definitions = {
    PACKET_STX:         "04",
    PACKET_ETX:         "0f",
    GET_STATUS:         "18",
    BUTTON_STATE:       "50",
    RETRIEVE_STATUS:    "51",
    TURN_ON:            "11",
    TURN_OFF:           "12",
    TOGGLE:             "14",
    GET_VERSION:        "71",
    SET_BUTTON_MODE:    "21", //momentary, toggle or timed
    START_TIMER:        "41",
    SET_DELAY:          "42",
    GET_BUTTON_MODE:    "22"
};

//Helper-Functions
function getDefinitionTextFromInt(decValue) {
    if(decValue == parseInt(Definitions.GET_STATUS, 16)) {
        return "GET_STATUS";
    }
    else if(decValue == parseInt(Definitions.BUTTON_STATE, 16)) {
        return "BUTTON_STATE";
    }
    else if(decValue == parseInt(Definitions.RETRIEVE_STATUS, 16)) {
        return "RETRIEVE_STATUS";
    }
    else if(decValue == parseInt(Definitions.TURN_ON, 16)) {
        return "TURN_ON";
    }
    else if(decValue == parseInt(Definitions.TURN_OFF, 16)) {
        return "TURN_OFF";
    }
    else if(decValue == parseInt(Definitions.TOGGLE, 16)) {
        return "TOGGLE";
    }
    else if(decValue == parseInt(Definitions.GET_VERSION, 16)) {
        return "GET_VERSION";
    }
    else {
        return "UNKNOWN";
    }
}

function pad(s,z){s=""+s;return s.length<z?pad("0"+s,z):s}


function flipbit(a)
{
    if (a > 255 ) a ^= (1 << 8);
    a ^= (1 << 0);
    a ^= (1 << 1);
    a ^= (1 << 2);
    a ^= (1 << 3);
    a ^= (1 << 4);
    a ^= (1 << 5);
    a ^= (1 << 6);
    a ^= (1 << 7);

    return a;
}

/**
 * Constructor. Exports a Velleman8090 to userspace.
 *
 * [options: object] // Additional options. [optional]
 *
 * The options argument supports the following:
 * serialInterface:  // set the serial Interface (COM-Port)
 * baudRate: number  // change the serial baudRate
 */
function Velleman8090(options) {

    var that = this;

    options = options || {};

    this.opts = {};
    this.opts.serialInterface = options.serialInterface || '/dev/ttyACM0';
    this.opts.baudRate = options.baudRate || 19200;
    this.opts.debugOutput = options.debugOutput || false;

    // status change listeners
    this.listeners = [];

    this.currentRelayStatus = {
        relay1: "unknown",
        relay2: "unknown",
        relay3: "unknown",
        relay4: "unknown",
        relay5: "unknown",
        relay6: "unknown",
        relay7: "unknown",
        relay8: "unknown"
    };

    this.firmware = "unknown";

    this.serialPortHandler = new SerialPort(this.opts.serialInterface, {
        baudRate: this.opts.baudRate,
        parser: function (emitter, buffer) {
            var hexString = buffer.toString('hex');

            // someday, this should be changed to detected beginning of the packet
            if(hexString.length % 14 != 0) {
                console.log("invalid packet size!");
                return;
            }

            for(var i = 0; i < parseInt(hexString.length / 14); i++) {
                emitter.emit('data', hexString.substr(i * 14, 14));
            }
        },
        disconnectedCallback: function(error) {
            // disconnected callback function
            if(error) {
                console.log('Error on disconnecting Velleman 8090 card at ' + opts.serialInterface + ': ' + error);
            }
            else {
                console.log('Disconnected Velleman 8090 card at ' + opts.serialInterface);
            }
        }

    }, true );


    this.readDevice = function(command, callback) {

        if(command != Definitions.GET_STATUS && command != Definitions.GET_VERSION) {
            return callback("Error: Only status and firmware can be read");
        }

        var tempCallback = function(err, result) {
            that.unwatch(tempCallback);
            callback(err, result);
        };

        that.watch(tempCallback);

        that.writeDevice(command, [], function(err, result) {
            if (err) {
                // on error return immediatly
                return tempCallback(err, result);
            }
        });

        // Timeout setzen??
    };

    this.notifyStatusChanged = function(err) {
        // make copy of listeners
        var callbacks = that.listeners.slice(0);

        callbacks.forEach(function (callback) {
            if(err) {
                callback(err);
            }
            else {
                callback(null, that.currentRelayStatus);
            }
        });
    };

    this.writeDevice = function(command, relaylist, callback) {

        var relayBinaryMask = 0x00,
            i = 0;

        if( Object.prototype.toString.call( relaylist ) === '[object Array]' ) {
            for (i = 0; i < relaylist.length; i++) {
                relayBinaryMask |= (1 << (relaylist[i] - 1));
            }
        }

        // filter empty relaylist on ON, OFF && Toggle commands
        if(relayBinaryMask == 0 && ( command == Definitions.TOGGLE || command == Definitions.TURN_OFF || command == Definitions.TURN_ON)) {
            return callback(null, 0);
        }

        // Packet content:
        // 8-Bit STX
        // 8-Bit COMMAND
        // 8-Bit MASK
        // 8-Bit PARAM1
        // 8-Bit PARAM2
        // 8-BIT CHECKSUM
        // 8-BIT ETX
        var checkSum = 0;
        var hexData = "";

        hexData += pad(Definitions.PACKET_STX,2);
        checkSum += parseInt(Definitions.PACKET_STX, 16);

        hexData += pad(command);
        checkSum += parseInt(command, 16);

        hexData += pad(relayBinaryMask.toString(16), 2);
        checkSum += relayBinaryMask;

        hexData += pad("00", 2);
        checkSum += 0;

        hexData += pad("00", 2);
        checkSum += 0;

        hexData += pad((parseInt(flipbit(checkSum) + 1)).toString(16),2);
        hexData += pad(Definitions.PACKET_ETX);

        var bytes = [];

        for( i=0; i< hexData.length-1; i+=2){
            bytes.push(parseInt(hexData.substr(i, 2), 16));
        }

        console.log("-- write cmd=" + getDefinitionTextFromInt(parseInt(command, 16)) + ", relaylist=" + relaylist + ", in hex=" + hexData);

        this.serialPortHandler.flush(function(err) {
            if(err) {
                console.log('Serial Flush Error: ' + err);
            }
            else {
                that.serialPortHandler.write(new Buffer(bytes), callback);
            }
        });
    };

    this.serialPortHandler.on('data', function(hexString) {
        // Packet content:
        // 8-Bit STX
        // 8-Bit COMMAND
        // 8-Bit MASK
        // 8-Bit PARAM1
        // 8-Bit PARAM2
        // 8-BIT CHECKSUM
        // 8-BIT ETX
        var i = 0,
            packetSTX = parseInt(hexString.substr(0, 2), 16),
            packetCMD = parseInt(hexString.substr(2, 2), 16),
            packetMASK = parseInt(hexString.substr(4, 2), 16),
            packetPARAM1 = parseInt(hexString.substr(6, 2), 16),
            packetPARAM2 = parseInt(hexString.substr(8, 2), 16),
            packetCHECKSUM = parseInt(hexString.substr(10, 2), 16);
            //packetETX = parseInt(hexString.substr(12, 2), 16);

        var checkSum = flipbit(packetSTX + packetCMD + packetMASK + packetPARAM1 + packetPARAM2) + 1;

        if(checkSum != packetCHECKSUM) {
            console.log("-- received invalid packet (checksum false)! hex:" + hexString);
            return;
        }
        else {
            console.log('-- received valid cmd=' + getDefinitionTextFromInt(packetCMD) + ' in hex:' + hexString);
        }

        if( parseInt(Definitions.RETRIEVE_STATUS, 16) == packetCMD) {

            that.currentRelayStatus.relay1 = ((packetPARAM1 & (1 << 0)) ? 'on' : 'off');
            that.currentRelayStatus.relay2 = ((packetPARAM1 & (1 << 1)) ? 'on' : 'off');
            that.currentRelayStatus.relay3 = ((packetPARAM1 & (1 << 2)) ? 'on' : 'off');
            that.currentRelayStatus.relay4 = ((packetPARAM1 & (1 << 3)) ? 'on' : 'off');
            that.currentRelayStatus.relay5 = ((packetPARAM1 & (1 << 4)) ? 'on' : 'off');
            that.currentRelayStatus.relay6 = ((packetPARAM1 & (1 << 5)) ? 'on' : 'off');
            that.currentRelayStatus.relay7 = ((packetPARAM1 & (1 << 6)) ? 'on' : 'off');
            that.currentRelayStatus.relay8 = ((packetPARAM1 & (1 << 7)) ? 'on' : 'off');

            var relayLog = [];
            for(i = 0; i < 8; i++) {
                relayLog.push("relay" + (i+1) + ":" + ((packetPARAM1 & (1 << i)) ? 'on' : 'off'));
            }

            console.log("got status: " + relayLog);

            that.notifyStatusChanged(null);
        }
        else if( parseInt(Definitions.GET_VERSION, 16) == packetCMD) {

            that.firmware = (packetPARAM1 - 16 + 2010) + "." + packetPARAM2;
            console.log("got firmware version: " + that.firmware);

            that.notifyStatusChanged(null);

        }
        else if( parseInt(Definitions.BUTTON_STATE, 16) == packetCMD) {


            var buttonDown = [];
            for(i = 0; i < 8; i++) {
                if((packetMASK & (1 << i)) ) {
                    buttonDown.push(i+1);
                }
            }
            var buttonPressed = [];
            for(i = 0; i < 8; i++) {
                if((packetPARAM1 & (1 << i)) ) {
                    buttonPressed.push(i+1);
                }
            }
            var buttonUp = [];
            for(i = 0; i < 8; i++) {
                if((packetPARAM2 & (1 << i)) ) {
                    buttonUp.push(i+1);
                }
            }

            console.log("buttons got down:" + buttonDown + " buttons got up:" + buttonUp + " the pressed button:" + buttonPressed);
        }
        else {
            console.log("error: unknown packet type " + packetCMD);
        }

    });

    this.serialPortHandler.on('open', function(error) {
        // connected callback function
        if(error) {
            console.log('Error on connecting Velleman 8090 card at ' + that.opts.serialInterface + ': ' + error);
        }
        else {
            // Read the firmware to check connection
            that.readDevice(Definitions.GET_VERSION, function(err) {
                if(err) {
                    console.log('Error on connecting Velleman 8090 card at ' + that.opts.serialInterface + ': ' + err);
                }
                else {
                    // Read inital Relay Status
                    that.readDevice(Definitions.GET_STATUS, function(err) {
                        if(err) {
                            console.log('Error on retrieving intital status of Velleman 8090 card at ' + that.opts.serialInterface + ': ' + err);
                        }
                        else {
                            console.log('Connected Velleman 8090 card at Interface ' + that.opts.serialInterface  + ' with firmware ' + that.firmware);
                        }
                    });
                }
            });
        }
    });
}
exports.Velleman8090 = Velleman8090;


/**
 * Write Status value asynchronously.
 *
 * value: relay change object
 *
 * {
 *      relay1: "on";
 *      relay2: "toggle";
 *      relay5: "off";
 * }
 *
 * callback: function(error, status)
 */
Velleman8090.prototype.applyRelayChange = function(value, callback) {

    if (typeof callback !== 'function') {
        callback = function() {};

    }

    value = value || {};

    var listOn = [], listOff = [], listToggle = [];
    var errorList = "";

    function addToList(theValue, relayList){
        if(theValue) {
            theValue = theValue.toUpperCase();
            if(theValue == 'ON') {
                listOn = listOn.concat(relayList);
            }
            else if(theValue == 'OFF') {
                listOff = listOff.concat(relayList);
            }
            else if(theValue == 'TOGGLE') {
                listToggle = listToggle.concat(relayList);
            }
            else {
                errorList += "invalid target status: " + theValue + ", ";
                return false;
            }
        }
        return true;
    }

    var isOk = true;
    isOk &= addToList(value.all, [1,2,3,4,5,6,7,8]); // it would be pretty if the user can define aliases themself
    isOk &= addToList(value.relay1, [1]);
    isOk &= addToList(value.relay2, [2]);
    isOk &= addToList(value.relay3, [3]);
    isOk &= addToList(value.relay4, [4]);
    isOk &= addToList(value.relay5, [5]);
    isOk &= addToList(value.relay6, [6]);
    isOk &= addToList(value.relay7, [7]);
    isOk &= addToList(value.relay8, [8]);

    if(!isOk) {
        return callback(errorList);
    }


    var that = this;
    that.writeDevice(Definitions.TURN_OFF, listOff, function(err) {
        if(err) {
            console.log('error on turn off' + err);
            return callback(err);
        }

        that.writeDevice(Definitions.TURN_ON, listOn, function(err) {
            if(err) {
                console.log('error on turn on' + err);
                return callback(err);
            }

            that.writeDevice(Definitions.TOGGLE, listToggle, function(err) {
                if(err) {
                    console.log('error on toggle:' + err);
                    return callback(err);
                }

                that.readDevice(Definitions.GET_STATUS, function(err, result) {
                    if(err) {
                        return callback(err);
                    }

                    callback(null, result );
                });
            });
        });
    });
};

/**
 * Get options.
 *
 * Returns - object // Must not be modified
 */
Velleman8090.prototype.options = function() {
    return this.opts;
};

/**
 * Read the Status value.
 *
 * Returns - object // Must not be modified
 */
Velleman8090.prototype.getStatus = function() {

    return this.currentRelayStatus;
};

/**
 * Watch for hardware interrupts on the relay card
 *
 * callback: (err: error, value: number) => {}
 */
Velleman8090.prototype.watch = function(callback) {

    this.listeners.push(callback);
};

/**
 * Stop watching for status changed
 *
 * if callback is not a function, all listeners will be removed
 */
Velleman8090.prototype.unwatch = function(callback) {
    if (this.listeners.length > 0) {
        if (typeof callback !== 'function') {
            this.listeners = [];
        } else {
            this.listeners = this.listeners.filter(function (listener) {
                return callback !== listener;
            });
        }
    }
};

