/**
 * Corridor-scan buckets. Every tag ID here was validated against Qloo's /v2/tags on 2026-10-13
 * (v0.2.0 task 2.4). Places carry both `category:place:*` and `genre:place:*` tags, so each
 * concept lists both forms; Qloo matches filter.tags as a union.
 */

const t = (suffix: string) => `urn:tag:${suffix}`;

export type BucketId = "food" | "experience";

export interface Bucket {
  id: BucketId;
  label: string;
  /** Passed as `filter.tags` (union). */
  tags: string[];
}

export const BUCKETS: Record<BucketId, Bucket> = {
  food: {
    id: "food",
    label: "Food & drink",
    tags: [
      t("category:place:vietnamese_restaurant"),
      t("genre:place:restaurant:vietnamese"),
      t("category:place:mexican_restaurant"),
      t("genre:place:restaurant:mexican"),
      t("category:place:taco_restaurant"),
      t("genre:place:restaurant:taco"),
      t("category:place:coffee_shop"),
      t("genre:place:restaurant:coffee_shop"),
      t("category:place:cafe"),
      t("genre:place:restaurant:cafe"),
      t("category:place:bakery"),
      t("genre:place:restaurant:bakery"),
      t("category:place:diner"),
      t("genre:place:restaurant:diner"),
      t("category:place:barbecue_restaurant"),
      t("genre:place:restaurant:barbecue"),
    ],
  },
  experience: {
    id: "experience",
    label: "Experiences",
    tags: [
      t("category:place:hiking_area"),
      t("genre:place:hiking_area"),
      t("category:place:scenic_spot"),
      t("genre:place:scenic_spot"),
      t("category:place:national_park"),
      t("category:place:state_park"),
      t("category:place:art_gallery"),
      t("genre:place:art_gallery"),
      t("category:place:art_museum"),
      t("category:place:museum"),
      t("genre:place:museum"),
      t("category:place:vintage_clothing_store"),
      t("category:place:thrift_store"),
      t("category:place:antique_store"),
      t("category:place:record_store"),
      t("category:place:live_music_venue"),
      t("category:place:hot_spring"),
      t("category:place:car_racing_track"),
      t("category:place:tourist_attraction"),
      t("genre:place:tourist_attraction"),
    ],
  },
};

/** Never recommended as stops or Side Quests (passed as `filter.exclude.tags`). */
export const EXCLUDED_TAGS: string[] = [
  t("category:place:casino"),
  t("genre:place:casino"),
  t("category:place:casino_hotel"),
  t("category:place:hotel"),
  t("genre:place:hotel"),
  t("category:place:gas_station"),
  t("category:place:fast_food_restaurant"),
  t("category:place:fast_food"),
  t("genre:place:restaurant:fast_food"),
  t("category:place:convenience_store"),
  t("category:place:supermarket"),
  t("category:place:grocery_store"),
  t("category:place:car_dealer"),
  t("category:place:car_wash"),
  t("category:place:car_rental_agency"),
];
