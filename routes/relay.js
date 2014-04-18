
/*
 * GET users listing.
 */

var ledstatus = 0;
var lastchangeddate = (new Date()).getTime();

var Gpio = require('onoff').Gpio,
    led = new Gpio(17, 'out'),
    button = new Gpio(18, 'in');

button.watch(function(err, value) {
    console.log(new Date() + 'Button value: ' + value);

    if(value == 1 && (new Date()).getTime() - 250 > lastchangeddate) {
    if(ledstatus == 0 ) {
	ledstatus = 1;
    } else {
	ledstatus = 0;
    }
    lastchangeddate = (new Date()).getTime();

    led.writeSync(ledstatus);
    }
});


exports.index = function(req, res){
    res.render('index', { title: 'RelayPi' });
};

exports.list = function(req, res){
  res.send("respond with a resource");
};
