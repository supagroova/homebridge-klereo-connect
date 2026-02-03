# Scripts

This directory contains utility scripts for the Klereo Connect plugin.

## test-live-api.ts

Integration test script that tests the API client against the real Klereo Connect API.

### What it tests:

1. **Authentication** - Verifies login with username/password
2. **Pool Discovery** - Gets list of pools on your account
3. **Pool Details** - Retrieves detailed information for each pool
4. **Output Control** - Turns a pool output (e.g., lights) ON and OFF

### Usage:

```bash
# Method 1: Environment variables
KLEREO_USERNAME=your@email.com KLEREO_PASSWORD=yourpass npm run test:live

# Method 2: Create .env file
cp .env.example .env
# Edit .env with your credentials
npm run test:live
```

### Example Output:

```
Klereo Connect - Live API Integration Test

ℹ Testing with username: your@email.com

═══ Test 1: Authentication ═══
✓ Successfully authenticated with Klereo API

═══ Test 2: Get Pool List ═══
✓ Found 1 pool(s)
ℹ   Pool 1: My Pool (ID: 12345)

═══ Test 3: Get Pool Details ═══
✓ Retrieved details for My Pool
ℹ   Outputs: 6
ℹ   Probes: 4

  Available outputs:
ℹ     [0] Lights: OFF (enabled)
ℹ     [1] Filter: ON (enabled)
ℹ     [5] Robot: OFF (enabled)

═══ Test 4: Control Output (Turn ON) ═══
ℹ Turning ON: Lights
✓ Successfully turned ON Lights
ℹ Waiting 3 seconds...
✓ Verified: Lights is ON

═══ Test 5: Control Output (Turn OFF) ═══
ℹ Turning OFF: Lights
✓ Successfully turned OFF Lights
ℹ Waiting 2 seconds...
✓ Verified: Lights is OFF

═══ Test Summary ═══

Total tests: 5
✓ Passed: 5

All tests passed! ✓
```

### Notes:

- This test uses REAL API calls and will actually control your pool equipment
- The test will turn an output ON, then OFF
- By default, it tests with the first available output (usually lights at index 0)
- Make sure you're comfortable with the test controlling your pool before running it
- Your credentials are never stored, only used for the test session
