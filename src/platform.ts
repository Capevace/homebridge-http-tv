import {
	API,
	DynamicPlatformPlugin,
	Logger,
	PlatformAccessory,
	PlatformConfig,
	Service,
	Characteristic,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { HTTPTVAccessory } from './platformAccessory';

export class HTTPTVPlatform implements DynamicPlatformPlugin {
	public readonly Service: typeof Service = this.api.hap.Service;
	public readonly Characteristic: typeof Characteristic = this.api.hap
		.Characteristic;

	// this is used to track restored cached accessories
	public readonly accessories: PlatformAccessory[] = [];

	constructor(
		public readonly log: Logger,
		public readonly config: PlatformConfig,
		public readonly api: API
	) {
		this.log.debug('Finished initializing platform:', this.config.name);

		// When this event is fired it means Homebridge has restored all cached accessories from disk.
		// Dynamic Platform plugins should only register new accessories after this event was fired,
		// in order to ensure they weren't added to homebridge already. This event can also be used
		// to start discovery of new accessories.
		this.api.on('didFinishLaunching', () => {
			log.debug('Executed didFinishLaunching callback');
			// run the method to discover / register your devices as accessories
			this.discoverDevices();
		});
	}

	/**
	 * This function is invoked when homebridge restores cached accessories from disk at startup.
	 * It should be used to setup event handlers for characteristics and update respective values.
	 */
	configureAccessory(accessory: PlatformAccessory) {
		this.log.info('Loading accessory from cache:', accessory.displayName);

		// add the restored accessory to the accessories cache so we can track if it has already been registered
		this.accessories.push(accessory);
	}

	/**
	 * This is an example method showing how to register discovered accessories.
	 * Accessories must only be registered once, previously created accessories
	 * must not be registered again to prevent "duplicate UUID" errors.
	 */
	discoverDevices() {
		const vieraCommandURL = (url) => url + '/nrc/control_0';
		const vieraRenderURL = (url) => url + '/dmr/control_0';
		
		function vieraRequest(type: 'command' | 'render', action: string, command: string) {
			const vieraCommandURN = 'panasonic-com:service:p00NetworkControl:1';
			const vieraRenderURN = 'schemas-upnp-org:service:RenderingControl:1';
			

			const urn = type === 'command' ? vieraCommandURN : vieraRenderURN;
			const body = "\
				<?xml version='1.0' encoding='utf-8'?> \
				<s:Envelope xmlns:s='http://schemas.xmlsoap.org/soap/envelope/' s:encodingStyle='http://schemas.xmlsoap.org/soap/encoding/'> \
					<s:Body> \
						<u:"+action+" xmlns:u='urn:"+urn+"'> \
							"+command+" \
						</u:"+action+"> \
					</s:Body> \
				</s:Envelope>";

			return {
				body,
				headers: {
					'Content-Length': body.length,
					'Content-Type': 'text/xml; charset="utf-8"',
					'SOAPACTION': '"urn:' + urn + '#' + action + '"'
			    }
			}
		}
		// https://developers.homebridge.io/#/characteristic/InputSourceType

		const vieraTVPower = {
			onUrl: vieraCommandURL('http://192.168.0.???'),
			...vieraRequest('command', 'X_SendKey', '<X_KeyEvent>NRC_POWER-ONOFF</X_KeyEvent>')
		};

		const devices = [
			{
				name: 'Television 2',
				serialNumber: 'TV1',
				model: 'GreatTVV2',
				manufacturer: 'Mateffy',
				method: 'POST',
				headers: {
					'Auth': 'Here goes some basic auth'
				},
				power: {
					onUrl: 'https://3d2665ce9547e1605543d49df206e510.m.pipedream.net/tv/power/on',
					offUrl: 'https://3d2665ce9547e1605543d49df206e510.m.pipedream.net/tv/power/off',
					method: 'POST',
					...vieraRequest('command', 'X_SendKey', '<X_KeyEvent>NRC_POWER-ONOFF</X_KeyEvent>')
				},
				sources: [
					{
						name: 'HDMI1',
						type: 3,
						url: 'https://3d2665ce9547e1605543d49df206e510.m.pipedream.net/tv/channel/hdmi1',
						method: 'PATCH',
						body: 'some body in here instead'
					},
					{
						name: 'Netflix',
						type: 10,
						url: 'https://3d2665ce9547e1605543d49df206e510.m.pipedream.net/tv/channel/netflix'
					},
				],
			},
		];

		let foundUUIDs: string[] = [];

		// loop over the discovered devices and register each one if it has not already been registered
		for (const device of devices) {
			if (!device.serialNumber) {
				this.log.error(
					`Could not initialize HTTP TV, missing serial number`,
					device
				);
				continue;
			}

			// generate a unique id for the accessory this should be generated from
			// something globally unique, but constant, for example, the device serial
			// number or MAC address
			const uuid = this.api.hap.uuid.generate(device.serialNumber);
			foundUUIDs.push(uuid);

			// see if an accessory with the same uuid has already been registered and restored from
			// the cached devices we stored in the `configureAccessory` method above
			const existingAccessory = this.accessories.find(
				(accessory) => accessory.UUID === uuid
			);

			if (existingAccessory) {
				// the accessory already exists
				this.log.info(
					'Restoring existing accessory from cache:',
					existingAccessory.displayName
				);

				existingAccessory.context.device = device;

				// create the accessory handler for the restored accessory
				// this is imported from `platformAccessory.ts`
				new HTTPTVAccessory(this, existingAccessory);

				// update accessory cache with any changes to the accessory details and information
				this.api.updatePlatformAccessories([existingAccessory]);
			} else {
				// the accessory does not yet exist, so we need to create it
				this.log.info('Adding new accessory:', device.name);

				// create a new accessory
				const accessory = new this.api.platformAccessory(
					device.name,
					uuid
				);

				// store a copy of the device object in the `accessory.context`
				// the `context` property can be used to store any data about the accessory you may need
				accessory.context.device = device;

				// create the accessory handler for the newly create accessory
				// this is imported from `platformAccessory.ts`
				new HTTPTVAccessory(this, accessory);

				// link the accessory to your platform
				this.api.registerPlatformAccessories(
					PLUGIN_NAME,
					PLATFORM_NAME,
					[accessory]
				);
			}

			// Get accessories that we havent found the UUID of (which means they were not configured anymore),
			// and delete them.
			this.accessories
				.filter(accessory => !foundUUIDs.includes(accessory.UUID))
				.forEach(accessory => {
					this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          			this.log.info('Removing existing accessory from cache:', accessory.displayName);
				});
		}
	}
}
