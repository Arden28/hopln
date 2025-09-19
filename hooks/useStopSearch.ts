import { Storage } from "@/app/lib/storage";
import { fuse, type SearchableStop } from "@/search";
import { useEffect, useMemo, useState } from "react";

type Coords = { latitude: number; longitude: number };
const RECENTS_KEY = "stop-recents-v1";

// --- SAFE STORAGE SHIM (prevents crashes if native module not ready) ---
const memoryStore = new Map<string, string>();
const SafeStorage = Storage ?? ({
  async getItem(key: string) { return memoryStore.get(key) ?? null; },
  async setItem(key: string, val: string) { memoryStore.set(key, val); },
  async removeItem(key: string) { memoryStore.delete(key); },
} as Pick<typeof Storage, "getItem" | "setItem" | "removeItem">);
// ----------------------------------------------------------------------

export function useStopSearch(query: string, me: Coords | null) {
  const [recents, setRecents] = useState<SearchableStop[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await SafeStorage.getItem(RECENTS_KEY);
        if (mounted && s) setRecents(JSON.parse(s));
      } catch {
        // ignore; fall back to empty
      }
    })();
    return () => { mounted = false; };
  }, []);

  const results = useMemo(() => {
    const q = query.trim();
    if (q.length === 0) return { recents, matches: [] as any[] };

    const raw = fuse.search(q, { limit: 100 });

    const dMeters = (a: Coords, b: Coords) => {
      const toRad = (d: number) => (d * Math.PI) / 180;
      const R = 6371e3;
      const dLat = toRad(b.latitude - a.latitude);
      const dLon = toRad(b.longitude - a.longitude);
      const la1 = toRad(a.latitude);
      const la2 = toRad(b.latitude);
      const x = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
      return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    };

    const scored = raw.map((r) => {
      const s = r.item;
      const prox = me ? 1 / Math.max(50, dMeters(me, { latitude: s.lat, longitude: s.lng })) : 0;
      const pop = (s.popularity ?? 0) / 1000;
      const blended = 0.7 * (1 - (r.score ?? 0)) + 0.2 * prox + 0.1 * pop;
      return { ...r, blended };
    });

    scored.sort((a, b) => b.blended - a.blended);
    return { recents, matches: scored.slice(0, 30) };
  }, [query, me?.latitude, me?.longitude, recents]);

  const pushRecent = async (s: SearchableStop) => {
    const next = [s, ...recents.filter((r) => r.id !== s.id)].slice(0, 6);
    setRecents(next);
    try { await SafeStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch {}
  };

  return { ...results, pushRecent };
}
