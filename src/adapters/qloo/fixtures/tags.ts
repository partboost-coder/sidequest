/**
 * Mock tag vocabulary. IDs use a `urn:tag:mock:` prefix on purpose: real Qloo tag IDs are
 * discovered in spike S6, and app code must never depend on tag ID formats.
 */
export const MOCK_TAGS = {
  vietnamese: { id: "urn:tag:mock:cuisine:vietnamese", name: "Vietnamese", type: "cuisine" },
  mexican: { id: "urn:tag:mock:cuisine:mexican", name: "Mexican", type: "cuisine" },
  tacos: { id: "urn:tag:mock:cuisine:tacos", name: "Tacos", type: "cuisine" },
  bbq: { id: "urn:tag:mock:cuisine:bbq", name: "Barbecue", type: "cuisine" },
  diner: { id: "urn:tag:mock:cuisine:diner", name: "Diner", type: "cuisine" },
  bakery: { id: "urn:tag:mock:cuisine:bakery", name: "Bakery", type: "cuisine" },
  coffee: { id: "urn:tag:mock:place:coffee", name: "Specialty coffee", type: "place" },
  brewery: { id: "urn:tag:mock:place:brewery", name: "Brewery", type: "place" },
  diveBar: { id: "urn:tag:mock:place:dive_bar", name: "Dive bar", type: "place" },
  artGallery: { id: "urn:tag:mock:place:art_gallery", name: "Art gallery", type: "place" },
  mural: { id: "urn:tag:mock:place:street_art", name: "Street art", type: "place" },
  museum: { id: "urn:tag:mock:place:museum", name: "Museum", type: "place" },
  carMuseum: { id: "urn:tag:mock:place:car_museum", name: "Car museum", type: "place" },
  vintage: { id: "urn:tag:mock:place:vintage", name: "Vintage store", type: "place" },
  recordStore: { id: "urn:tag:mock:place:record_store", name: "Record store", type: "place" },
  bookstore: { id: "urn:tag:mock:place:bookstore", name: "Bookstore", type: "place" },
  liveMusic: { id: "urn:tag:mock:place:live_music", name: "Live music", type: "place" },
  indieMusic: { id: "urn:tag:mock:genre:indie", name: "Indie music", type: "genre" },
  hiking: { id: "urn:tag:mock:activity:hiking", name: "Hiking", type: "activity" },
  scenic: { id: "urn:tag:mock:activity:scenic_drive", name: "Scenic drive", type: "activity" },
  viewpoint: { id: "urn:tag:mock:place:viewpoint", name: "Scenic viewpoint", type: "place" },
  nationalPark: { id: "urn:tag:mock:place:national_park", name: "National park", type: "place" },
  hotSprings: { id: "urn:tag:mock:place:hot_springs", name: "Hot springs", type: "place" },
  desert: { id: "urn:tag:mock:landscape:desert", name: "Desert", type: "landscape" },
  mountain: { id: "urn:tag:mock:landscape:mountain", name: "Mountains", type: "landscape" },
  roadside: {
    id: "urn:tag:mock:place:roadside_attraction",
    name: "Roadside attraction",
    type: "place",
  },
  cars: { id: "urn:tag:mock:interest:cars", name: "Cars", type: "interest" },
  outdoors: { id: "urn:tag:mock:interest:outdoors", name: "Outdoors", type: "interest" },
  hotel: { id: "urn:tag:mock:place:hotel", name: "Hotel", type: "place" },
  boutiqueHotel: { id: "urn:tag:mock:place:boutique_hotel", name: "Boutique hotel", type: "place" },
  motel: { id: "urn:tag:mock:place:motel", name: "Retro motel", type: "place" },
} as const;

export type MockTagKey = keyof typeof MOCK_TAGS;

export const MOCK_TAG_LIST = Object.values(MOCK_TAGS);

/**
 * Real Qloo place-tag IDs (validated in v0.2.0 task 2.4, used by the corridor-scan buckets and
 * exclusions) → the mock tags they correspond to, so mock `filter.tags` / `filter.exclude.tags`
 * behave like the real API. Tag IDs only; no Qloo response data.
 */
const real = (suffixes: string[], key: MockTagKey) =>
  suffixes.map((s) => [`urn:tag:${s}`, key] as const);

export const REAL_TAG_ALIASES = new Map<string, MockTagKey>([
  ...real(
    ["category:place:vietnamese_restaurant", "genre:place:restaurant:vietnamese"],
    "vietnamese",
  ),
  ...real(["category:place:mexican_restaurant", "genre:place:restaurant:mexican"], "mexican"),
  ...real(["category:place:taco_restaurant", "genre:place:restaurant:taco"], "tacos"),
  ...real(
    [
      "category:place:coffee_shop",
      "genre:place:restaurant:coffee_shop",
      "category:place:cafe",
      "genre:place:restaurant:cafe",
    ],
    "coffee",
  ),
  ...real(["category:place:bakery", "genre:place:restaurant:bakery"], "bakery"),
  ...real(["category:place:diner", "genre:place:restaurant:diner"], "diner"),
  ...real(["category:place:barbecue_restaurant", "genre:place:restaurant:barbecue"], "bbq"),
  ...real(["category:place:hiking_area", "genre:place:hiking_area"], "hiking"),
  ...real(["category:place:scenic_spot", "genre:place:scenic_spot"], "viewpoint"),
  ...real(["category:place:national_park", "category:place:state_park"], "nationalPark"),
  ...real(["category:place:art_gallery", "genre:place:art_gallery"], "artGallery"),
  ...real(["category:place:art_museum", "category:place:museum", "genre:place:museum"], "museum"),
  ...real(
    [
      "category:place:vintage_clothing_store",
      "category:place:thrift_store",
      "category:place:antique_store",
    ],
    "vintage",
  ),
  ...real(["category:place:record_store"], "recordStore"),
  ...real(["category:place:live_music_venue"], "liveMusic"),
  ...real(["category:place:hot_spring"], "hotSprings"),
  ...real(["category:place:car_racing_track"], "carMuseum"),
  ...real(["category:place:tourist_attraction", "genre:place:tourist_attraction"], "roadside"),
  ...real(["category:place:hotel", "genre:place:hotel"], "hotel"),
]);
