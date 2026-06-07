import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { useJourneyStore } from "@/store/journeyStore";

export default function JourneyDeepLink() {
  const router = useRouter();
  const { from, to, from_lat, from_lng, to_lat, to_lng } = useLocalSearchParams<{
    from: string;
    to: string;
    from_lat: string;
    from_lng: string;
    to_lat: string;
    to_lng: string;
  }>();

  useEffect(() => {
    if (from_lat && from_lng && to_lat && to_lng) {
      const fromLoc = { _type: "location" as const, id: "deep-from", name: from ?? "Origin",      lat: +from_lat, lng: +from_lng };
      const toLoc   = { _type: "location" as const, id: "deep-to",   name: to   ?? "Destination", lat: +to_lat,   lng: +to_lng   };
      useJourneyStore.getState().setJourney(fromLoc, toLoc, null as any);
    }
    router.replace("/(tabs)/map");
  }, []);

  return null;
}
