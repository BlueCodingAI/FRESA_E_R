import { SITE_TRIPLES } from "./site-messages-data";

export const SITE_EN: Record<string, string> = {};
export const SITE_RU: Record<string, string> = {};

for (const [key, en, ru] of SITE_TRIPLES) {
  SITE_EN[key] = en;
  SITE_RU[key] = ru;
}
