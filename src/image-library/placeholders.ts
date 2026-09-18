import type { Placeholder } from './types';

/**
 * STABLE PLACEHOLDER IDS.
 *
 * Derived from the "Transfer stock" storeroom screen, where every row currently reuses
 * the same nitrile-gloves thumbnail. Each distinct piece of equipment gets its own slot
 * so rows stop sharing one image.
 *
 * These ids are a contract: they are referenced by assignments.json and by approved
 * image records. Renaming one orphans its assignment. Add new ids, never repurpose
 * existing ones.
 */
export const PLACEHOLDERS: Placeholder[] = [
  {
    id: 'digital-stethoscope',
    label: 'Digital stethoscope thumbnail',
    searchWords: 'digital stethoscope medical equipment',
    shape: 'square',
    needsPeople: false,
    allowsBrandLogos: false,
  },
  {
    id: 'blood-pressure-cuff',
    label: 'Blood pressure cuff thumbnail',
    searchWords: 'blood pressure cuff sphygmomanometer',
    shape: 'square',
    needsPeople: false,
    allowsBrandLogos: false,
  },
  {
    id: 'surgical-headlamp',
    label: 'Surgical headlamp thumbnail',
    searchWords: 'surgical headlamp medical light',
    shape: 'square',
    needsPeople: false,
    allowsBrandLogos: false,
  },
  {
    id: 'aircast-walking-boot',
    label: 'Aircast walking boot thumbnail',
    searchWords: 'orthopedic walking boot cast',
    shape: 'square',
    needsPeople: false,
    allowsBrandLogos: false,
  },
  {
    id: 'surgical-suture-kit',
    label: 'Surgical suture kit thumbnail',
    searchWords: 'surgical suture kit sterile',
    shape: 'square',
    needsPeople: false,
    allowsBrandLogos: false,
  },
];

export function getPlaceholder(id: string): Placeholder | undefined {
  return PLACEHOLDERS.find((p) => p.id === id);
}
