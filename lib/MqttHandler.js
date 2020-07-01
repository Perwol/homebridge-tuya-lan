const mqtt = require('mqtt');

class MqttHandler {
    constructor(deviceName, host, options, accessory) {
        this.mqttClient = null;
        this.deviceName = deviceName.toLowerCase();
        this.host = host;
        this.options = options;
        this.accessory = accessory;
    }
    connect() {
        this.mqttClient = mqtt.connect(this.host, this.options);
        console.log('ccc');

        this.mqttClient.on('connect', () => {
            this.mqttClient.publish(this.deviceName + '/online', 'online', { retain:true, qos:1 });
            this.mqttClient.subscribe(this.deviceName + '/command/#', function (err) {});
        });

        this.mqttClient.on('message', (topic, msg) => {
            topic = topic.toString();
            msg = msg.toString();

            if (topic.indexOf('timer') !== -1) {
                this.accessory.timerUpdated(msg);
                return;
            }
            if (topic.indexOf('night_mode') !== -1) {
                this.accessory.nightModeUpdated(msg);
                return;
            }
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

