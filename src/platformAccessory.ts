import fetch from 'node-fetch';

import {
	Service,
	PlatformAccessory,
	CharacteristicValue,
	CharacteristicSetCallback,
	CharacteristicGetCallback,
} from 'homebridge';

import { HTTPTVPlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class HTTPTVAccessory {
	private tvService: Service;

	/**
	 * These are just used to create a working example
	 * You should implement your own code to track the state of your accessory
	 */
	private states = {
		Active: false,
		ActiveIdentifier: 1,
	};

	constructor(
		private readonly platform: HTTPTVPlatform,
		private readonly accessory: PlatformAccessory
	) {
		const Characteristic = this.platform.Characteristic;

		// set accessory information
		this.accessory
			.getService(this.platform.Service.AccessoryInformation)!
			.setCharacteristic(
				Characteristic.Manufacturer,
				accessory.context.device.manufacturer || 'Mateffy'
			)
			.setCharacteristic(
				Characteristic.Model,
				accessory.context.device.model || 'TV'
			)
			.setCharacteristic(
				Characteristic.SerialNumber,
				accessory.context.device.serialNumber
			);

		// get the LightBulb service if it exists, otherwise create a new LightBulb service
		// you can create multiple services for each accessory
		this.tvService =
			this.accessory.getService(this.platform.Service.Television) ||
			this.accessory.addService(this.platform.Service.Television);

		// set the service name, this is what is displayed as the default name on the Home app
		// in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
		this.tvService
			.setCharacteristic(
				Characteristic.Name,
				accessory.context.device.name || 'TV'
			)
			.setCharacteristic(
				Characteristic.ConfiguredName,
				accessory.context.device.name || 'TV'
			)
			.setCharacteristic(
				Characteristic.SleepDiscoveryMode,
				Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE
			);

		this.tvService.setCharacteristic(
			Characteristic.ActiveIdentifier,
			this.states.ActiveIdentifier
		);

		// each service must implement at-minimum the "required characteristics" for the given service type
		// see https://developers.homebridge.io/#/service/Lightbulb

		// register handlers for the On/Off Characteristic
		this.tvService
			.getCharacteristic(Characteristic.Active)
			.on('set', this.setActive.bind(this))
			.on('get', this.getActive.bind(this));

		this.tvService
			.getCharacteristic(Characteristic.ActiveIdentifier)
			.on('set', this.setActiveIdentifier.bind(this))
			.on('get', this.getActiveIdentifier.bind(this));

		// Register inputs
		for (const i in accessory.context.device.sources) {
			const source = accessory.context.device.sources[i];

			const inputService =
				this.accessory.getService(source.name) ||
				this.accessory.addService(
					this.platform.Service.InputSource,
					source.name,
					`${accessory.context.device.serialNumber}-${source.name}`
				);

			inputService
				.setCharacteristic(Characteristic.Identifier, parseInt(i) + 1)
				.setCharacteristic(Characteristic.ConfiguredName, source.name)
				.setCharacteristic(
					Characteristic.IsConfigured,
					Characteristic.IsConfigured.CONFIGURED
				)
				.setCharacteristic(
					Characteristic.InputSourceType,
					source.type || Characteristic.InputSourceType.HDMI
				);

			this.tvService.addLinkedService(inputService);
		}
	}

	async setActive(
		value: CharacteristicValue,
		callback: CharacteristicSetCallback
	) {
		this.platform.log.debug('Set Characteristic Active ->', value);

		try {
			const url = (value as boolean)
				? this.accessory.context.device.power?.onUrl
				: this.accessory.context.device.power?.offUrl;

			if (!url) {
				throw new Error(
					`TV ${
						this.accessory.context.device.name
					} does not have an ${(value as boolean) ? 'on' : 'off'}Url`
				);
			}

			await this.httpRequest(
				url,
				this.accessory.context.device.power?.method ||
					this.accessory.context.device.method,
				{
					...(this.accessory.context.device.headers || {}),
					...(this.accessory.context.device.power?.headers || {}),
				},
				this.accessory.context.device.power?.body
			);

			this.states.Active = value as boolean;
			callback(null);
		} catch (e) {
			this.platform.log.error('Cannot update TV power via HTTP', e);
			callback(e);
		}
	}

	getActive(callback: CharacteristicGetCallback) {
		// implement your own code to check if the device is on
		const isOn = this.states.Active;
		this.platform.log.debug('Get Characteristic Active ->', isOn);

		// you must call the callback function
		// the first argument should be null if there were no errors
		// the second argument should be the value to return
		callback(null, isOn);
	}

	async setActiveIdentifier(
		value: CharacteristicValue,
		callback: CharacteristicSetCallback
	) {
		this.platform.log.debug(
			'Set Characteristic ActiveIdentifier -> ',
			value
		);

		try {
			const sourceIndex = (value as number) - 1;
			// Identifiers are just the index in the source array so look it up there
			const source = this.accessory.context.device.sources[sourceIndex];

			if (!source) {
				throw new Error(
					`Source with Identifier ${value} does not exist in configuration`
				);
			}

			await this.httpRequest(
				source.url,
				source.method || this.accessory.context.device.method,
				{
					...(this.accessory.context.device.headers || {}),
					...(source.headers || {}),
				},
				source.body
			);

			this.states.ActiveIdentifier = value as number;
			callback(null);
		} catch (e) {
			this.platform.log.error('Cannot update input change via HTTP', e);
			callback(e);
		}
	}

	getActiveIdentifier(callback: CharacteristicGetCallback) {
		// implement your own code to check if the device is on
		const activeIdentifier = this.states.ActiveIdentifier;

		this.platform.log.debug(
			'Get Characteristic ActiveIdentifier ->',
			activeIdentifier
		);

		// you must call the callback function
		// the first argument should be null if there were no errors
		// the second argument should be the value to return
		callback(null, activeIdentifier);
	}

	async httpRequest(
		url: string,
		method = 'GET',
		headers?: { [key: string]: string },
		body?: string
	) {
		const response = await fetch(url, {
			method,
			headers,
			body,
		});

		if (!response.ok) {
			throw new Error(`${response.status}: ${await response.text()}`);
		}

		this.platform.log.debug('Update HTTP request: OK');
	}
}
