import { AccessoryPlugin, AccessoryPluginConstructor, Accessory, Service, API, Logging, AccessoryConfig, CharacteristicValue } from 'homebridge';

import { PLUGIN_NAME } from './settings';
const { version } = require('../package.json');

export function makeTVAccessory(api: API): AccessoryPluginConstructor {
	const Service = api.hap.Service;
	const Characteristic = api.hap.Characteristic;
	const Accessory = api.hap.Accessory;

	class HTTPTVAccessory implements AccessoryPlugin {
		protected name: string = 'Television 1';
		protected serialNumber: string = 'TV01';
		protected debug: boolean = false;

		protected uuid: string;
		protected tvAccessory: Accessory;
		protected tvService: Service;
		protected inputService: Service;

		protected log: Logging;
		protected config: AccessoryConfig;

		constructor(log: Logging, config: AccessoryConfig) {
			this.log = log;
			this.config = config;

			if (config.name) {
				this.name = String(config.name);
			}

			if (config.serialNumber) {
		        this.serialNumber = String(config.serialNumber);
		    }

		    this.debug = !!config.debug;

		    this.uuid = api.hap.uuid.generate(String(Math.random()));
			this.tvAccessory = new Accessory(this.name, this.uuid);

		    this.tvService = new Service.Television(this.name, 'tvService');
		    const activeCharacteristic = this.tvService.getCharacteristic(Characteristic.Active)
		        .on("get", this.getActiveStatus.bind(this))
		        .on("set", this.setActiveStatus.bind(this));

		    this.tvService
      			.setCharacteristic(Characteristic.ActiveIdentifier, 999999);

		    this.inputService = new Service.InputSource('dummy', 'tvService');
		    this.inputService
		        .setCharacteristic(Characteristic.Identifier, 1)
		        .setCharacteristic(Characteristic.Name, 'dummythick')
		        .setCharacteristic(Characteristic.ConfiguredName, 'dummy')
		        .setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.APPLICATION)
		        .setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
		        .setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.SHOWN);

		    // this.tvAccessory.addService(this.tvService);
		    this.tvService.addLinkedService(this.inputService);

		    // api.publishExternalAccessories(PLUGIN_NAME, [this.tvAccessory]);
		}

		getActiveStatus(callback: Function) {
			const value = this.tvService.getCharacteristic(Characteristic.Active).value;
            callback(null, value);
		}

		setActiveStatus(active: CharacteristicValue, callback: Function) {
			// http request here
			this.log('Set active status now!');
			callback();
		}

		getServices(): Service[] {
			const informationService = new Service.AccessoryInformation();

	        informationService
	        	.setCharacteristic(Characteristic.Name, this.name)
	            .setCharacteristic(Characteristic.Manufacturer, "Lukas Mateffy")
	            .setCharacteristic(Characteristic.Model, "HTTP TV")
	            .setCharacteristic(Characteristic.SerialNumber, this.serialNumber || 'TV01')
	            .setCharacteristic(Characteristic.FirmwareRevision, version);

	        return [informationService, this.tvService];
		}
	}

	return HTTPTVAccessory;
}

