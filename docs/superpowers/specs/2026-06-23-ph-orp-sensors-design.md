# pH & ORP Sensors — Design Spec

- **Date:** 2026-06-23
- **Status:** Approved (design)
- **Component:** homebridge-klereo-connect

## Goal

Surface the pool's current **pH** and **ORP (redox)** readings in Apple Home, plus a derived **good/bad status** for each — mirroring the existing water-temperature sensor shipped in v1.1.0.

## Background & constraint

HomeKit has no native pH or ORP sensor service; Apple's Home app only renders a fixed set of sensor types. We therefore repurpose existing services:

- **Raw value** → `LightSensor` (`CurrentAmbientLightLevel`), which accepts arbitrary positive numbers with decimals and renders as e.g. `7.8 lx`. The unit/icon are "wrong" (lux/brightness) but the number is accurate.
- **Status** → `AirQualitySensor` (`AirQuality`), rendered by Apple Home as Excellent → Poor.

Custom/Eve-only characteristics were considered and are **out of scope** (the chosen approach — light + air-quality — is visible directly in Apple Home).

## Scope

Four read-only accessories, one HomeKit service each → one predictable Home tile:

| Accessory | Service | Source probe | Apple Home shows |
|---|---|---|---|
| Pool pH | `LightSensor` | type 3 (PH) | `7.8 lx` |
| Pool pH Status | `AirQualitySensor` | type 3 (PH) | Excellent…Poor |
| Pool ORP | `LightSensor` | type 4 (REDOX) | `672 lx` |
| Pool ORP Status | `AirQualitySensor` | type 4 (REDOX) | Excellent…Poor |

Each accessory registers only when its probe is present.

**Out of scope:** any write/control (everything here is read-only); the parked heater accessory; custom Eve characteristics; an aggregate/combined status tile.

## Components

Two reusable accessory classes, each used twice (pH and ORP) — dual-use, so not speculative abstraction.

### `PoolMeasurementAccessory` (`src/poolMeasurementAccessory.ts`)

- Wraps a `LightSensor` service exposing `CurrentAmbientLightLevel`.
- Reads `context.poolId`, `context.probeType`, `context.sensorName`.
- Polls `getPoolDetails`, finds the probe by `probeType`, sets the characteristic to the probe's `filteredValue` **clamped to ≥ 0.0001** (the characteristic's minimum).
- Structure mirrors `PoolTemperatureAccessory`: constructor sets accessory info, gets/creates the service, registers the read handler, `startPolling()` + initial `updateState()`; exposes `stopPolling()`.

### `PoolQualityAccessory` (`src/poolQualityAccessory.ts`)

- Wraps an `AirQualitySensor` service exposing `AirQuality`.
- Reads `context.poolId`, `context.probeType`, `context.sensorName`, the threshold param names `context.targetParam`/`context.minParam`/`context.maxParam`, and `context.fallback` `{ target, min, max }`.
- Polls `getPoolDetails`, reads the probe `filteredValue` and the threshold params, computes `AirQuality` (algorithm below), updates the characteristic.

### Status algorithm

```
target = params[targetParam] ?? fallback.target
min    = params[minParam]    ?? fallback.min
max    = params[maxParam]    ?? fallback.max

if probe missing OR target/min/max missing  → AirQuality.UNKNOWN (0)
else if value <= min OR value >= max         → POOR (5)
else:
  dev = (value < target) ? (target - value) / (target - min)
                         : (value - target) / (max - target)
  dev < 0.2 → EXCELLENT (1)
  dev < 0.4 → GOOD (2)
  dev < 0.6 → FAIR (3)
  dev < 0.8 → INFERIOR (4)
  else      → POOR (5)
```

The `consigne` (target) is the best point (Excellent); the band edges (min/max) are the worst (Poor). Each side is normalized by **its own span** (`target − min` below, `max − target` above), so an off-centre target is handled correctly. Band cut-offs are easily tunable.

### Data sources

| | value (probe) | target | min | max |
|---|---|---|---|---|
| pH | type 3 `filteredValue` | `ConsignePH` | `pHMin` | `pHMax` |
| ORP | type 4 `filteredValue` | `ConsigneRedox` | `OrpMin` | `OrpMax` |

Live values observed on La Faub (idSystem 17501): pH **7.84** (target 7.3, band [6.5, 8.0]); ORP **671.9** (target 680, band [480, 1070] — target far below midpoint, confirming the asymmetry).

Fallbacks, used only if a param is absent (all are present on the test device): pH target 7.3 / min 7.0 / max 7.8; ORP target 700 / min 650 / max 750.

### Platform registration (`src/platform.ts`)

- A small config-driven registrar invoked from `discoverDevices()` after `registerPoolTemperature(poolDetails)`.
- Config entries:
  - pH: `{ key: 'ph', probeType: PH, name: 'Pool pH', targetParam: 'ConsignePH', minParam: 'pHMin', maxParam: 'pHMax', fallback: {…} }`
  - ORP: `{ key: 'orp', probeType: REDOX, name: 'Pool ORP', targetParam: 'ConsigneRedox', minParam: 'OrpMin', maxParam: 'OrpMax', fallback: {…} }`
- For each entry whose probe exists, register two accessories, reusing the existing cache-restore / new-accessory handling:
  - `PoolMeasurementAccessory` — UUID `klereo-${id}-${key}`, name `<nickname> - Pool pH` / `… - Pool ORP`.
  - `PoolQualityAccessory` — UUID `klereo-${id}-${key}-status`, name `<nickname> - Pool pH Status` / `… - Pool ORP Status`.
- Naming is explicit ("Pool pH" / "Pool ORP"). Note: Klereo's IORename labels the ORP/redox probe `"Chlorine"`; we deliberately use "ORP".

## Testing (TDD)

- New `src/poolMeasurementAccessory.test.ts`, `src/poolQualityAccessory.test.ts`, and registration cases in `src/platform.test.ts`.
- Fixtures use the real readings/thresholds above.
- Key cases:
  - Light value reflects the probe and clamps at 0.0001 when the probe reads ≤ 0.
  - Air-quality: at target → Excellent; at/over min or max → Poor; off-centre mid cases (use ORP's asymmetric band); below vs above target normalized by the correct span.
  - Missing probe → accessory skipped at registration; missing params → Unknown.
  - Polling pushes updates on change; `stopPolling()` halts polling.

## Verification

`npm run build` + `npm test` green, then deploy to the live Homebridge and confirm four tiles in Apple Home: pH (~7.8 lx) with an **Inferior** status, ORP (~672 lx) with an **Excellent** status.
