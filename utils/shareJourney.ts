import { Share } from "react-native";

interface ShareableLocation {
  name: string;
  lat: number;
  lng: number;
}

export async function shareJourney(fromLoc: ShareableLocation, toLoc: ShareableLocation): Promise<void> {
  const url =
    `hopln://journey` +
    `?from=${encodeURIComponent(fromLoc.name)}` +
    `&from_lat=${fromLoc.lat}` +
    `&from_lng=${fromLoc.lng}` +
    `&to=${encodeURIComponent(toLoc.name)}` +
    `&to_lat=${toLoc.lat}` +
    `&to_lng=${toLoc.lng}`;

  await Share.share({
    message: `Get directions from ${fromLoc.name} to ${toLoc.name} on Hopln:\n${url}`,
    url,
  });
}
