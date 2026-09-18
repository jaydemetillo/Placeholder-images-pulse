import { licenseLabel, requiresAttribution } from '../image-library/license-policy';
import type { ApprovedImage } from '../image-library/types';

/**
 * Visible credit for CC BY.
 *
 * CC BY carries a legal attribution requirement, so its credit is rendered as visible
 * text in the document flow — never a `title` tooltip, which screen readers and touch
 * users cannot reach. CC0 and PDM impose no requirement; their provenance is exposed to
 * assistive technology via the accessible credit area without adding visual noise to a
 * dense list.
 *
 * Two variants, both visible: `inline` is the compact credit under an item name, and
 * `block` is the fuller entry in the *Image credits* section, which also carries the
 * statement of changes CC BY asks for.
 */
export function ImageCredit({ image, variant = 'inline' }: { image: ApprovedImage; variant?: 'inline' | 'block' }) {
  const mustShow = requiresAttribution(image.license);

  const sourceLink = (label: string) => (
    <a className="credit__link" href={image.sourcePageUrl} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
  const licence = (
    <a className="credit__link" href={image.licenseUrl} target="_blank" rel="noopener noreferrer">
      {licenseLabel(image.license, image.licenseVersion)}
    </a>
  );

  if (!mustShow) {
    // Public-domain provenance: available to assistive tech, hidden from the visual list.
    return (
      <span className="credit credit--sr-only">
        {image.title}
        {image.creator ? ` by ${image.creator}` : ''}, {image.attribution}
      </span>
    );
  }

  if (variant === 'inline') {
    /*
     * The compact credit under an item name. It names the creator and the licence and
     * links to the source page — never truncated, because a clipped credit is not a
     * credit. The title and the statement of changes would not fit a dense list row, so
     * they go in the block entry at the foot of the same screen, which every CC BY image
     * on screen gets.
     */
    return (
      <span className="credit credit--inline">
        Photo: {sourceLink(image.creator ?? image.title)}, {licence}
      </span>
    );
  }

  return (
    <span className="credit credit--block">
      {sourceLink(image.title)}
      {image.creator ? <> by {image.creator}</> : null}, {licence}
      {/* CC BY asks for changes to be indicated, not just the licence named. */}
      {image.modifications ? <> — {image.modifications}</> : null}
    </span>
  );
}
