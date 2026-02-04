# homebridge-klereo-connect

[![npm version](https://badge.fury.io/js/homebridge-klereo-connect.svg)](https://badge.fury.io/js/homebridge-klereo-connect)
[![npm downloads](https://img.shields.io/npm/dt/homebridge-klereo-connect)](https://www.npmjs.com/package/homebridge-klereo-connect)

Homebridge plugin for Klereo Connect swimming pool automation system. Control your pool lights, filters, heaters, and other equipment through Apple HomeKit.

## Features

- Automatic discovery of all pools and outputs on your Klereo account
- Real-time status updates with configurable polling
- Control pool lights, filters, pumps, and other equipment as HomeKit switches
- Automatic token refresh for uninterrupted service
- Custom naming support for outputs
- Support for multiple pools on a single account

## Prerequisites

Before installing this plugin, ensure you have:

- A Klereo Connect account with at least one pool configured
- Homebridge installed and running (v1.8.0 or higher)
- Node.js (v20, v22, or v24)

## Installation

### Install via Homebridge UI (Recommended)

1. Search for "Klereo Connect" in the Homebridge UI
2. Click "Install"
3. Configure the plugin with your Klereo credentials
4. Restart Homebridge

### Install via Command Line

```bash
npm install -g homebridge-klereo-connect
```

## Configuration

Add the following to your Homebridge `config.json`:

```json
{
  "platforms": [
    {
      "platform": "KlereoConnect",
      "name": "Klereo Connect",
      "username": "your-email@example.com",
      "password": "your-password",
      "pollingInterval": 30000
    }
  ]
}
```

### Configuration Options

| Field | Required | Description | Default |
|-------|----------|-------------|---------|
| `platform` | Yes | Must be `KlereoConnect` | - |
| `name` | Yes | Display name for the platform | `Klereo Connect` |
| `username` | Yes | Your Klereo Connect email address | - |
| `password` | Yes | Your Klereo Connect password | - |
| `pollingInterval` | No | How often to check for status updates (milliseconds) | `30000` (30 seconds) |

### Configuration via Homebridge UI

If you're using the Homebridge Config UI X, you can configure the plugin through the web interface:

1. Navigate to the "Plugins" tab
2. Find "Klereo Connect" and click "Settings"
3. Enter your credentials and adjust settings as needed
4. Click "Save"

## Usage

Once configured, the plugin will:

1. Authenticate with your Klereo account
2. Discover all pools and their configured outputs
3. Create HomeKit switches for each active output
4. Continuously monitor status and update HomeKit accordingly

### Controlling Outputs

Each pool output (lights, filters, pumps, etc.) appears as a switch in the Home app. Simply toggle the switch to turn the output on or off.

### Custom Output Names

Output names are automatically pulled from your Klereo Connect configuration. If you've renamed an output in the Klereo app (e.g., "Pool Lights", "Filter Pump"), those names will appear in HomeKit.

### Multiple Pools

If you have multiple pools on your Klereo account, each pool's outputs will be discovered and configured automatically. Accessories will be named with the format: `[Pool Name] - [Output Name]`

## Supported Output Types

The plugin supports all Klereo Connect output types, including:

- Pool Lights
- Spa Lights
- Filter Pumps
- Heaters
- Pool Cleaners/Robots
- Water Features
- Any custom outputs configured in your Klereo system

## Troubleshooting

### Authentication Errors

If you see authentication errors in the logs:

1. Verify your username and password are correct
2. Check that your Klereo Connect account is active
3. Try logging into the Klereo Connect mobile app to ensure your credentials work

### No Pools Found

If the plugin reports "No pools found":

1. Ensure you have at least one pool configured in your Klereo Connect account
2. Check that the pool is properly set up and online
3. Verify your account has appropriate access permissions

### Outputs Not Appearing

If some outputs don't appear in HomeKit:

1. Check that the output is configured in the Klereo Connect app
2. Ensure the output has been used at least once (outputs with all zero values are skipped)
3. Restart Homebridge to force a re-discovery

### State Not Updating

If output states aren't updating in HomeKit:

1. Check the `pollingInterval` setting in your config (lower values update more frequently)
2. Verify your internet connection is stable
3. Check Homebridge logs for API errors

### Viewing Logs

Enable debug logging by setting the Homebridge debug mode:

```bash
homebridge -D
```

Or in Homebridge UI, enable debug mode in the settings.

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/lachlanlaycock/homebridge-klereo-connect.git
cd homebridge-klereo-connect

# Install dependencies
npm install

# Build the plugin
npm run build

# Link for local testing
npm link

# Watch for changes
npm run watch
```

### Running Tests

```bash
# Run unit tests
npm test

# Run live API integration test (requires credentials)
KLEREO_USERNAME=your@email.com KLEREO_PASSWORD=yourpass npm run test:live
```

### Code Quality

```bash
# Lint the code
npm run lint
```

## API

This plugin uses the Klereo Connect API. For API documentation, see [API.md](API.md).

## Support

For issues, questions, or feature requests:

- Open an issue on [GitHub](https://github.com/lachlanlaycock/homebridge-klereo-connect/issues)
- Check existing issues for solutions
- Provide logs and configuration details (redact sensitive information)

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## Acknowledgments

- [Homebridge](https://homebridge.io/) - HomeKit support for the impatient
- Klereo Connect - Pool automation system

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This plugin is not officially associated with or endorsed by Klereo. Use at your own risk.
