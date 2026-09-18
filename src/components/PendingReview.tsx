import { useState } from 'react';
import { licenseLabel, requiresAttribution } from '../image-library/license-policy';
import { allChecked, approvePending, assignImage, ApprovalRejectedError } from '../image-library/store';
import { getPlaceholder } from '../image-library/placeholders';
import { assetUrl } from '../image-library/asset-url';
import { CHECKLIST_ITEMS, type PendingImage, type ReviewChecklist } from '../image-library/types';

const EMPTY_CHECKLIST: ReviewChecklist = {
  realPhotoChecked: false,
  matchesEquipmentChecked: false,
  sourceAndLicenceChecked: false,
  noPatientInfoChecked: false,
};

/**
 * The review queue for images that were sourced for a slot but not vetted.
 *
 * Everything here is inert until a human acts: a pending record has all four
 * attestations false and no reviewer, and `resolveImage` refuses it, so nothing in this
 * panel is on a screen. Approving still does not publish — it only makes the record
 * eligible for the separate "Use for …" step, same as any other approved image.
 */
export function PendingReview({ items }: { items: PendingImage[] }) {
  const [reviewer, setReviewer] = useState('');
  const [checklists, setChecklists] = useState<Record<string, ReviewChecklist>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) {
    return <p className="note">Nothing waiting for review.</p>;
  }

  const checklistFor = (id: string) => checklists[id] ?? EMPTY_CHECKLIST;

  function toggle(id: string, key: keyof ReviewChecklist, value: boolean) {
    setChecklists((c) => ({ ...c, [id]: { ...checklistFor(id), [key]: value } }));
  }

  function approve(image: PendingImage) {
    try {
      approvePending(image.id, checklistFor(image.id), reviewer);
      setError(null);
      const slot = image.sourcedForPlaceholderId
        ? getPlaceholder(image.sourcedForPlaceholderId)
        : undefined;
      setNotice(
        slot
          ? `Approved “${image.title}”. It is still not on any screen — use “Assign to ${slot.label}” below to publish it.`
          : `Approved “${image.title}”. It is in the library but not yet on any screen.`,
      );
    } catch (e) {
      setNotice(null);
      setError(e instanceof ApprovalRejectedError ? e.message : String(e));
    }
  }

  return (
    <>
      <p className="note">
        These were sourced from Openverse and downloaded into <code>public/images/</code>, so the
        app serves the exact files below rather than hotlinking a third-party host. None of them
        is approved, no box is ticked, and none is on a screen. Open each source page, confirm the
        licence yourself, then tick all four.
      </p>

      <label className="reviewer">
        Reviewer name — applies to everything you approve here
        <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name" />
      </label>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}

      <ul className="pending">
        {items.map((image) => {
          const checklist = checklistFor(image.id);
          const slot = image.sourcedForPlaceholderId
            ? getPlaceholder(image.sourcedForPlaceholderId)
            : undefined;
          const ready = allChecked(checklist) && reviewer.trim().length > 0;

          return (
            <li className="pending__item" key={image.id}>
              <div className="pending__preview">
                <img src={assetUrl(image.imageUrl)} alt={`Staged image for ${slot?.label ?? image.title}`} />
                <code>{image.imageUrl}</code>
              </div>

              <div className="pending__body">
                <p className="pending__slot">
                  {slot ? slot.label : 'No slot suggested'} <code>{image.id}</code>
                  <span className="badge badge--pending">Pending your review</span>
                </p>

                <dl className="review__facts">
                  <dt>Title</dt>
                  <dd>{image.title}</dd>
                  <dt>Creator</dt>
                  <dd>{image.creator ?? 'Unknown'}</dd>
                  <dt>Licence</dt>
                  <dd>
                    <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">
                      {licenseLabel(image.license, image.licenseVersion)} ↗
                    </a>
                    {requiresAttribution(image.license) && ' — credit must be displayed'}
                  </dd>
                  <dt>Source page</dt>
                  <dd>
                    <a href={image.sourcePageUrl} target="_blank" rel="noopener noreferrer">
                      {image.sourcePageUrl} ↗
                    </a>
                  </dd>
                  <dt>Original file</dt>
                  <dd>
                    {image.originalFileUrl ? (
                      <a href={image.originalFileUrl} target="_blank" rel="noopener noreferrer">
                        {image.originalFileUrl} ↗
                      </a>
                    ) : (
                      '—'
                    )}
                  </dd>
                  <dt>Attribution</dt>
                  <dd>{image.attribution}</dd>
                  {image.modifications && (
                    <>
                      <dt>Changes made</dt>
                      <dd>{image.modifications}</dd>
                    </>
                  )}
                </dl>

                {image.sourcingNote && <p className="pending__note">{image.sourcingNote}</p>}

                <fieldset className="checklist">
                  <legend>All four are required</legend>
                  {CHECKLIST_ITEMS.map((item) => (
                    <label key={item.key}>
                      <input
                        type="checkbox"
                        checked={checklist[item.key]}
                        onChange={(e) => toggle(image.id, item.key, e.target.checked)}
                      />
                      {item.label}
                    </label>
                  ))}
                </fieldset>

                <div className="review__actions">
                  <button className="primary" onClick={() => approve(image)} disabled={!ready}>
                    Approve {image.id}
                  </button>
                  {!ready && (
                    <span className="note">Tick every box and enter your name to enable approval.</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Publishes an already-approved image onto the slot it was sourced for. */
export function AssignToSourcedSlot({ imageId, placeholderId }: { imageId: string; placeholderId: string }) {
  const slot = getPlaceholder(placeholderId);
  if (!slot) return null;
  return (
    <button className="secondary" onClick={() => assignImage(placeholderId, imageId)}>
      Assign to {slot.label}
    </button>
  );
}
