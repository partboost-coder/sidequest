import type { QlooEntityType } from "../types";
import type { MockTagKey } from "./tags";

/**
 * Cross-domain search fixtures for favorites autocomplete. These are real, well-known cultural
 * entities (artists, films, brands, destinations…) with mock IDs. `implies` is mock-only data:
 * the place tags a fan of this entity tends to like, used to fake taste-driven affinity.
 */
export interface MockSearchEntity {
  id: string;
  name: string;
  type: QlooEntityType;
  subtype?: string;
  popularity: number;
  implies: MockTagKey[];
}

const e = (
  slug: string,
  name: string,
  type: QlooEntityType,
  popularity: number,
  implies: MockTagKey[],
  subtype?: string,
): MockSearchEntity => ({
  id: `mock-${type.split(":").pop()}-${slug}`,
  name,
  type,
  popularity,
  implies,
  subtype,
});

export const MOCK_ENTITIES: MockSearchEntity[] = [
  // Artists
  e("phoebe-bridgers", "Phoebe Bridgers", "urn:entity:artist", 0.86, [
    "indieMusic",
    "liveMusic",
    "recordStore",
    "coffee",
    "vintage",
  ]),
  e("khruangbin", "Khruangbin", "urn:entity:artist", 0.82, [
    "indieMusic",
    "liveMusic",
    "recordStore",
    "desert",
    "vintage",
  ]),
  e("mac-demarco", "Mac DeMarco", "urn:entity:artist", 0.78, [
    "indieMusic",
    "vintage",
    "diveBar",
    "recordStore",
  ]),
  e("tame-impala", "Tame Impala", "urn:entity:artist", 0.88, ["indieMusic", "liveMusic", "desert"]),
  e("japanese-breakfast", "Japanese Breakfast", "urn:entity:artist", 0.74, [
    "indieMusic",
    "liveMusic",
    "bookstore",
    "coffee",
  ]),
  e("bon-iver", "Bon Iver", "urn:entity:artist", 0.83, [
    "indieMusic",
    "mountain",
    "hiking",
    "coffee",
  ]),
  e("kendrick-lamar", "Kendrick Lamar", "urn:entity:artist", 0.95, ["liveMusic", "mural"]),
  e("fleetwood-mac", "Fleetwood Mac", "urn:entity:artist", 0.93, [
    "vintage",
    "recordStore",
    "scenic",
  ]),
  e("los-lobos", "Los Lobos", "urn:entity:artist", 0.66, ["mexican", "liveMusic", "diveBar"]),
  // Movies & TV
  e("drive", "Drive", "urn:entity:movie", 0.84, ["cars", "scenic", "vintage"]),
  e("ford-v-ferrari", "Ford v Ferrari", "urn:entity:movie", 0.86, [
    "cars",
    "carMuseum",
    "roadside",
  ]),
  e("little-miss-sunshine", "Little Miss Sunshine", "urn:entity:movie", 0.82, [
    "roadside",
    "diner",
    "scenic",
    "motel",
  ]),
  e("into-the-wild", "Into the Wild", "urn:entity:movie", 0.83, [
    "hiking",
    "nationalPark",
    "outdoors",
    "mountain",
  ]),
  e("paris-texas", "Paris, Texas", "urn:entity:movie", 0.7, [
    "desert",
    "motel",
    "artGallery",
    "roadside",
  ]),
  e("thelma-louise", "Thelma & Louise", "urn:entity:movie", 0.8, [
    "desert",
    "scenic",
    "cars",
    "diveBar",
  ]),
  e("baby-driver", "Baby Driver", "urn:entity:movie", 0.84, ["cars", "recordStore", "diner"]),
  e("top-gear", "Top Gear", "urn:entity:tv_show", 0.85, ["cars", "carMuseum", "scenic"]),
  e("the-bear", "The Bear", "urn:entity:tv_show", 0.88, ["bakery", "diner", "coffee"]),
  e("parts-unknown", "Anthony Bourdain: Parts Unknown", "urn:entity:tv_show", 0.84, [
    "vietnamese",
    "mexican",
    "tacos",
    "diveBar",
  ]),
  e("chefs-table", "Chef's Table", "urn:entity:tv_show", 0.79, ["vietnamese", "mexican", "bakery"]),
  // Brands
  e("patagonia", "Patagonia", "urn:entity:brand", 0.9, [
    "hiking",
    "outdoors",
    "nationalPark",
    "mountain",
  ]),
  e("porsche", "Porsche", "urn:entity:brand", 0.92, ["cars", "carMuseum", "scenic"]),
  e("blue-bottle", "Blue Bottle Coffee", "urn:entity:brand", 0.8, [
    "coffee",
    "bakery",
    "artGallery",
  ]),
  e("stumptown", "Stumptown Coffee Roasters", "urn:entity:brand", 0.72, [
    "coffee",
    "recordStore",
    "vintage",
  ]),
  e("levis", "Levi's", "urn:entity:brand", 0.91, ["vintage", "roadside"]),
  e("arcteryx", "Arc'teryx", "urn:entity:brand", 0.81, ["hiking", "mountain", "outdoors"]),
  e("toyota-tacoma", "Toyota", "urn:entity:brand", 0.95, ["cars", "outdoors", "scenic"]),
  e("polaroid", "Polaroid", "urn:entity:brand", 0.77, ["vintage", "artGallery", "roadside"]),
  // Destinations
  e("joshua-tree", "Joshua Tree National Park", "urn:entity:destination", 0.86, [
    "desert",
    "hiking",
    "nationalPark",
    "artGallery",
  ]),
  e("big-sur", "Big Sur", "urn:entity:destination", 0.87, ["scenic", "viewpoint", "hiking"]),
  e("zion", "Zion National Park", "urn:entity:destination", 0.89, [
    "hiking",
    "nationalPark",
    "viewpoint",
  ]),
  e("marfa", "Marfa", "urn:entity:destination", 0.68, [
    "artGallery",
    "desert",
    "boutiqueHotel",
    "coffee",
  ]),
  e("mexico-city", "Mexico City", "urn:entity:destination", 0.93, [
    "mexican",
    "tacos",
    "artGallery",
    "mural",
  ]),
  e("kyoto", "Kyoto", "urn:entity:destination", 0.9, ["coffee", "artGallery", "bakery"]),
  // Restaurants (as places)
  e("pho-79", "Pho 79", "urn:entity:place", 0.71, ["vietnamese"], "restaurant"),
  e("guelaguetza", "Guelaguetza", "urn:entity:place", 0.78, ["mexican", "liveMusic"], "restaurant"),
  e("in-n-out", "In-N-Out Burger", "urn:entity:place", 0.97, ["diner", "roadside"], "restaurant"),
  // Books & podcasts
  e("on-the-road", "On the Road", "urn:entity:book", 0.82, ["roadside", "diveBar", "scenic"]),
  e("desert-solitaire", "Desert Solitaire", "urn:entity:book", 0.6, [
    "desert",
    "hiking",
    "nationalPark",
  ]),
  e("song-exploder", "Song Exploder", "urn:entity:podcast", 0.7, ["indieMusic", "recordStore"]),
];

export const MOCK_ENTITY_BY_ID = new Map(MOCK_ENTITIES.map((x) => [x.id, x]));
