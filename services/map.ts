// services/map.ts
const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY as string;

export interface PlacePrediction {
  place_id:       string;
  description:    string;
  main_text:      string;
  secondary_text: string;
}

export const MapService = {
  async placesAutocomplete(
    query: string,
    proximityLat?: number,
    proximityLng?: number,
  ): Promise<PlacePrediction[]> {
    if (!query || query.length < 2) return [];

    const location =
      proximityLat != null && proximityLng != null
        ? `&location=${proximityLat},${proximityLng}&radius=30000`
        : "";

    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&region=ke&components=country:ke&language=en${location}&key=${GOOGLE_KEY}`,
      );
      const json = await res.json();
      if (!json.predictions) return [];
      return (json.predictions as any[]).slice(0, 5).map((r) => ({
        place_id:       r.place_id,
        description:    r.description,
        main_text:      r.structured_formatting?.main_text ?? r.description.split(",")[0],
        secondary_text: r.structured_formatting?.secondary_text ?? "",
      }));
    } catch {
      return [];
    }
  },

  async reverseGeocode(
    lat: number,
    lng: number,
  ): Promise<string> {
    const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,locality,neighborhood,address,poi&language=en&access_token=${token}`,
      );
      const json = await res.json();
      const first = json.features?.[0];
      return first?.text ?? first?.place_name?.split(",")[0] ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  },

  async getPlaceDetails(
    placeId: string,
  ): Promise<{ lat: number; lng: number; name: string } | null> {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry,name&key=${GOOGLE_KEY}`,
      );
      const json = await res.json();
      if (!json.result) return null;
      return {
        lat:  json.result.geometry.location.lat,
        lng:  json.result.geometry.location.lng,
        name: json.result.name ?? "",
      };
    } catch {
      return null;
    }
  },
};
