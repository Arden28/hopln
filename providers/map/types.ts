export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface CameraOptions {
  center?: LatLng;
  zoom?: number;
  heading?: number;
  pitch?: number;
  duration?: number;
}

export interface EdgePadding {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}
