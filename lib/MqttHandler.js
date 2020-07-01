import {IClientPublishOptions, PacketCallback} from "mqtt";

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
    constructor(deviceName, host, options) {
        this.mqttClient = null;
        this.deviceName = deviceName;
        this.host = host;
        this.options = options;
    }
    connect() {
        this.mqttClient = mqtt.connect(this.host, this.options);
        console.log('ccc');

        this.mqttClient.on('connect', () => {
            this.mqttClient.publish(this.deviceName + '/online', 'online', { retain:true, qos:1 });
            this.mqttClient.subscribe(this.deviceName + '/command/#', function (err) {});
        });

        this.mqttClient.on('message', function (topic, message) {
            console.log(topic);
            console.log(message);
        });
    }
    sendStatus(statusName, msg) {
        this.mqttClient.publish(this.deviceName + '/status/' + statusName, msg);
    }
}

module.exports = MqttHandler;

