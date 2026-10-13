/**
 * The demo crew for the vertical slice and "Try the demo trip". Favorites were chosen by the
 * product owner from real Qloo /search results on 2026-10-13 (v0.2.0 task 2.2). Only Qloo IDs,
 * names and validated tag IDs are stored here: never raw Qloo responses.
 *
 * `tasteTags` are validated *place* tags that describe what each traveler is into. They drive
 * "why" explanations (tag overlap with a place); favorites' own tags are cross-domain and rarely
 * overlap with place tags.
 */

export interface Favorite {
  qlooId: string;
  name: string;
  type: string;
}

export interface TasteTag {
  id: string;
  label: string;
}

export interface Traveler {
  id: string;
  name: string;
  color: string;
  emoji: string;
  favorites: Favorite[];
  tasteTags: TasteTag[];
}

const tag = (suffix: string, label: string): TasteTag => ({ id: `urn:tag:${suffix}`, label });

export const DEMO_CREW: Traveler[] = [
  {
    id: "matt",
    name: "Matt",
    color: "#ea580c",
    emoji: "🏎️",
    favorites: [
      { qlooId: "F8CD265E-D9F9-447E-838C-9C004DB8F36F", name: "Phở 79", type: "urn:entity:place" },
      {
        qlooId: "A0AD5611-ADBB-4F6A-81FE-E9B9CA57063D",
        name: "Guelaguetza Restaurant",
        type: "urn:entity:place",
      },
      {
        qlooId: "D2DF5D6E-1233-4B1C-BB40-45FDD1382819",
        name: "Ford v Ferrari",
        type: "urn:entity:movie",
      },
      {
        qlooId: "52466D6F-50B2-427D-9AB2-1A3AC7D52F50",
        name: "Joshua Tree National Park",
        type: "urn:entity:place",
      },
    ],
    tasteTags: [
      tag("category:place:vietnamese_restaurant", "Vietnamese food"),
      tag("genre:place:restaurant:vietnamese", "Vietnamese food"),
      tag("category:place:mexican_restaurant", "Mexican food"),
      tag("genre:place:restaurant:mexican", "Mexican food"),
      tag("category:place:taco_restaurant", "tacos"),
      tag("category:place:car_racing_track", "cars"),
      tag("category:place:scenic_spot", "scenic drives"),
      tag("genre:place:scenic_spot", "scenic drives"),
      tag("category:place:national_park", "the outdoors"),
      tag("category:place:state_park", "the outdoors"),
      tag("category:place:hiking_area", "the outdoors"),
    ],
  },
  {
    id: "alex",
    name: "Alex",
    color: "#7c3aed",
    emoji: "🎨",
    favorites: [
      {
        qlooId: "AFBC71A7-9439-4AB0-AB68-D14B11AAF836",
        name: "Phoebe Bridgers",
        type: "urn:entity:artist",
      },
      {
        qlooId: "22B1BC87-CDFE-4340-86F8-8E0E6E1E6A7D",
        name: "Blue Bottle Coffee",
        type: "urn:entity:brand",
      },
      {
        qlooId: "D0E89E89-8C40-40FF-8F0C-40A1CE40D763",
        name: "The Broad",
        type: "urn:entity:place",
      },
      {
        qlooId: "DB4CE34E-3A63-4947-946F-9D52502C5762",
        name: "Patagonia",
        type: "urn:entity:brand",
      },
    ],
    tasteTags: [
      tag("category:place:art_gallery", "art"),
      tag("genre:place:art_gallery", "art"),
      tag("category:place:art_museum", "art"),
      tag("category:place:coffee_shop", "coffee"),
      tag("genre:place:restaurant:coffee_shop", "coffee"),
      tag("category:place:cafe", "coffee"),
      tag("category:place:vintage_clothing_store", "vintage"),
      tag("category:place:thrift_store", "vintage"),
      tag("category:place:antique_store", "vintage"),
      tag("category:place:record_store", "indie music"),
      tag("category:place:live_music_venue", "indie music"),
      tag("category:place:hiking_area", "hiking"),
      tag("genre:place:hiking_area", "hiking"),
    ],
  },
];

/** Union of every traveler's favorites (the corridor scan's group signal). */
export function crewSignalIds(crew: Traveler[]): string[] {
  return [...new Set(crew.flatMap((t) => t.favorites.map((f) => f.qlooId)))];
}
