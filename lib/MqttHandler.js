const mqtt = require('mqtt');

// 
// mqttClient.on('connect', function () {
// 	client.publish(this.device.context.name + '/online', 'online', { retain:true, qos:1 });
// 	// client.subscribe('milight/command/#', function (err) {
// //     if (! err) {
// // 		avaliableHandlers.forEach(function(element) {
// // 			handlersTimeLeft[element] = 0;
// // 		});
// //     }
//   });
// });

// const fs = require('fs');
// const statusNightModeFile = '/home/pi/.homebridge/WarmtecNightModeStatus';
// const statusHumidityFile = '/home/pi/.homebridge/WarmtecHumidityStatus';
// const statusTimerFile = '/home/pi/.homebridge/WarmtecTimerStatus';

class MqttHandler {
    constructor() {
        console.log('a12');
    }
    setData(deviceName, host, options) {
        console.log('bbb');
        this.deviceName = deviceName;
        this.host = host;
        this.options = options;
    }
    connect() {
        this.mqttClient = mqtt.connect(this.host, this.options);
        console.log('ccc');
        this.mqttClient.on('connect', function () {
            console.log('ddd');
            this.mqttClient.publish(this.deviceName + '/online', 'online', { retain:true, qos:1 });
            // client.subscribe('milight/command/#', function (err) {
            //     if (! err) {
            // 		avaliableHandlers.forEach(function(element) {
            // 			handlersTimeLeft[element] = 0;
            // 		});
            //     }
        });
    }
}

module.exports = MqttHandler;
