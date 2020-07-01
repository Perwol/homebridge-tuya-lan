const mqtt = require('mqtt');

class MqttHandler {
    constructor(deviceName, host, options) {
        this.mqttClient = null;
        this.deviceName = deviceName;
        this.host = host;
        this.options = options;
        this.connectionStatus = false;
    }
    connect() {
        this.mqttClient = mqtt.connect(this.host, this.options);
        console.log('ccc');

        this.mqttClient.on('connect', () => {
            this.connectionStatus = true;
            this.mqttClient.publish(this.deviceName + '/online', 'online', { retain:true, qos:1 });
            this.mqttClient.subscribe(this.deviceName + '/command/#', function (err) {});
        });
        this.mqttClient.on('close', () => {
            this.connectionStatus = false;
        });

        this.mqttClient.on('message', function (topic, message) {
            console.log(topic.toString());
            console.log(message.toString());
        });
    }
    sendStatus(statusName, msg) {
        if (this.connectionStatus) {
            return false;
        }
        this.mqttClient.publish(this.deviceName + '/status/' + statusName, msg);
    }
}

module.exports = MqttHandler;

