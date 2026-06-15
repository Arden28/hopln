// Superseded by components/map/HeadingBeam.tsx + showsUserLocation={true}.
// The Polygon/Circle/Marker approach was replaced because all react-native-maps
// overlays on Android PROVIDER_GOOGLE can be dropped during camera animations.
// HeadingBeam renders as a plain React Native View above the MapView, which is
// immune to that lifecycle. This file is intentionally left empty.
export {};
