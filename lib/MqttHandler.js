const mqtt = require('mqtt');

class MqttHandler {
    constructor(deviceName, host, options) {
        this.mqttClient = null;
        this.deviceName = deviceName.toLowerCase();
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
            console.log(topic.toString());
            console.log(message.toString());
        });
    }
    sendStatus(statusName, msg, retain = false) {
        if (! this.mqttClient.connected) {
            return false;
        }
        var options = {};
        if (retain) {
            options = { retain: true, qos: 1 };
        }
        this.mqttClient.publish(this.deviceName + '/status/' + statusName, msg, options);
    }
}

module.exports = MqttHandler;

