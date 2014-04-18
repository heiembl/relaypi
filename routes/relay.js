
/*
 * GET users listing.
 *
var ledStatus = 0;
var lastChangeDate = (new Date()).getTime();

var Gpio = require('onoff').Gpio,
    led = new Gpio(24, 'out');
    //button = new Gpio(23, 'in', 'both');

console.log('GPIO initialized');

led.writeSync(1);
setTimeout(function(){ led.writeSync(0) }, 100);

/*
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
*/
/*
function exit() {
    console.log('close GPIO...');
    led.unexport();
    button.unexport();
    process.exit();
}

process.on('SIGINT', exit);
*/

var Velleman8090 = require('../velleman8090').Velleman8090;

var RelayCard = new Velleman8090();

exports.index = function(req, res){
    res.render('index', { title: 'RelayPi' });
};

exports.list = function(req, res){
    res.send(RelayCard.getStatus());
};

exports.change = function(req, res){
    RelayCard.applyRelayChange(req.body, function(err, result) {

        //led.writeSync((result.relay1 == "on" ? 1 : 0));

        res.send(result);
    });

};
