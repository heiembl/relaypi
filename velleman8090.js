/**
 * Created by roger on 4/18/14.
 */

var SerialPort = require("serialport").SerialPort;

exports.version = '0.0.1';

var Definitions = {
    PACKET_STX:         "04",
    PACKET_ETX:         "0f",
    GET_STATUS:         "18",
    BUTTON_STATE:       "50",
    RETRIEVE_STATUS:    "51",
    TURN_ON:            "11",
    TURN_OFF:           "12",
    TOGGLE:             "14",
    GET_VERSION:        "71"
};

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
        }

        that.watch(tempCallback);

        that.writeDevice(command, [], function(err, result) {
            if (err) {
                return callback(err);
            }
        });

        // Timeout setzen??
    }

    /*
    function pollerEventHandler(err, fd, events) {
        var value = this.readSync(),
            callbacks = this.listeners.slice(0);

        if (this.opts.debounceTimeout > 0) {
            setTimeout(function () {
                if (this.listeners.length > 0) {
                    // Read current value before polling to prevent unauthentic interrupts.
                    this.readSync();
                    this.poller.modify(this.valueFd, Epoll.EPOLLPRI | Epoll.EPOLLONESHOT);
                }
            }.bind(this), this.opts.debounceTimeout);
        }

        callbacks.forEach(function (callback) {
            callback(err, value);
        });
    } */


    this.writeDevice = function(command, relaylist, callback) {

        if( relaylist.length == 0 )


        var relayBinaryMask = 0x00;

        if( Object.prototype.toString.call( relaylist ) === '[object Array]' ) {
            for (var i = 0; i < relaylist.length; i++) {
                relayBinaryMask |= (1 << (relaylist[i] - 1));
            }
        }
        else if(command == Definitions.TOGGLE || command == Definitions.TURN_OFF || command == Definitions.TOGGLE) {
            return callback(null, 0);
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

        hexData += pad(Definitions.PACKET_STX,2);
        checkSum += parseInt(Definitions.PACKET_STX, 16);

        hexData += pad(command);
        checkSum += parseInt(command, 16);

        hexData += pad(relayBinaryMask, 2);
        checkSum += relayBinaryMask;

        hexData += pad("00", 2);
        checkSum += 0;

        hexData += pad("00", 2);
        checkSum += 0;

        hexData += pad(Dec2Hex(0x101 + ~checkSum),2);
        hexData += pad(Definitions.PACKET_ETX);

        var bytes = [];

        for(var i=0; i< hexData.length-1; i+=2){
            bytes.push(parseInt(hexData.substr(i, 2), 16));
        }

        this.serialPortHandler.flush(function(err, results) {
            if(err) {
                console.log('Serial Flush Error: ' + err);
            }
            else {
                //console.log('writeHex: ' + data + " [length=" + data.length + "] writeBinary: " + bytes);
                that.serialPortHandler.write(new Buffer(bytes), callback);
            }
        });
    };

    this.serialPortHandler.on('data', function(hexString) {

        console.log('data received: ' + hexString);

        // Aufbau:
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
            packetCHECKSUM = parseInt(hexString.substr(10, 2), 16),
            packetETX = parseInt(hexString.substr(12, 2), 16);


        var checkSum = 0x101 + ~(packetSTX + packetCMD + packetMASK + packetPARAM1 + packetPARAM2);

        if(checkSum != packetCHECKSUM) {
            console.log("invalid packet checksum!");
            return;
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

            that.listeners.forEach(function (callback) {
                callback(null, that.currentRelayStatus);
            });
        }
        else if( parseInt(Definitions.GET_VERSION, 16) == packetCMD) {

            that.firmware = (packetPARAM1 - 16 + 2010) + "." + packetPARAM2;
            console.log("got firmware version: " + that.firmware);

            that.listeners.forEach(function (callback) {
                callback(null, that.currentRelayStatus);
            });

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
            that.readDevice(Definitions.GET_VERSION, function(err, result) {
                if(err) {
                    console.log('Error on connecting Velleman 8090 card at ' + that.opts.serialInterface + ': ' + error);
                }
                else {
                    console.log('Connected Velleman 8090 card at Interface ' + that.opts.serialInterface  + ' with firmware ' + that.firmware);

                    // Read inital Relay Status
                    that.readDevice(Definitions.GET_STATUS, function(err, result) {
                        // Status geholt!
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

    function addToList(value, relayNr){
        if(value === undefined || value == null) {
            // do nothing
        }
        else if(value == 'on') {
            listOn.push(relayNr);
        }
        else if(value == 'off') {
            listOff.push(relayNr);
        }
        else if(value == 'toggle') {
            listToggle.push(relayNr);
        }
    }

    addToList(value.relay1, 1);
    addToList(value.relay2, 2);
    addToList(value.relay3, 3);
    addToList(value.relay4, 4);
    addToList(value.relay5, 5);
    addToList(value.relay6, 6);
    addToList(value.relay7, 7);
    addToList(value.relay8, 8);


    var that = this;
    that.writeDevice(Definitions.TURN_OFF, listOff, function(err, result) {
        if(err) {
            return callback(err);
        }

        that.writeDevice(Definitions.TURN_ON, listOn, function(err, result) {
            if(err) {
                return callback(err);
            }

            that.writeDevice(Definitions.TOGGLE, listToggle, function(err, result) {
                if(err) {
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
 * Stop watching for hardware interrupts on the GPIO.
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

/**
 * Remove all watchers for the Status.
 */
Velleman8090.prototype.unwatchAll = function() {
    this.unwatch();
};

