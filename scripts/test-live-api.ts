#!/usr/bin/env ts-node
/**
 * Live API Integration Test
 *
 * Tests the Klereo API client against the real API to verify:
 * - Authentication
 * - Pool discovery
 * - Pool details retrieval
 * - Output control (turning lights on)
 *
 * Usage:
 *   KLEREO_USERNAME=your@email.com KLEREO_PASSWORD=yourpass npm run test:live
 *
 * Or create a .env file:
 *   KLEREO_USERNAME=your@email.com
 *   KLEREO_PASSWORD=yourpassword
 */

import { KlereoApi } from '../src/klereoApi';

// ANSI color codes for prettier output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✓ ${message}`, colors.green);
}

function error(message: string) {
  log(`✗ ${message}`, colors.red);
}

function info(message: string) {
  log(`ℹ ${message}`, colors.blue);
}

function section(title: string) {
  log(`\n${colors.bright}═══ ${title} ═══${colors.reset}`, colors.cyan);
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  log(`\n${colors.bright}Klereo Connect - Live API Integration Test${colors.reset}\n`);

  // Check for credentials
  const username = process.env.KLEREO_USERNAME;
  const password = process.env.KLEREO_PASSWORD;

  if (!username || !password) {
    error('Missing credentials!');
    log('\nPlease provide credentials via environment variables:');
    log('  KLEREO_USERNAME=your@email.com');
    log('  KLEREO_PASSWORD=yourpassword\n');
    log('Usage:');
    log('  KLEREO_USERNAME=your@email.com KLEREO_PASSWORD=yourpass npm run test:live\n');
    process.exit(1);
  }

  info(`Testing with username: ${username}`);

  // Initialize API client
  const api = new KlereoApi(username, password, {
    debug: (msg) => log(`  ${msg}`, colors.reset),
    error: (msg) => error(`  ${msg}`),
    warn: (msg) => log(`  ${msg}`, colors.yellow),
  });

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Test 1: Authentication
    section('Test 1: Authentication');
    try {
      await api.authenticate();
      success('Successfully authenticated with Klereo API');
      testsPassed++;
    } catch (err) {
      error(`Authentication failed: ${err}`);
      testsFailed++;
      throw err;
    }

    // Test 2: Get Pools
    section('Test 2: Get Pool List');
    let poolId: number | undefined;
    let poolName: string | undefined;
    try {
      const poolsResponse = await api.getPools();

      if (poolsResponse.status !== 'ok') {
        throw new Error(`API returned status: ${poolsResponse.status}`);
      }

      if (!poolsResponse.response || poolsResponse.response.length === 0) {
        throw new Error('No pools found on account');
      }

      success(`Found ${poolsResponse.response.length} pool(s)`);

      poolsResponse.response.forEach((pool, index) => {
        info(`  Pool ${index + 1}: ${pool.poolNickname} (ID: ${pool.idSystem})`);
      });

      // Use the first pool for testing
      poolId = poolsResponse.response[0].idSystem;
      poolName = poolsResponse.response[0].poolNickname;
      info(`\nUsing pool: ${poolName} (ID: ${poolId}) for further tests`);

      testsPassed++;
    } catch (err) {
      error(`Failed to get pools: ${err}`);
      testsFailed++;
      throw err;
    }

    if (!poolId) {
      throw new Error('No pool ID available');
    }

    // Test 3: Get Pool Details
    section('Test 3: Get Pool Details');
    let lightOutputIndex: number | undefined;
    let lightOutputName: string | undefined;
    try {
      const detailsResponse = await api.getPoolDetails(poolId);

      if (detailsResponse.status !== 'ok') {
        throw new Error(`API returned status: ${detailsResponse.status}`);
      }

      if (!detailsResponse.response || detailsResponse.response.length === 0) {
        throw new Error('No pool details found');
      }

      const poolDetails = detailsResponse.response[0];
      success(`Retrieved details for ${poolDetails.poolNickname}`);

      info(`  Outputs: ${poolDetails.outs.length}`);
      info(`  Probes: ${poolDetails.probes.length}`);

      // Find outputs and their names
      const outputNames = new Map<number, string>();
      if (poolDetails.IORename) {
        for (const rename of poolDetails.IORename) {
          if (rename.ioType === 1) { // ioType 1 = output
            outputNames.set(rename.ioIndex, rename.name);
          }
        }
      }

      // List all outputs
      log('\n  Available outputs:');
      for (const output of poolDetails.outs) {
        const name = outputNames.get(output.index) || `Output ${output.index}`;
        const statusStr = output.status === 1 ? 'ON' : 'OFF';
        const modeStr = output.mode === 0 ? 'disabled' : 'enabled';
        info(`    [${output.index}] ${name}: ${statusStr} (${modeStr})`);

        // Try to find a light output (usually index 0 or named "Light")
        if (lightOutputIndex === undefined) {
          const nameLower = name.toLowerCase();
          if (output.index === 0 || nameLower.includes('light') || nameLower.includes('lumiere')) {
            lightOutputIndex = output.index;
            lightOutputName = name;
          }
        }
      }

      // If we didn't find a light, use the first enabled output
      if (lightOutputIndex === undefined) {
        const firstEnabled = poolDetails.outs.find(out => out.mode !== 0);
        if (firstEnabled) {
          lightOutputIndex = firstEnabled.index;
          lightOutputName = outputNames.get(firstEnabled.index) || `Output ${firstEnabled.index}`;
        }
      }

      if (lightOutputIndex === undefined) {
        throw new Error('No outputs found to test');
      }

      info(`\nWill test with output: ${lightOutputName} (index ${lightOutputIndex})`);

      testsPassed++;
    } catch (err) {
      error(`Failed to get pool details: ${err}`);
      testsFailed++;
      throw err;
    }

    if (lightOutputIndex === undefined) {
      throw new Error('No output index available');
    }

    // Test 4: Control Output (Turn ON)
    section('Test 4: Control Output (Turn ON)');
    try {
      info(`Turning ON: ${lightOutputName}`);
      await api.setOutputAndWait(poolId, lightOutputIndex, true);
      success(`Successfully turned ON ${lightOutputName}`);

      // Wait a moment
      info('Waiting 3 seconds...');
      await delay(3000);

      // Verify the state changed
      const verifyResponse = await api.getPoolDetails(poolId);
      const verifyOutput = verifyResponse.response[0].outs.find(
        out => out.index === lightOutputIndex
      );

      if (verifyOutput && verifyOutput.status === 1) {
        success(`Verified: ${lightOutputName} is ON`);
      } else {
        error(`Warning: Could not verify ${lightOutputName} is ON`);
      }

      testsPassed++;
    } catch (err) {
      error(`Failed to control output: ${err}`);
      testsFailed++;
      throw err;
    }

    // Test 5: Control Output (Turn OFF)
    section('Test 5: Control Output (Turn OFF)');
    try {
      info(`Turning OFF: ${lightOutputName}`);
      await api.setOutputAndWait(poolId, lightOutputIndex, false);
      success(`Successfully turned OFF ${lightOutputName}`);

      // Wait a moment
      info('Waiting 2 seconds...');
      await delay(2000);

      // Verify the state changed
      const verifyResponse = await api.getPoolDetails(poolId);
      const verifyOutput = verifyResponse.response[0].outs.find(
        out => out.index === lightOutputIndex
      );

      if (verifyOutput && verifyOutput.status === 0) {
        success(`Verified: ${lightOutputName} is OFF`);
      } else {
        error(`Warning: Could not verify ${lightOutputName} is OFF`);
      }

      testsPassed++;
    } catch (err) {
      error(`Failed to control output: ${err}`);
      testsFailed++;
      // Don't throw - we want to show summary
    }

    // Summary
    section('Test Summary');
    const total = testsPassed + testsFailed;
    log(`\nTotal tests: ${total}`);
    success(`Passed: ${testsPassed}`);
    if (testsFailed > 0) {
      error(`Failed: ${testsFailed}`);
    }

    if (testsFailed === 0) {
      log(`\n${colors.green}${colors.bright}All tests passed! ✓${colors.reset}\n`);
      process.exit(0);
    } else {
      log(`\n${colors.red}${colors.bright}Some tests failed ✗${colors.reset}\n`);
      process.exit(1);
    }

  } catch (err) {
    section('Test Failed');
    error(`\n${err}\n`);

    const total = testsPassed + testsFailed;
    log(`Tests passed before failure: ${testsPassed}/${total + 1}\n`);

    process.exit(1);
  }
}

// Run the tests
main().catch(err => {
  error(`\nUnexpected error: ${err}\n`);
  process.exit(1);
});
