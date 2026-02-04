import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME, TOKEN_REFRESH_INTERVAL } from './settings';
import { KlereoConnectConfig, PoolDetails, PoolOutput } from './types';
import { KlereoApi } from './klereoApi';
import { PoolOutputAccessory } from './poolOutputAccessory';

/**
 * KlereoConnectPlatform
 * This class is the main constructor for the plugin
 */
export class KlereoConnectPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // Track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  private readonly api!: KlereoApi;
  private tokenRefreshInterval?: NodeJS.Timeout;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly homebridgeApi: API,
  ) {
    this.Service = homebridgeApi.hap.Service;
    this.Characteristic = homebridgeApi.hap.Characteristic;

    // Validate configuration
    const klereoConfig = config as KlereoConnectConfig;
    if (!klereoConfig.username || !klereoConfig.password) {
      this.log.error('Username and password are required in config');
      return;
    }

    // Initialize API client
    this.api = new KlereoApi(
      klereoConfig.username,
      klereoConfig.password,
      {
        debug: (msg) => this.log.debug(msg),
        error: (msg) => this.log.error(msg),
        warn: (msg) => this.log.warn(msg),
      },
    );

    this.log.debug('Finished initializing platform:', this.config.name);

    // Wait for Homebridge to finish launching before discovering devices
    this.homebridgeApi.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();

      // Set up token refresh interval
      this.tokenRefreshInterval = setInterval(() => {
        this.log.debug('Refreshing authentication token');
        this.api.authenticate().catch((error) => {
          this.log.error('Failed to refresh token:', error);
        });
      }, TOKEN_REFRESH_INTERVAL);
    });

    // Clean up on shutdown
    this.homebridgeApi.on('shutdown', () => {
      if (this.tokenRefreshInterval) {
        clearInterval(this.tokenRefreshInterval);
      }
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  /**
   * Discover pools and their controllable outputs
   */
  async discoverDevices() {
    try {
      // Authenticate first
      await this.api.authenticate();

      // Get list of pools
      const poolsResponse = await this.api.getPools();

      if (!poolsResponse.response || poolsResponse.response.length === 0) {
        this.log.warn('No pools found on Klereo account');
        return;
      }

      // Process each pool
      for (const poolInfo of poolsResponse.response) {
        this.log.info(`Found pool: ${poolInfo.poolNickname} (ID: ${poolInfo.idSystem})`);

        // Get detailed pool information
        const detailsResponse = await this.api.getPoolDetails(poolInfo.idSystem);

        if (!detailsResponse.response || detailsResponse.response.length === 0) {
          this.log.warn(`No details found for pool ${poolInfo.idSystem}`);
          continue;
        }

        const poolDetails = detailsResponse.response[0];
        await this.registerPoolOutputs(poolDetails);
      }

      // Remove accessories that no longer exist
      this.cleanupAccessories();
    } catch (error) {
      this.log.error('Failed to discover devices:', error);
    }
  }

  /**
   * Register accessories for pool outputs (lights, filter, etc.)
   */
  private async registerPoolOutputs(poolDetails: PoolDetails) {
    const { outs, IORename } = poolDetails;

    // Create a map of output names from IORename
    const outputNames = new Map<number, string>();
    if (IORename) {
      for (const rename of IORename) {
        if (rename.ioType === 1) {  // ioType 1 = output
          outputNames.set(rename.ioIndex, rename.name);
        }
      }
    }

    // Register each output as an accessory
    for (const output of outs) {
      // Skip outputs that are disabled or not configured
      if (output.mode === 0 && output.status === 0 && output.totalTime === 0) {
        continue;
      }

      const outputName = outputNames.get(output.index) || `Output ${output.index}`;
      this.log.debug(`Registering output: ${outputName} (index ${output.index})`);

      this.registerOutput(
        poolDetails,
        output,
        outputName,
      );
    }
  }

  /**
   * Register a single output as an accessory
   */
  private registerOutput(
    poolDetails: PoolDetails,
    output: PoolOutput,
    outputName: string,
  ) {
    const { idSystem, poolNickname } = poolDetails;

    // Generate unique ID for this accessory
    const uuid = this.homebridgeApi.hap.uuid.generate(
      `klereo-${idSystem}-output-${output.index}`,
    );

    // Check if accessory already exists
    const existingAccessory = this.accessories.find(
      (accessory) => accessory.UUID === uuid,
    );

    if (existingAccessory) {
      // Restore existing accessory
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

      // Update context with latest data
      existingAccessory.context.poolId = idSystem;
      existingAccessory.context.poolName = poolNickname;
      existingAccessory.context.outputIndex = output.index;
      existingAccessory.context.outputName = outputName;

      // Create accessory handler
      new PoolOutputAccessory(this, existingAccessory, this.api);
    } else {
      // Create new accessory
      this.log.info('Adding new accessory:', `${poolNickname} - ${outputName}`);

      const accessory = new this.homebridgeApi.platformAccessory(
        `${poolNickname} - ${outputName}`,
        uuid,
      );

      // Store context
      accessory.context.poolId = idSystem;
      accessory.context.poolName = poolNickname;
      accessory.context.outputIndex = output.index;
      accessory.context.outputName = outputName;

      // Create accessory handler
      new PoolOutputAccessory(this, accessory, this.api);

      // Register with Homebridge
      this.homebridgeApi.registerPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        [accessory],
      );

      // Track it
      this.accessories.push(accessory);
    }
  }

  /**
   * Remove accessories that no longer exist
   */
  private cleanupAccessories() {
    // For now, we keep all cached accessories
    // In a more advanced version, we could check if outputs still exist
    // and remove accessories for outputs that have been deleted
  }
}
