const BaseAccessory = require('./BaseAccessory');

const STATE_OTHER = 9;
const fs = require('fs');
const statusNightModeFile = '/home/pi/.homebridge/WarmtecNightModeStatus';
const statusHumidityFile = '/home/pi/.homebridge/WarmtecHumidityStatus';
const statusTimerFile = '/home/pi/.homebridge/WarmtecTimerStatus';

class AirConditionerAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.AIR_CONDITIONER;
    }

    constructor(...props) {
        super(...props);

        this.currentState = null
        this.currentCmd = null;

        this.cmdCool = '1';
        this.cmdHeat = '2';
        this.cmdAuto = 'AUTO';

        this.nightModeStatus = 0;
        this.currentHumidity = 0;
        this.currentTimer = 0;

        // Disabling auto mode because I have not found a Tuya device config that has a temperature range for AUTO
        this.device.context.noAuto = true;

        const fanSpeedSteps = 3;
        this._rotationSteps = [0];
        this._rotationStops = {0: 0};
        for (let i = 0; i++ < 100;) {
            let _rotationStep = Math.floor(fanSpeedSteps * (i - 1) / 100) + 1;
            switch (_rotationStep) {
                case 1:
                    _rotationStep = 3;
                    break;
                case 3:
                    _rotationStep = 1;
                    break;
            }
            this._rotationSteps.push(_rotationStep);
            this._rotationStops[_rotationStep] = i;
        }
    }

    _registerPlatformAccessory() {
        const {Service} = this.hap;

        this.accessory.addService(Service.HeaterCooler, this.device.context.name);

        super._registerPlatformAccessory();
    }

    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;
        const service = this.accessory.getService(Service.HeaterCooler);
        this._checkServiceName(service, this.device.context.name);

        const characteristicActive = service.getCharacteristic(Characteristic.Active)
            .updateValue(this._getActive(dps['1']))
            .on('get', this.getActive.bind(this))
            .on('set', this.setActive.bind(this));

        const characteristicCurrentHeaterCoolerState = service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .updateValue(this._getCurrentHeaterCoolerState(dps))
            .on('get', this.getCurrentHeaterCoolerState.bind(this));

        const _validTargetHeaterCoolerStateValues = [STATE_OTHER];
        if (!this.device.context.noCool) _validTargetHeaterCoolerStateValues.unshift(Characteristic.TargetHeaterCoolerState.COOL);
        if (!this.device.context.noHeat) _validTargetHeaterCoolerStateValues.unshift(Characteristic.TargetHeaterCoolerState.HEAT);
        if (!this.device.context.noAuto) _validTargetHeaterCoolerStateValues.unshift(Characteristic.TargetHeaterCoolerState.AUTO);

        const characteristicTargetHeaterCoolerState = service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .setProps({
                maxValue: 9,
                validValues: _validTargetHeaterCoolerStateValues
            })
            .updateValue(this._getTargetHeaterCoolerState(dps['101']))
            .on('get', this.getTargetHeaterCoolerState.bind(this))
            .on('set', this.setTargetHeaterCoolerState.bind(this));

        const characteristicCurrentTemperature = service.getCharacteristic(Characteristic.CurrentTemperature)
            .updateValue(dps['3'])
            .on('get', this.getState.bind(this, '3'));

        let characteristicSwingMode;
        if (!this.device.context.noSwing) {
            characteristicSwingMode = service.getCharacteristic(Characteristic.SwingMode)
                .updateValue(this._getSwingMode(dps['106']))
                .on('get', this.getSwingMode.bind(this))
                .on('set', this.setSwingMode.bind(this));
        } else this._removeCharacteristic(service, Characteristic.SwingMode);

        let characteristicLockPhysicalControls;
        if (!this.device.context.noChildLock) {
            characteristicLockPhysicalControls = service.getCharacteristic(Characteristic.LockPhysicalControls)
                .updateValue(this._getLockPhysicalControls(dps['6']))
                .on('get', this.getLockPhysicalControls.bind(this))
                .on('set', this.setLockPhysicalControls.bind(this));
        } else this._removeCharacteristic(service, Characteristic.LockPhysicalControls);

        let characteristicCoolingThresholdTemperature;
        if (!this.device.context.noCool) {
            characteristicCoolingThresholdTemperature = service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
                .setProps({
                    minValue: this.device.context.minTemperature || 10,
                    maxValue: this.device.context.maxTemperature || 35,
                    minStep: this.device.context.minTemperatureSteps || 1
                })
                .updateValue(dps['2'])
                .on('get', this.getState.bind(this, '2'))
                .on('set', this.setTargetThresholdTemperature.bind(this, 'cool'));
        } else this._removeCharacteristic(service, Characteristic.CoolingThresholdTemperature);

        const characteristicNightMode = service.getCharacteristic(Characteristic.Active)
            .updateValue(dps['103'])
            .on('get', this.getNightModeActive.bind(this));

        const characteristicTimer = service.getCharacteristic(Characteristic.RotationSpeed)
            .updateValue(dps['105'])
            .on('get', this.getTimer.bind(this));

        const characteristicHumidity = service.getCharacteristic(Characteristic.RotationSpeed)
            .updateValue(dps['112'])
            .on('get', this.getHumidity.bind(this));

        let characteristicHeatingThresholdTemperature;
        if (!this.device.context.noHeat) {
            characteristicHeatingThresholdTemperature = service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
                .setProps({
                    minValue: this.device.context.minTemperature || 10,
                    maxValue: this.device.context.maxTemperature || 35,
                    minStep: this.device.context.minTemperatureSteps || 1
                })
                .updateValue(dps['2'])
                .on('get', this.getState.bind(this, '2'))
                .on('set', this.setTargetThresholdTemperature.bind(this, 'heat'));
        } else this._removeCharacteristic(service, Characteristic.HeatingThresholdTemperature);

        const characteristicTemperatureDisplayUnits = service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .updateValue(this._getTemperatureDisplayUnits(dps['19']))
            .on('get', this.getTemperatureDisplayUnits.bind(this))
            .on('set', this.setTemperatureDisplayUnits.bind(this));

        let characteristicRotationSpeed;
        characteristicRotationSpeed = service.getCharacteristic(Characteristic.RotationSpeed)
            .updateValue(this._getRotationSpeed(dps))
            .on('get', this.getRotationSpeed.bind(this))
            .on('set', this.setRotationSpeed.bind(this));

        this.characteristicCoolingThresholdTemperature = characteristicCoolingThresholdTemperature;
        this.characteristicHeatingThresholdTemperature = characteristicHeatingThresholdTemperature;

        this.device.on('change', (changes, state) => {
            if (changes.hasOwnProperty('1')) {
                const newActive = this._getActive(changes['1']);
                if (characteristicActive.value !== newActive) {
                    characteristicActive.updateValue(newActive);

                    if (!changes.hasOwnProperty('101')) {
                        characteristicCurrentHeaterCoolerState.updateValue(this._getCurrentHeaterCoolerState(state));
                    }

                    if (!changes.hasOwnProperty('104')) {
                        characteristicRotationSpeed.updateValue(this._getRotationSpeed(state));
                    }
                }
            }

            if (characteristicLockPhysicalControls && changes.hasOwnProperty('6')) {
                const newLockPhysicalControls = this._getLockPhysicalControls(changes['6']);
                if (characteristicLockPhysicalControls.value !== newLockPhysicalControls) {
                    characteristicLockPhysicalControls.updateValue(newLockPhysicalControls);
                }
            }

            if (changes.hasOwnProperty('105')) {
                this.currentTimer = parseInt(changes['105']);
                fs.writeFile(statusTimerFile, this.currentTimer, function(err) {});
            }

            if (changes.hasOwnProperty('103')) {
                this.nightModeStatus = JSON.parse(changes['103']) ? 1 : 0;
                fs.writeFile(statusNightModeFile, this.nightModeStatus, function(err) {});
            }

            if (changes.hasOwnProperty('112')) {
                this.currentHumidity = changes['112'];
                fs.writeFile(statusHumidityFile, this.currentHumidity, function(err) {});
            }

            if (changes.hasOwnProperty('2')) {
                if (!this.device.context.noCool && characteristicCoolingThresholdTemperature && characteristicCoolingThresholdTemperature.value !== changes['2'])
                    characteristicCoolingThresholdTemperature.updateValue(changes['2']);
                if (!this.device.context.noHeat && characteristicHeatingThresholdTemperature && characteristicHeatingThresholdTemperature.value !== changes['2'])
                    characteristicHeatingThresholdTemperature.updateValue(changes['2']);
            }

            if (changes.hasOwnProperty('3') && characteristicCurrentTemperature.value !== changes['3']) characteristicCurrentTemperature.updateValue(changes['3']);

            if (changes.hasOwnProperty('101')) {
                const newTargetHeaterCoolerState = this._getTargetHeaterCoolerState(changes['101']);
                const newCurrentHeaterCoolerState = this._getCurrentHeaterCoolerState(state);
                if (characteristicTargetHeaterCoolerState.value !== newTargetHeaterCoolerState) characteristicTargetHeaterCoolerState.updateValue(newTargetHeaterCoolerState);
                if (characteristicCurrentHeaterCoolerState.value !== newCurrentHeaterCoolerState) characteristicCurrentHeaterCoolerState.updateValue(newCurrentHeaterCoolerState);
            }

            if (changes.hasOwnProperty('19')) {
                const newTemperatureDisplayUnits = this._getTemperatureDisplayUnits(changes['19']);
                if (characteristicTemperatureDisplayUnits.value !== newTemperatureDisplayUnits) characteristicTemperatureDisplayUnits.updateValue(newTemperatureDisplayUnits);
            }

            if (changes.hasOwnProperty('104')) {
                const newRotationSpeed = this._getRotationSpeed(state);
                if (characteristicRotationSpeed.value !== newRotationSpeed) characteristicRotationSpeed.updateValue(newRotationSpeed);

                if (!changes.hasOwnProperty('101')) {
                    characteristicCurrentHeaterCoolerState.updateValue(this._getCurrentHeaterCoolerState(state));
                }
            }
        });

        fs.watchFile(statusNightModeFile, { interval: 1000 }, (curr, prev) => {
            const nightModeReq = fs.readFileSync(statusNightModeFile).toString();

            if (nightModeReq == this.nightModeStatus) {
                return;
            }

            const nightModeReqBool = nightModeReq == 1 ? true : false;

            if (this.currentState == 0) {
                this.nightModeStatus = 0;
                fs.writeFile(statusNightModeFile, 0, function(err) {});
                return;
            }

            this.nightModeStatus = nightModeReq;
            this.setState('103', nightModeReqBool, null);
        });

        fs.watchFile(statusTimerFile, { interval: 1000 }, (curr, prev) => {
            const statusTimerReq = parseInt(fs.readFileSync(statusTimerFile).toString());
            if (statusTimerReq == this.currentTimer) {
                return;
            }

            this.setState('105', statusTimerReq, null);
            this.currentTimer = statusTimerReq;
        });
    }

    getActive(callback) {
        console.log('aaa');
        this.getState('1', (err, dp) => {
            if (err) return callback(err);

            var nState = dp ? 1 : 0;
            if (this.currentState !== nState && this.currentTimer > 0) {
                this.currentTimer = 0;
                fs.writeFile(statusTimerFile, this.currentTimer, function(err) {});
            }

            if (this.currentState !== nState && nState == 0 && this.nightModeStatus == 1) {
                this.nightModeStatus = 0;
                fs.writeFile(statusNightModeFile, this.nightModeStatus, function(err) {});
            }

            this.currentState = dp ? 1 : 0;
            callback(null, this._getActive(dp));
        });
    }

    _getActive(dp) {
        console.log('bbb');
        const {Characteristic} = this.hap;

        if (dp !== (this.currentState ? true : false) && this.currentTimer > 0) {
            this.currentTimer = 0;
            fs.writeFile(statusTimerFile, this.currentTimer, function(err) {});
        }

        if (dp !== (this.currentState ? true : false) && ! dp && this.nightModeStatus == 1) {
            this.nightModeStatus = 0;
            fs.writeFile(statusNightModeFile, this.nightModeStatus, function(err) {});
        }

        this.currentState = dp ? 1 : 0;
        return dp ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE;
    }

    setActive(value, callback) {
        console.log('ccc');
        const {Characteristic} = this.hap;

        if (this.currentState !== value) {
            this.currentTimer = 0;
            fs.writeFile(statusTimerFile, this.currentTimer, function(err) {});

            switch (value) {
                case Characteristic.Active.ACTIVE:
                    this.currentState = 1;
                    return this.setState('1', true, callback);

                case Characteristic.Active.INACTIVE:
                    this.currentState = 0;
                    this.nightModeStatus = 0;
                    fs.writeFile(statusNightModeFile, 0, function(err) {});
                    return this.setState('1', false, callback);
            }
        }
        callback();
    }

    getNightModeActive(callback) {
        this.getState('103', (err, dp) => {
            if (err) return callback(err);

            if (this.currentState == 0) {
                this.nightModeStatus = 0;
            } else {
                if (this.nightModeStatus == JSON.parse(dp) ? 1 : 0) {
                    return;
                }
                this.nightModeStatus = JSON.parse(dp) ? 1 : 0;
            }

            fs.writeFile(statusNightModeFile, this.nightModeStatus, function(err) {});
        });
    }

    getTimer(callback) {
        this.getState('105', (err, dp) => {
            if (err) return callback(err);

            if (this.currentTimer == parseInt(dp)) {
                return;
            }
            this.currentTimer = parseInt(dp);

            fs.writeFile(statusTimerFile, this.currentTimer, function(err) {});
        });
    }

    getHumidity(callback) {
        this.getState('112', (err, dp) => {
            if (err) return callback(err);

            if (this.currentHumidity == dp) {
                return;
            }
            this.currentHumidity = dp;

            fs.writeFile(statusHumidityFile, this.currentHumidity, function(err) {});
        });
    }

    getLockPhysicalControls(callback) {
        this.getState('6', (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getLockPhysicalControls(dp));
        });
    }

    _getLockPhysicalControls(dp) {
        const {Characteristic} = this.hap;

        return dp ? Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED : Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;
    }

    setLockPhysicalControls(value, callback) {
        const {Characteristic} = this.hap;

        switch (value) {
            case Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED:
                return this.setState('6', true, callback);

            case Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED:
                return this.setState('6', false, callback);
        }

        callback();
    }

    getCurrentHeaterCoolerState(callback) {
        this.getState(['1', '101'], (err, dps) => {
            if (err) return callback(err);

            callback(null, this._getCurrentHeaterCoolerState(dps));
        });
    }

    _getCurrentHeaterCoolerState(dps) {
        const {Characteristic} = this.hap;

        if (!dps['1']) {
            return Characteristic.CurrentHeaterCoolerState.INACTIVE;
        }

        switch (dps['101']) {
            case this.cmdCool:
                this.currentCmd = Characteristic.TargetHeaterCoolerState.COOL;
                return Characteristic.CurrentHeaterCoolerState.COOLING;

            case this.cmdHeat:
                this.currentCmd = Characteristic.TargetHeaterCoolerState.HEAT;
                return Characteristic.CurrentHeaterCoolerState.HEATING;

            default:
                return Characteristic.CurrentHeaterCoolerState.IDLE;
        }
    }

    getTargetHeaterCoolerState(callback) {
        this.getState('101', (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getTargetHeaterCoolerState(dp));
        });
    }

    _getTargetHeaterCoolerState(dp) {
        const {Characteristic} = this.hap;

        switch (dp) {
            case this.cmdCool:
                if (this.device.context.noCool) return STATE_OTHER;
                this.currentCmd = Characteristic.TargetHeaterCoolerState.COOL;
                return Characteristic.TargetHeaterCoolerState.COOL;

            case this.cmdHeat:
                if (this.device.context.noHeat) return STATE_OTHER;
                this.currentCmd = Characteristic.TargetHeaterCoolerState.HEAT;
                return Characteristic.TargetHeaterCoolerState.HEAT;

            case this.cmdAuto:
                if (this.device.context.noAuto) return STATE_OTHER;
                return Characteristic.TargetHeaterCoolerState.AUTO;

            default:
                return STATE_OTHER;
        }
    }

    setTargetHeaterCoolerState(value, callback) {
        const {Characteristic} = this.hap;

        if (this.currentCmd !== value) {
            this.currentCmd = value;

            if (this.currentState === 0) {
                this.currentState = 1;
                this.setState('1', true, null);
                this.delay(1000);
            }


            switch (value) {
                case Characteristic.TargetHeaterCoolerState.COOL:
                    if (this.device.context.noCool) return callback();
                    return this.setState('101', this.cmdCool, callback);

                case Characteristic.TargetHeaterCoolerState.HEAT:
                    if (this.device.context.noHeat) return callback();
                    return this.setState('101', this.cmdHeat, callback);

                case Characteristic.TargetHeaterCoolerState.AUTO:
                    if (this.device.context.noAuto) return callback();
                    return this.setState('101', this.cmdAuto, callback);

                default:
                    callback();

            }
        } else {
            callback();
        }
    }

    getSwingMode(callback) {
        this.getState('106', (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getSwingMode(dp));
        });
    }

    _getSwingMode(dp) {
        const {Characteristic} = this.hap;

        return dp ? Characteristic.SwingMode.SWING_ENABLED : Characteristic.SwingMode.SWING_DISABLED;
    }

    setSwingMode(value, callback) {
        if (this.device.context.noSwing) return callback();

        const {Characteristic} = this.hap;

        switch (value) {
            case Characteristic.SwingMode.SWING_ENABLED:
                return this.setState('106', true, callback);

            case Characteristic.SwingMode.SWING_DISABLED:
                return this.setState('106', false, callback);
        }

        callback();
    }

    setTargetThresholdTemperature(mode, value, callback) {
        this.setState('2', value, err => {
            if (err) return callback(err);

            if (mode === 'cool' && !this.device.context.noHeat && this.characteristicHeatingThresholdTemperature) {
                this.characteristicHeatingThresholdTemperature.updateValue(value);
            } else if (mode === 'heat' && !this.device.context.noCool && this.characteristicCoolingThresholdTemperature) {
                this.characteristicCoolingThresholdTemperature.updateValue(value);
            }

            callback();
        });
    }

    getTemperatureDisplayUnits(callback) {
        this.getState('19', (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getTemperatureDisplayUnits(dp));
        });
    }

    _getTemperatureDisplayUnits(dp) {
        const {Characteristic} = this.hap;

        return dp === 'F' ? Characteristic.TemperatureDisplayUnits.FAHRENHEIT : Characteristic.TemperatureDisplayUnits.CELSIUS;
    }

    setTemperatureDisplayUnits(value, callback) {
        const {Characteristic} = this.hap;

        this.setState('19', value === Characteristic.TemperatureDisplayUnits.FAHRENHEIT ? 'F' : 'C', callback);
    }

    getRotationSpeed(callback) {
        this.getState(['1', '104'], (err, dps) => {
            if (err) return callback(err);

            callback(null, this._getRotationSpeed(dps));
        });
    }

    _getRotationSpeed(dps) {
        if (!dps['1']) return 0;

        if (this._hkRotationSpeed) {
            const currntRotationSpeed = this.convertRotationSpeedFromHomeKitToTuya(this._hkRotationSpeed);

            return currntRotationSpeed === dps['104'] ? this._hkRotationSpeed : this.convertRotationSpeedFromTuyaToHomeKit(dps['104']);
        }

        return this._hkRotationSpeed = this.convertRotationSpeedFromTuyaToHomeKit(dps['104']);
    }

    setRotationSpeed(value, callback) {
        const {Characteristic} = this.hap;

        if (value === 0) {
            this.setActive(Characteristic.Active.INACTIVE, callback);
        } else {
            if (this._hkRotationSpeed == value) {
                callback();
            } else {
                var dValue = this.convertRotationSpeedFromHomeKitToTuya(this._hkRotationSpeed ? this._hkRotationSpeed : value);
                this._hkRotationSpeed = value;
                var nValue = this.convertRotationSpeedFromHomeKitToTuya(value);

                if (dValue == nValue) {
                    callback();
                } else {
                    this.setMultiState({'104': this.convertRotationSpeedFromHomeKitToTuya(value)}, callback);
                }
            }
        }
    }

    convertRotationSpeedFromTuyaToHomeKit(value) {
        if (value == 0) {
            return 0;
        }

        if (value == 3) {
            return 10;
        }

        if (value == 2) {
            return 50;
        }

        if (value == 1) {
            return 100;
        }
    }

    convertRotationSpeedFromHomeKitToTuya(value) {
        return this._rotationSteps[value].toString();
    }

    delay(ms) {
        ms += new Date().getTime();
        while (new Date() < ms){}
    }
}

module.exports = AirConditionerAccessory;

