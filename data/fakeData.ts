import { stops } from "./stops";

export type Route = { id: string; shortName: string; longName?: string; color?: string; stopIds: string[] };
export type Trip  = { id: string; routeId: string; headsign?: string; direction?: number; shapeId?: string; stopIds: string[] };

/**
 * Real stop records taken from your stops.dbf (GTFS-style fields: stop_id, stop_name, stop_lat, stop_lon).
 * I curated this set around Embakasi / Donholm / Umoja / Kayole / Komarock.
 * You can safely expand this list later with the full file above.
 */
export const sampleStops = stops;

/**
 * Lightweight sample routes pulled from shapes.dbf attributes (route_id, route_name, route_long),
 * and then mapped onto nearby stops by name. You can refine these per your real GTFS.
 */
export const sampleRoutes: Route[] = [
  { id: '30600017A11', shortName: '17Aky', longName: 'Donholm, Umoja 1, Kayole Junction', color: '#2563EB',
    stopIds: ['0310JDN','0310RHT','0311SGR','0310TXT','0311RUI','0310SFC','0311AJL'] },
  { id: '30600018C11', shortName: '18C', longName: 'Umoja II, Donholm, Umoja I', color: '#16A34A',
    stopIds: ['0311RUI','0310TXT','0311SGR','0310RHT','0310JDN'] },
  { id: '40100003311', shortName: '33', longName: 'Transami, Taj Mall, GM', color: '#DC2626',
    stopIds: ['0210NAM','0400TRN','0210ARM','0400PPL','0401JTA','0401GM'] },
  { id: '40700003311', shortName: '33', longName: 'Pipeline, Fedha, Nyayo', color: '#7C3AED',
    stopIds: ['0401PIP','0110KIA','0111FED','0110Bay','0400NYE'] },
  { id: '30600017AK0', shortName: '17Aky', longName: 'Kayole Junction, Umoja I, Donholm', color: '#EA580C',
    stopIds: ['0311AJL','0310SFC','0311RUI','0310TXT','0311SGR','0310RHT','0310JDN'] },
];

/**
 * Trips (one or two directions per route), linked back by routeId.
 * For now we reuse the route’s stop order; for opposite direction we reverse it.
 */
export const sampleTrips: Trip[] = [
  { id: '30600017A11-0', routeId: '30600017A11', headsign: 'Donholm → Kayole Jn', direction: 0, shapeId: 'shp-17A-in', stopIds: ['0310JDN','0310RHT','0311SGR','0310TXT','0311RUI','0310SFC','0311AJL'] },
  { id: '30600017A11-1', routeId: '30600017A11', headsign: 'Kayole Jn → Donholm', direction: 1, shapeId: 'shp-17A-out', stopIds: ['0311AJL','0310SFC','0311RUI','0310TXT','0311SGR','0310RHT','0310JDN'] },

  { id: '30600018C11-0', routeId: '30600018C11', headsign: 'Umoja II → Donholm', direction: 0, shapeId: 'shp-18C-in', stopIds: ['0311RUI','0310TXT','0311SGR','0310RHT','0310JDN'] },
  { id: '30600018C11-1', routeId: '30600018C11', headsign: 'Donholm → Umoja II', direction: 1, shapeId: 'shp-18C-out', stopIds: ['0310JDN','0310RHT','0311SGR','0310TXT','0311RUI'] },

  { id: '40100003311-0', routeId: '40100003311', headsign: 'Transami → GM', direction: 0, shapeId: 'shp-33-west', stopIds: ['0210NAM','0400TRN','0210ARM','0400PPL','0401JTA','0401GM'] },
  { id: '40100003311-1', routeId: '40100003311', headsign: 'GM → Transami', direction: 1, shapeId: 'shp-33-east', stopIds: ['0401GM','0401JTA','0400PPL','0210ARM','0400TRN','0210NAM'] },

  { id: '40700003311-0', routeId: '40700003311', headsign: 'Pipeline → Nyayo', direction: 0, shapeId: 'shp-33-north', stopIds: ['0401PIP','0110KIA','0111FED','0110Bay','0400NYE'] },
  { id: '40700003311-1', routeId: '40700003311', headsign: 'Nyayo → Pipeline', direction: 1, shapeId: 'shp-33-south', stopIds: ['0400NYE','0110Bay','0111FED','0110KIA','0401PIP'] },

  { id: '30600017AK0-0', routeId: '30600017AK0', headsign: 'Kayole Jn → Donholm', direction: 0, shapeId: 'shp-17A-alt', stopIds: ['0311AJL','0310SFC','0311RUI','0310TXT','0311SGR','0310RHT','0310JDN'] },
  { id: '30600017AK0-1', routeId: '30600017AK0', headsign: 'Donholm → Kayole Jn', direction: 1, shapeId: 'shp-17A-altR', stopIds: ['0310JDN','0310RHT','0311SGR','0310TXT','0311RUI','0310SFC','0311AJL'] },
];
