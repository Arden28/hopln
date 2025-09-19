# Hopln

> Fast, smooth, and rider-friendly public transport navigation for Nairobi (and beyond) built with **Expo**, **React Native**, and **Mapbox**.

<p align="center">
  <img src="https://img.shields.io/badge/Expo-React%20Native-blue" alt="Expo React Native" />
  <img src="https://img.shields.io/badge/Maps-Mapbox-informational" alt="Mapbox" />
  <img src="https://img.shields.io/badge/Platform-iOS%20%7C%20Android-success" alt="iOS & Android" />
  <img src="https://img.shields.io/badge/License-MIT-lightgrey" alt="MIT License" />
</p>

<p align="center">
  <img src="https://github.com/arden28/hopln/blob/main/assets/hopln-screenshot.png?raw=true" alt="Hopln App Screenshot" width="300" />
</p>

---

## 🚀 Overview

**Hopln** is a public transport navigation app designed specifically for Nairobi's matatu and bus system. It helps riders quickly find nearby stages, preview walking routes, and get smooth, real-time navigation guidance.

The app prioritizes:
- **Map smoothness** - Stable camera with no jittery zooms
- **Battery awareness** - Efficient rendering and location tracking
- **Rider experience** - Clear step-by-step guidance with haptics and voice prompts

---

## ✨ Core Features

| Feature | Description |
|---------|-------------|
| 🔎 **Fuzzy Stop Search** | Smart search with recent picks and match highlighting |
| 🗺️ **Smooth Mapbox GL** | Stable, throttled camera with no random zoom jumps |
| 🚶 **Walking Directions** | Mapbox Directions API with step-aware guidance banners |
| 📍 **Progressive Stops** | Thousands of stops rendered efficiently by zoom & radius |
| 🎯 **Always Visible Selection** | Selected stop stays visible even outside current radius |
| 🧭 **Real-time Navigation** | Smoothed GPS, heading-aware tracking, arrival hints |
| 💬 **Voice & Haptics** | Optional voice prompts and haptic feedback on step changes |
| ♿ **Accessibility** | Large tap targets, high-contrast pins, live regions |

---

## 📱 App Structure

The app uses **expo-router** with a clean tab-based navigation:

| Screen | Path | Purpose |
|--------|------|---------|
| **Map** | `app/(tabs)/map.tsx` | Main experience: nearby stages, route preview, navigation |
| **Search** | `app/(tabs)/search.tsx` | Fuzzy search with recents and match highlighting |

---

## 🏗️ Architecture

```
hopln/
├── app/
│   └── (tabs)/
│       ├── map.tsx           # Main map experience
│       └── search.tsx        # Search UI (interface-first)
├── components/
│   └── app/
│       └── StopsLayer.tsx    # Progressive stop rendering
├── data/
│   ├── fakeData.ts           # Dev fallback data
│   └── stops.ts              # Generated stops from DBF
├── hooks/
│   └── useStopSearch.ts      # Fuzzy search + recents
├── ui/
│   └── Highlight.tsx         # Text highlighter for matches
└── scripts/
    └── extract-stops.ts      # DBF → TypeScript converter
```

### Key Design Principles

- **State Isolation**: Map navigation stays local to `map.tsx`
- **Performance First**: Progressive rendering keeps the map lean
- **Smooth UX**: Throttled camera updates and EMA smoothing
- **Scalable Data**: Client-side filtering with haversine radius calculations

---

## ⚡ Performance Optimizations

### Progressive Rendering
- **Zoom Threshold**: No pins below zoom level 13
- **Dynamic Radius**: Scales from 2km → 6km → 12km based on zoom
- **Always Visible**: Selected stop bypasses all filters

### Camera Stability
- Fixed navigation zoom level
- Movement + heading thresholds to prevent micro-jitter
- EMA (Exponential Moving Average) smoothing for location, speed, and heading

### Efficient Layers
- Small, GPU-friendly icons with placement overrides
- Single `ShapeSource` per semantic layer
- Minimal native ↔ JS bridging

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 18+ | Required for development |
| Yarn/NPM | Latest | Package manager |
| Xcode | Latest | For iOS development |
| Android Studio | Latest | For Android development |
| Mapbox Token | Required | Maps + Directions API scopes |

### Installation

```bash
# Clone the repository
git clone <your-repo-url> hopln
cd hopln

# Install dependencies
yarn install
# or
npm install
```

### Configuration

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_public_token_here
```

**Alternative**: Use `app.json` extra configuration:

```json
{
  "expo": {
    "extra": {
      "mapboxToken": "pk.your_mapbox_public_token_here"
    }
  }
}
```

**iOS Setup** (if targeting iOS):
```bash
cd ios && pod install && cd ..
```

### Running the App

```bash
# Start the development server
yarn start
# or
npx expo start

# Run on platforms
yarn ios      # iOS Simulator/Device
yarn android  # Android Emulator/Device
```

---

## 📊 Data Management

### Stop Data from DBF Files

Hopln includes a Node.js script to convert `.dbf` stop files into optimized TypeScript modules:

```bash
# Place your stops.dbf file at: ./data/stops.dbf

yarn ts-node scripts/extract-stops.ts \
  --in data/stops.dbf \
  --out data/stops.ts \
  --idcol stop_id \
  --namecol stop_name \
  --latcol stop_lat \
  --lngcol stop_lon
```

**Output**: A typed `Stop[]` array exported from `data/stops.ts`

**Development Fallback**: `data/fakeData.ts` provides sample stops for testing.

### Routing Implementation

Uses **Mapbox Directions API** (walking profile):

```bash
# API Request Format
https://api.mapbox.com/directions/v5/mapbox/walking/{from};{to}?
  geometries=geojson&
  overview=full&
  steps=true&
  access_token=...
```

Route steps are normalized into a compact `Step` type for UI rendering.

---

## 💡 Developer Guide

### Progressive Stop Rendering

The `StopsLayer` component handles efficient stop rendering:

```tsx
import { StopsLayer } from '@/components/app/StopsLayer';
import { Stop } from '@/data/stops';

interface Props {
  allStops: Stop[];
  center: { latitude: number; longitude: number };
  zoom: number;
  selectedStopId: string | null;
  onPress: (stop: Stop) => void;
}

<StopsLayer
  allStops={stops}
  center={mapCenter}
  zoom={mapZoom}
  selectedStopId={selectedStop?.id ?? null}
  onPress={handleStopPress}
/>
```

**Rendering Logic**:
- **Zoom Gate**: `zoom >= 13` before showing any pins
- **Radius Filter**: Dynamic radius (2km at zoom 13, scaling up)
- **Selection Override**: Always shows selected stop regardless of filters

### Navigation UX Patterns

**Fixed Navigation Parameters**:
```ts
const NAV_ZOOM_BASE = 16;  // Predictable guidance zoom
const MOVEMENT_THRESHOLD = 5;  // Meters before camera update
const HEADING_THRESHOLD = 10;  // Degrees before heading update
```

**EMA Smoothing Constants**:
```ts
const EMA_ALPHA_LOC = 0.3;   // Location smoothing
const EMA_ALPHA_HEAD = 0.7;  // Heading smoothing  
const EMA_ALPHA_SPD = 0.5;   // Speed smoothing
```

**Step Advancement Logic**:
- Proximity-based triggering with hysteresis
- Periodic rebasing to nearest future step
- Arrival detection with buffer zone

### Search Implementation

The `useStopSearch` hook provides:

```ts
const {
  matches,
  recents, 
  pushRecent,
  isSearching
} = useStopSearch(query, myLocation);
```

**Match Highlighting**:
```tsx
import { Highlight } from '@/ui/Highlight';

<Highlight text={stop.name} matches={searchMatches} />
```

**Search-to-Map Integration**:
```tsx
// Option 1: URL Parameters
router.push(`/ (tabs)/map?stopId=${selectedStop.id}`);

// Option 2: Event Emitter
DeviceEventEmitter.emit('stopSelected', selectedStop);
```

---

## 🔧 Troubleshooting

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **AsyncStorage Null** | `NativeModule: AsyncStorage is null` | 1. Verify `@react-native-async-storage/async-storage` in `package.json`<br>2. Run `cd ios && pod install && cd ..`<br>3. Rebuild: `expo prebuild --clean && yarn ios/android` |
| **Mapbox Camera Conflict** | `only one of onRegionIsChanging or onCameraChanged` | Use only `onCameraChanged`:<br>```tsx
| **Tile Memory Error** | `bad_alloc` during tile loading | 1. Reduce features per source<br>2. Verify DBF data has no NaN coordinates<br>3. Use small `iconSize` values |
| **Route Export Error** | `missing default export` | Ensure screen files export default:<br>```ts<br>export default function MapScreen() { ... }<br>``` |

---

## 🗺️ Roadmap

| Phase | Features | Status |
|-------|----------|--------|
| **Q4 2025** | Vehicle tracking overlays (GTFS-RT) | 🔄 Planning |
| **Q1 2026** | Offline tiles & cached stops | 🔄 Planning |
| **Q2 2026** | Multi-modal trip planning | 📋 Backlog |
| **Q3 2026** | On-device rerouting | 📋 Backlog |
| **Q4 2026** | Localization & RTL support | 📋 Backlog |

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Workflow

1. **Fork** the repository and create a feature branch
2. **Keep PRs focused**: Separate UI, data, and infrastructure changes
3. **Update documentation** when adding configuration or environment changes

### Development Scripts

```bash
# Code quality
yarn lint                    # Run ESLint
yarn tsc --noEmit           # TypeScript type checking

# Data processing
yarn extract-stops          # Run DBF extraction script

# Testing
yarn test                   # Run test suite
yarn test:watch             # Watch mode for development
```

### Commit Guidelines

Use conventional commits for better changelog generation:

```
feat: add fuzzy search highlighting
fix: resolve camera jitter during navigation
docs: update Mapbox token configuration
perf: optimize stop rendering radius calculation
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙌 Credits

Built with ❤️ using:

- **Expo** & **React Native** for cross-platform development
- **Mapbox GL** for smooth, high-performance mapping
- **TypeScript** for type safety and developer experience

**Data Note**: Nairobi stage names and coordinates are provided by `digitalmatatu.com`. Always verify coordinates and stage information before production use.

---

<div align="center">

[![Star on GitHub](https://img.shields.io/github/stars/arden28/hopln?style=social)](https://github.com/arden28/hopln)
[![Made with Expo](https://img.shields.io/badge/Made%20with-EXPO-blue?logo=expo)](https://expo.dev)

</div>