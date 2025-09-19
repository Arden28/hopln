import { sampleStops } from "@/data/fakeData";
import Fuse from "fuse.js";

export type SearchableStop = (typeof sampleStops)[number] & {
  altNames?: string[];
  routeNames?: string[];
  popularity?: number; // optional metric if you have it
};

const options: Fuse.IFuseOptions<SearchableStop> = {
  keys: [
    { name: "name", weight: 0.6 },
    { name: "altNames", weight: 0.25 },
    { name: "routeNames", weight: 0.15 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeMatches: true,
  shouldSort: false, // we blend with proximity/popularity
};

export const fuse = new Fuse<SearchableStop>(sampleStops as SearchableStop[], options);
