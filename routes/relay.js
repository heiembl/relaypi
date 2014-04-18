
/*
 * GET users listing.
 */

var Gpio = require('onoff').Gpio,
    led = new Gpio(17, 'out'),
    button = new Gpio(18, 'in', 'both');

button.watch(function(err, value) {
    led.writeSync(value);
});


exports.index = function(req, res){
    res.render('index', { title: 'RelayPi' });
};

exports.list = function(req, res){
  res.send("respond with a resource");
};