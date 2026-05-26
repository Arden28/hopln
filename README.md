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

## 💡 Product Improvement Ideas

35 suggestions organised by theme — from quick wins to long-term platform plays.

### Navigation & Core Flow

| # | Idea | Value |
|---|------|-------|
| 1 | **Fare estimator** | Show estimated matatu fare per leg (e.g. "~KSh 50") on the route card. Matatu fares are predictable per route; riders plan around this daily. |
| 2 | **"Last matatu" warning** | Alert users when a route's last scheduled departure is within 30 min based on GTFS data, so they are never stranded. |
| 3 | **Crowdsourced delay reporting** | One-tap "this matatu is late" on an active leg. Aggregate across users and surface "3 riders report delays on 46 right now." No GPS hardware required. |
| 4 | **Background ETA notification** | Push a local notification 2 min before each alight stop while the app is backgrounded: "Get ready — alight at GPO in ~2 min." |
| 5 | **Offline journey replay** | Cache the last calculated route so if connectivity drops mid-trip, the user can still see all steps and remaining distance (NavigationEngine already runs fully offline). |
| 6 | **Route comparison view** | Show 2–3 route alternatives side by side with trade-offs: duration, number of changes, total walk distance, and estimated fare. |
| 7 | **On-device rerouting** | Detect when a user is off-route for > 60 s and silently recalculate, pushing the new route without breaking the navigation session. |

### Convenience & Personalization

| # | Idea | Value |
|---|------|-------|
| 8 | **Commute shortcuts** | After 3 journeys between the same two points, offer a one-tap "Morning commute" chip on the home screen — learned from saved journeys + time-of-day pattern. |
| 9 | **"Time to leave" smart alert** | Notify the user at home/work: "Leave in 5 min to catch the 46 at University Way by 08:15." Combines saved routes with current transit schedule. |
| 10 | **Walk preference quick toggle** | Surface the max-walking-distance slider directly on the route result card, not only in Settings, with immediate re-calculation on change. |
| 11 | **Journey history & personal analytics** | Log past journeys privately on-device: weekly distance, most-used routes, average commute time. No server sync required. |
| 12 | **Home/Work pin** | Let users pin two permanent locations for instant one-tap routing from the map screen — the single highest-frequency action in any transit app. |
| 13 | **iOS & Android widgets** | A lock-screen or home-screen widget showing the next departure for the user's saved commute route. |

### Safety & Trust

| # | Idea | Value |
|---|------|-------|
| 14 | **Safe check-in** | One tap to send "I'm on my way, ETA 14:32" to a saved contact. Particularly valuable for evening commuters — a genuine differentiator in the Nairobi market. |
| 15 | **Stop safety ratings** | Let users rate a stop's safety after dark (separate from general review). Surface a "safe after dark" indicator on the stop details sheet. |
| 16 | **Speed reporting** | Let riders flag a matatu driving dangerously fast. Aggregated data surfaces high-risk routes; can be shared with SACCOs or traffic authorities. |
| 17 | **Journey sharing (live)** | "Share ETA" button during navigation generates a link showing the user's current step and ETA in real time — useful for families and meetups. |

### Discovery & Community

| # | Idea | Value |
|---|------|-------|
| 18 | **Route explorer** | A dedicated screen to browse all routes by number or area, see the full path on the map, and view the stop list — currently only reachable by calculating a journey. |
| 19 | **Trending routes** | "Most used routes this week" section on the home screen, derived from anonymous journey data. Helps new users discover the main corridors quickly. |
| 20 | **Stop photos in search results** | Show an approved stop photo thumbnail next to stop names in search results to help users visually confirm they are at the right stage. |
| 21 | **Crowdsourced stop name corrections** | Let riders propose a correction when a stop name on the app does not match the sign on the ground. Reviewed via the existing contributions pipeline. |
| 22 | **QR codes at physical stops** | Generate a printable QR code per stop that deep-links to its details sheet. Place at stages in partnership with county/NTSA. |

### Accessibility & Localisation

| # | Idea | Value |
|---|------|-------|
| 23 | **Voice navigation (audio)** | Audio turn-by-turn instructions ("Board the 46 at University Way") — essential in noisy matatus where looking at the screen is impractical. |
| 24 | **Swahili language support** | Full UI localisation in Swahili. Given the target market, this removes friction for a large segment of daily riders. |
| 25 | **Accessibility mode** | Larger tap targets, higher-contrast stop pins, and screen-reader-friendly navigation banners. Unlocks riders who currently avoid digital transit tools. |
| 26 | **Carbon footprint tracker** | Show CO₂ saved vs. driving after each completed journey. Motivates continued use and supports sustainability messaging. |

### Platform & Ecosystem

| # | Idea | Value |
|---|------|-------|
| 27 | **GTFS-RT vehicle tracking** | Overlay real-time vehicle positions on the map using GTFS Realtime feeds. Shows exactly where the next matatu on a route is. |
| 28 | **Operator dashboard (B2B)** | A web portal for SACCOs and matatu operators to claim their routes, push real-time delay info, and view aggregated ridership data. Positions Hopln as infrastructure. |
| 29 | **M-Pesa fare payment** | Deep-link to M-Pesa or integrate a fare wallet so riders can pay the matatu fare through the app. Closes the loop from planning to payment. |
| 30 | **Hopln Pass (subscription)** | Premium tier: offline Mapbox tile packs, ad-free experience, fare history export, and priority AI planning. Establishes a sustainable revenue stream without compromising the free core. |
| 31 | **School/corporate commute mode** | Employers or schools provide a Hopln code that pre-loads relevant routes and optionally subsidises the fare. B2B2C distribution channel. |
| 32 | **Weather-aware routing** | Surface a rain alert when precipitation is forecast at departure time, and nudge the user to leave earlier or choose a route with less exposed walking. |
| 33 | **Offline Mapbox tile packs** | Let users download a city-level tile pack (~80–200 MB) from Settings so the map works without connectivity. Requires migrating the main map screen from Google Maps to Mapbox (already installed). |
| 34 | **Multi-city expansion** | Extend GTFS data coverage to Mombasa and Kisumu. The entire backend and app stack is city-agnostic — only the transit data changes. |
| 35 | **Arrival celebration & trip summary** | On arrival, show a brief summary card: total time, distance walked, route used. Small moment of delight that reinforces app habit formation. |

---

## Navigation Engine
Ready for review
Select text to add comments on the plan
Navigation Engine — Honest Assessment & 30 Improvement Suggestions
Current State: What's Actually Good
Before the gaps, credit where it's due. The current implementation has several non-trivial things done correctly:

Strength	Why It Matters
Projection-based engine (not proximity)	The industry-standard approach. Proximity-based step detection breaks on loops and U-turns.
High-water-mark anti-backward-snap	Prevents GPS bounce from rewinding the user's progress — most DIY nav engines miss this.
EMA smoothing with circular heading arithmetic	Correct shortest-path angular interpolation. A naive EMA on heading breaks at the 0°/360° boundary.
Local search window in projectUser()	Smart: only scans ±150 m/500 m of last known position. Full-scan on every GPS tick would melt older phones.
Bus-mode off-route override	Transit legs shouldn't trigger off-route — the driver controls the path, not the pedestrian.
Instant engine update on navigation start	Avoids the 1–3 s blank state before first GPS tick.
GPS accuracy tiering	Browsing on cell towers, navigating on balanced GPS — real battery savings.
Current State: The Real Gaps
Engine Layer (navigationEngine.ts)
ETA is wrong for transit legs. remainingDistanceM / speedMps uses live GPS speed, which fluctuates wildly on a bus (traffic lights, turns). Transit legs should use their scheduled seg.duration from the route data.
No distance-to-next-step. The engine outputs remainingDistanceM (to destination) but not distanceToNextStepM (to the next maneuver). This single value is the backbone of every "In 200 m…" UI.
No pre-announcement zones. Step fires at 18 m (STEP_REACH_M). Google announces at ~500 m, ~200 m, and "now". No tiered system exists.
Off-route = game over. After 3 strikes the engine declares off_route and stops. No re-routing logic of any kind.
WAITING_FOR_BUS state is orphaned. journeyStore sets it on journey assignment, but useNavigation only acts on IN_TRANSIT. The "at the stop, waiting" phase has no logic or UI.
No segment-level stop tracking. During a bus ride, the engine doesn't track which stop-to-stop interval the user is in. No "3 stops remaining" is possible without this.
LOOKBACK_M = 80 is dead code. Declared but never referenced; actual lookback hardcoded to 150 m inside projectUser().
No degenerate route guard. Duplicate consecutive coordinates produce segLen[i] = 0, causing silent projection skip — hard to debug.
Hook Layer (useNavigation.ts)
No voice guidance. Not even a stub. This is the #1 reason riders keep their phone pocketed — they need to hear instructions, not watch the screen.
No haptic feedback. No Haptics.impactAsync() anywhere. Step advance should vibrate.
GPS permission denial is silent. Null location is returned; nothing prompts the user or links to Settings.
No background tracking. Lock the screen mid-journey → engine goes blind. Requires a foreground service (Android) or background location mode (iOS).
Adaptive EMA missing. EMA_LOC = 0.25 is fine for walking. On a bus at 50 km/h, a lower alpha (more smoothing) is needed to reduce lag.
UI Layer
No "In X m" countdown. The banner shows the instruction text but no approaching distance. The user has no idea when to act.
No off-route warning. navState.status === 'off_route' triggers nothing visible in MapFloatingUI.
Step list is static. No animated position indicator, no progressive step dimming, no auto-scroll to current step.
Arrival time in JourneyDetailsSheet is static. Calculated at plan time, never updated from live ETA.
Dead props in RouteStepsList. stepsOpen, setStepsOpen, nextPreview are accepted but never read inside the component.
Recenter button has no "unlocked" state. When the user pans away during navigation, the button looks identical. Google flashes a blue indicator.
30 Suggestions to Reach Google Maps Level
Group A — Engine Core (build first; everything else depends on these)
1. distanceToNextStepM in engine output Add to EngineResult: distanceToNextStepM = nextStep.routeOffset - confirmedOffset. This single field unlocks all "In X m" UX. navigationEngine.ts

2. Tiered pre-announcement zones Add approachPhase: "far" | "near" | "imminent" | null to EngineResult based on distanceToNextStepM (> 300 m → far, 100–300 m → near, < 100 m → imminent). Voice and haptics key off this enum. navigationEngine.ts

3. Hybrid ETA: schedule for transit, GPS speed for walk Compute ETA by summing: (a) remaining walk legs → distance / speedMps, (b) remaining transit legs → their seg.duration from the route plan. Pass segments into the engine constructor. navigationEngine.ts, useNavigation.ts

4. Automatic re-routing after off-route After 3 off-route strikes, fire RouteService.calculateJourney(currentLoc, originalDestination) in background. On success, rebuild engine with new route. Expose status: 'rerouting' during request. useNavigation.ts, navigationEngine.ts

5. Segment-level stop tracking Track which RouteStop pair the user is currently between on transit legs. Output stopsRemaining: number and currentStopName: string | null. Required for stop countdowns and alight alerts. navigationEngine.ts

6. WAITING_FOR_BUS phase logic During WAITING_FOR_BUS: monitor GPS proximity to the boarding stop (< 30 m = "at stop"). Auto-transition to IN_TRANSIT when user's speed exceeds 8 km/h in the correct direction (bus departed). useNavigation.ts, journeyStore.ts

7. Adaptive EMA alpha per segment mode Walking: EMA_LOC = 0.25 (current). Bus/transit: EMA_LOC = 0.12 (more smoothing, less lag at speed). Switch based on current leg mode. useNavigation.ts

8. Degenerate route guard In NavigationEngine constructor: filter consecutive duplicate coordinates before building segLen. Log a warning but don't crash. navigationEngine.ts

Group B — Voice & Haptics (highest UX impact, lowest effort)
9. Text-to-speech voice guidance Use expo-speech. Announce at each approachPhase change: "In 300 metres, board the 46" / "Board now." Respect prefs.navHints: off → silent, concise → imminent only, detailed → all three phases. New services/voiceGuide.ts, wired in useNavigation.ts

10. Haptic on step advance Haptics.impactAsync(ImpactFeedbackStyle.Medium) when stepIndex increments. Haptics.notificationAsync(NotificationFeedbackType.Success) on arrival. Zero visual code required. useNavigation.ts

11. Alight alert 2 stops before alighting: medium haptic + voice "Prepare to alight in 2 stops." 1 stop before: repeat. At alighting stop: heavy haptic + "Alight now." Uses stopsRemaining from suggestion 5. useNavigation.ts

Group C — Navigation Banner UI
12. "In X m" distance countdown Replace static instruction with: "In 400 m — Board 46 at University Way". Counts down 400 → 200 → 80 → "Board now" using distanceToNextStepM. MapFloatingUI.tsx

13. Off-route warning banner When navState.status === 'off_route' or 'rerouting': replace instruction banner with a red strip "Off route — recalculating…". Dismiss when back on route. MapFloatingUI.tsx

14. Live ETA in banner Feed navState.eta (updated every GPS tick) into the banner. The arrival time should reflect actual progress, not the original plan. MapFloatingUI.tsx

15. Recenter "unlocked" button state When user pans away during navigation (followMe === false): change recenter button to a pulsing blue variant. Tap once to re-lock camera. MapFloatingUI.tsx, map.tsx

16. Speed indicator pill Small pill showing {speed} km/h during IN_TRANSIT. Reassures riders the GPS is live; useful for bus speed awareness. MapFloatingUI.tsx

Group D — Step List Live Progress
17. Animated "you are here" dot Animated orange dot on the left rail that moves down as nextStepIdx advances. Pure Animated API, no new data needed. RouteStepsList.tsx

18. Progressive step dimming Completed steps: 30% opacity + collapsed sub-steps. Active step: highlighted orange. Makes long routes scannable. RouteStepsList.tsx

19. Live stop countdown during bus ride Replace static "Ride 4 stops" with "3 stops remaining" updating in real time via stopsRemaining from suggestion 5. RouteStepsList.tsx

20. Per-step ETA Show "~2:47 PM" next to each step, computed from current live ETA minus cumulative remaining segment durations. RouteStepsList.tsx

21. Auto-scroll to active step When nextStepIdx changes, scroll the list so the active step is centred. Use a ref + scrollTo. RouteStepsList.tsx

22. Remove dead props Remove stepsOpen, setStepsOpen, nextPreview from RouteStepsList (accepted but never read). Clean all call sites. RouteStepsList.tsx, map.tsx

Group E — Transit-Specific Intelligence
23. "At stop" waiting UI During WAITING_FOR_BUS: show a dedicated card state — boarding stop name, route, expected bus arrival from schedule. Replace the generic journey card. JourneyDetailsSheet.tsx, MapFloatingUI.tsx

24. Boarding confirmation When the bus departs (user speed > 10 km/h in correct bearing): auto-transition to IN_TRANSIT and announce "Journey started — riding the 46." useNavigation.ts

25. Wrong vehicle / wrong direction detection If during a transit leg, heading diverges > 90° from expected route bearing for > 30 s at > 8 km/h: show alert "Are you on the right bus?" Low false-positive rate with speed guard. navigationEngine.ts, useNavigation.ts

26. Intermediate stop name callout As bus passes each intermediate stop (detected via stopsRemaining decrement): brief overlay callout "Passing: Kencom Stage." Fades after 3 s. MapFloatingUI.tsx

Group F — Platform & Reliability
27. GPS permission recovery flow On permission denial: inline banner "Location needed for navigation — tap to enable in Settings." Links to Linking.openSettings(). Currently silent. useNavigation.ts

28. Background location tracking Android: foreground service via expo-task-manager + expo-location background task. iOS: NSLocationAlwaysAndWhenInUseUsageDescription + always permission request before navigation starts. useNavigation.ts, app.json

29. GPS outage dead-reckoning When no GPS update arrives for > 8 s during IN_TRANSIT: advance confirmedOffset by lastKnownSpeed × elapsedTime. Show "GPS signal lost" indicator. Resume on next fix. navigationEngine.ts, useNavigation.ts

30. Navigation session persistence Persist { stepIndex, confirmedOffset, journeySnapshot } to AsyncStorage during navigation. On relaunch, offer "Resume navigation to [destination]?" Current force-quit wipes everything. New store/navSessionStore.ts, useNavigation.ts

Prioritized Sprint Roadmap
Sprint	Suggestions	Theme
1 — Foundation	1, 2, 3, 5, 8	Engine output that everything else requires
2 — Quick Wins	9, 10, 12, 13, 15, 17, 22	High-impact, low-effort UX unlocks
3 — Transit Intelligence	6, 11, 19, 23, 24	Bus-specific flows
4 — Reliability	4, 7, 27, 28, 29	Robustness and platform
5 — Polish	14, 16, 18, 20, 21, 25, 26, 30	Finishing details
Critical Files
File	Role
services/navigationEngine.ts	Engine — all Group A suggestions
hooks/useNavigation.ts	Orchestration — GPS, EMA, voice, haptics
components/app/MapFloatingUI.tsx	Primary navigation banner
components/app/RouteStepsList.tsx	Step list (dead props, live progress)
components/app/JourneyDetailsSheet.tsx	Journey sheet (static ETA, transit states)
store/journeyStore.ts	TripStatus state machine
store/prefsStore.ts	navHints, units, navView prefs
utils/mapHelpers.ts	Shared Step, Coords, EngineResult types
app/(tabs)/map.tsx	Camera, recenter button, overlay wiring

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