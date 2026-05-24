import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserService, SavedPlace, SavedJourney } from "@/services/user";
import { create } from "zustand";

const CUSTOM_LISTS_KEY = "hopln:custom_lists";

interface SavedStore {
  places:      SavedPlace[];
  journeys:    SavedJourney[];
  loaded:      boolean;
  customLists: string[];
  fetch:            () => Promise<void>;
  refresh:          () => Promise<void>;
  reset:            () => void;
  addPlace:         (data: Omit<SavedPlace, "id" | "created_at">) => Promise<SavedPlace>;
  removePlace:      (id: number) => Promise<void>;
  addJourney:       (data: Omit<SavedJourney, "id" | "created_at">) => Promise<SavedJourney>;
  removeJourney:    (id: number) => Promise<void>;
  addCustomList:    (name: string) => Promise<void>;
  removeCustomList: (name: string) => Promise<void>;
}

export const useSavedStore = create<SavedStore>((set, get) => ({
  places:      [],
  journeys:    [],
  loaded:      false,
  customLists: [],

  async fetch() {
    if (get().loaded) return;
    const [places, journeys, rawCustom] = await Promise.all([
      UserService.getSavedPlaces(),
      UserService.getSavedJourneys(),
      AsyncStorage.getItem(CUSTOM_LISTS_KEY).catch(() => null),
    ]);
    set({
      places,
      journeys,
      loaded:      true,
      customLists: rawCustom ? (JSON.parse(rawCustom) as string[]) : [],
    });
  },

  async refresh() {
    const [places, journeys] = await Promise.all([
      UserService.getSavedPlaces(),
      UserService.getSavedJourneys(),
    ]);
    set({ places, journeys, loaded: true });
  },

  reset() {
    set({ places: [], journeys: [], loaded: false });
  },

  async addPlace(data) {
    const place = await UserService.savePlace(data);
    set((s) => {
      const filtered = data.pin
        ? s.places.filter((p) => p.pin !== data.pin)
        : s.places;
      return { places: [place, ...filtered] };
    });
    return place;
  },

  async removePlace(id) {
    set((s) => ({ places: s.places.filter((p) => p.id !== id) }));
    await UserService.deletePlace(id);
  },

  async addJourney(data) {
    const journey = await UserService.saveJourney(data);
    set((s) => ({ journeys: [journey, ...s.journeys] }));
    return journey;
  },

  async removeJourney(id) {
    set((s) => ({ journeys: s.journeys.filter((j) => j.id !== id) }));
    await UserService.deleteJourney(id);
  },

  async addCustomList(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = [...new Set([...get().customLists, trimmed])];
    set({ customLists: next });
    await AsyncStorage.setItem(CUSTOM_LISTS_KEY, JSON.stringify(next));
  },

  async removeCustomList(name) {
    const next = get().customLists.filter((l) => l !== name);
    set({ customLists: next });
    await AsyncStorage.setItem(CUSTOM_LISTS_KEY, JSON.stringify(next));
  },
}));
