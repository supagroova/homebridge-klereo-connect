# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Renamed `PoolLightAccessory` to `PoolOutputAccessory` for clarity - the accessory handles ALL output types (lights, filters, pumps, heaters, robots, etc.), not just lights

### Fixed
- Fixed FormData compatibility with Node.js native fetch API - switched from `form-data` npm package to native FormData
- Fixed Jest test cleanup - added proper interval cleanup in platform tests to prevent tests from hanging

## [1.0.0] - 2026-02-03

### Added
- Initial release of homebridge-klereo-connect
- Automatic discovery of Klereo Connect pools and outputs
- HomeKit switch support for all pool outputs (lights, filters, pumps, etc.)
- Real-time status polling with configurable interval
- Automatic JWT token refresh for reliable authentication
- Support for multiple pools on a single account
- Custom output naming from Klereo Connect configuration
- Comprehensive error handling and logging
- Full TypeScript implementation with type safety
- Complete test coverage for API client, platform, and accessories
- Configuration schema for Homebridge UI
- Support for Node.js 20, 22, and 24
- Support for Homebridge 1.8.0 and 2.0.0-beta

### Features
- **Klereo API Client**: Full-featured client for Klereo Connect API
  - JWT authentication with automatic token refresh
  - Pool discovery and detailed pool information
  - Output control (on/off) with command wait support
  - MD5 password hashing for secure authentication

- **Platform Plugin**: Dynamic platform implementation
  - Automatic device discovery on startup
  - Accessory caching and restoration
  - Periodic token refresh (every hour)
  - Clean shutdown handling

- **Pool Light Accessory**: HomeKit switch implementation
  - Real-time state synchronization
  - Configurable polling interval (default: 30 seconds)
  - Concurrent update prevention
  - Graceful error handling with state reversion
  - Support for any Klereo output type (lights, pumps, heaters, etc.)

### Developer Features
- Comprehensive unit tests with Jest
- ESLint configuration for code quality
- TypeScript strict mode
- Development mode with hot reload (nodemon)
- Full API documentation

[1.0.0]: https://github.com/lachlanlaycock/homebridge-klereo-connect/releases/tag/v1.0.0
