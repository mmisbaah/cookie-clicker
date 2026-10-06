/**
 * Every drawn icon, by the emoji that keys it.
 *
 * Split by category so the file that defines a cookie is not the file that
 * defines a bank; `icon.js` sees one flat map. A `null` entry means "art not
 * written yet" and behaves exactly like a missing key: the emoji is drawn
 * instead. Art can therefore land one module at a time without the interface
 * ever showing a hole.
 *
 * The contract for adding anything here is in `tools/ICON-ART.md`.
 */

import { AWARD_ART } from './art/awards.js';
import { BUILDING_ART } from './art/buildings.js';
import { COOKIE_ART } from './art/cookie.js';
import { POWER_ART } from './art/powers.js';
import { WORLD_ART } from './art/world.js';

export const ART = {
  ...COOKIE_ART,
  ...BUILDING_ART,
  ...POWER_ART,
  ...AWARD_ART,
  ...WORLD_ART,
};
