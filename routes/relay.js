
/*
 * GET users listing.
 */

var ledStatus = 0;
var lastChangeDate = (new Date()).getTime();

var Gpio = require('onoff').Gpio,
    led = new Gpio(17, 'out'),
    button = new Gpio(18, 'in');

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
    led.unexport();
    button.unexport();
    process.exit();
}

process.on('SIGINT', exit);


exports.index = function(req, res){
    res.render('index', { title: 'RelayPi' });
};

exports.list = function(req, res){
  res.send("respond with a resource");
};
