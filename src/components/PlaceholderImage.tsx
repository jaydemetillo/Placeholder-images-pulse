import { useResolvedImage } from '../image-library/useImageLibrary';
import { getPlaceholder } from '../image-library/placeholders';
import { assetUrl } from '../image-library/asset-url';

/**
 * Renders the approved image bound to a slot, or a neutral fallback when the slot is
 * still unassigned. There is no third path: an unapproved image cannot reach this
 * component, because `useResolvedImage` only returns records from the approved pool.
 */
export function PlaceholderImage({
  placeholderId,
  alt,
  className = '',
}: {
  placeholderId: string;
  alt?: string;
  className?: string;
}) {
  const image = useResolvedImage(placeholderId);
  const placeholder = getPlaceholder(placeholderId);
  const label = alt ?? placeholder?.label ?? 'Equipment image';

  if (!image) {
    return (
      <div
        className={`thumb thumb--empty ${className}`}
        role="img"
        aria-label={`${label} — no approved image yet`}
        data-placeholder-id={placeholderId}
      >
        <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <rect x="7" y="13" width="34" height="24" rx="3" className="thumb__box" />
          <path d="M7 21h34" className="thumb__line" />
          <path d="M20 13v8" className="thumb__line" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`thumb ${className}`} data-placeholder-id={placeholderId}>
      <img src={assetUrl(image.imageUrl)} alt={label} loading="lazy" />
    </div>
  );
}
