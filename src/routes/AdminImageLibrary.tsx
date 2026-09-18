import { useEffect, useState } from 'react';
import { PLACEHOLDERS } from '../image-library/placeholders';
import { searchCandidates } from '../image-library/search-source';
import { describeRejection, type FilterOutcome } from '../image-library/openverse';
import { licenseLabel } from '../image-library/license-policy';
import {
  approveCandidate,
  assignImage,
  unassign,
  allChecked,
  ApprovalRejectedError,
} from '../image-library/store';
import { useApproved, useAssignments, usePending } from '../image-library/useImageLibrary';
import { PendingReview, AssignToSourcedSlot } from '../components/PendingReview';
import { resolveImage } from '../image-library/resolve-image';
import { assetUrl } from '../image-library/asset-url';
import { CHECKLIST_ITEMS, type Candidate, type Placeholder, type ReviewChecklist } from '../image-library/types';

const EMPTY_CHECKLIST: ReviewChecklist = {
  realPhotoChecked: false,
  matchesEquipmentChecked: false,
  sourceAndLicenceChecked: false,
  noPatientInfoChecked: false,
};

/**
 * ADMIN-ONLY. Not linked from the app's navigation.
 *
 * Two deliberately separate actions, never combined into one button:
 *   approve  — vets a search result and admits it to the approved pool
 *   assign   — binds an already-approved image to a placeholder slot
 *
 * Nothing here publishes automatically. A search result reaches the live screen only
 * after a human ticks all four attestations and then explicitly assigns it.
 */
export function AdminImageLibrary() {
  const [slot, setSlot] = useState<Placeholder>(PLACEHOLDERS[0]);
  const [query, setQuery] = useState(PLACEHOLDERS[0].searchWords);
  const [useFixtures, setUseFixtures] = useState(true);
  const [outcome, setOutcome] = useState<FilterOutcome | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Candidate | null>(null);
  const [checklist, setChecklist] = useState<ReviewChecklist>(EMPTY_CHECKLIST);
  const [reviewer, setReviewer] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const approved = useApproved();
  const pending = usePending();
  const assignments = useAssignments();

  useEffect(() => {
    setQuery(slot.searchWords);
    setOutcome(null);
    setSelected(null);
  }, [slot]);

  async function runSearch() {
    setSearching(true);
    setError(null);
    setSelected(null);
    try {
      setOutcome(await searchCandidates(query, useFixtures));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOutcome(null);
    } finally {
      setSearching(false);
    }
  }

  function openReview(candidate: Candidate) {
    setSelected(candidate);
    setChecklist(EMPTY_CHECKLIST);
    setNotice(null);
  }

  function submitApproval() {
    if (!selected) return;
    try {
      const record = approveCandidate(selected, checklist, reviewer);
      setNotice(`Approved as ${record.id}. It is in the library but not yet on any screen — assign it below.`);
      setSelected(null);
      setChecklist(EMPTY_CHECKLIST);
    } catch (e) {
      setNotice(e instanceof ApprovalRejectedError ? e.message : String(e));
    }
  }

  const ready = allChecked(checklist) && reviewer.trim().length > 0;

  return (
    <div className="admin">
      <header className="admin__head">
        <p className="admin__badge">Admin only</p>
        <h1>Image Library</h1>
        <p className="admin__lede">
          Review the images already sourced for each slot, or search Openverse for more. Verify
          every one by hand, then assign the approved ones to placeholder slots. Nothing is
          published automatically — not a search result, and not a staged image.
        </p>
      </header>

      <section className="panel">
        <h2>1 · Choose a placeholder</h2>
        <div className="slots">
          {PLACEHOLDERS.map((p) => {
            const current = resolveImage(p.id, approved, assignments);
            return (
              <button
                key={p.id}
                className={`slot ${slot.id === p.id ? 'slot--on' : ''}`}
                onClick={() => setSlot(p)}
              >
                <span className="slot__label">{p.label}</span>
                <code className="slot__id">{p.id}</code>
                <span className={`slot__state ${current ? 'slot__state--set' : ''}`}>
                  {current ? `${current.id} assigned` : 'No image yet'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={`panel ${pending.length > 0 ? 'panel--review' : ''}`}>
        <h2>
          2 · Pending your review
          {pending.length > 0 && <span className="badge badge--pending">{pending.length}</span>}
        </h2>
        <PendingReview items={pending} />
      </section>

      <section className="panel">
        <h2>3 · Search Openverse for more</h2>
        <div className="searchbar">
          <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search terms" />
          <button className="primary" onClick={runSearch} disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={useFixtures} onChange={(e) => setUseFixtures(e.target.checked)} />
          Use offline fixtures (no network)
        </label>
        <p className="note">
          Showing only CC0, Public Domain Mark and CC BY results, with a{' '}
          <strong>likely non-AI</strong> metadata filter applied. This filter reads titles, tags,
          descriptions and creator names — it cannot inspect the picture itself, so it is not a
          guarantee. You must confirm by eye.
        </p>
        {error && <p className="error">Search failed: {error}</p>}

        {outcome && (
          <>
            <h3>{outcome.candidates.length} candidate{outcome.candidates.length === 1 ? '' : 's'}</h3>
            <ul className="cards">
              {outcome.candidates.map((c) => (
                <li className="card" key={c.openverseId}>
                  <div className="card__thumb">
                    {c.thumbnailUrl ? <img src={c.thumbnailUrl} alt="" loading="lazy" /> : <span>No preview</span>}
                  </div>
                  <div className="card__body">
                    <p className="card__title">{c.title}</p>
                    <p className="card__meta">{c.creator ?? 'Unknown creator'}</p>
                    <p className="card__licence">{licenseLabel(c.license, c.licenseVersion)}</p>
                    <a href={c.sourcePageUrl} target="_blank" rel="noopener noreferrer">Open source page ↗</a>
                  </div>
                  <button className="secondary" onClick={() => openReview(c)}>Review</button>
                </li>
              ))}
            </ul>

            {outcome.rejected.length > 0 && (
              <details className="rejected">
                <summary>{outcome.rejected.length} result(s) withheld by the filters</summary>
                <ul>
                  {outcome.rejected.map(({ result, reason }) => (
                    <li key={result.id}>
                      <span>{result.title ?? 'Untitled'}</span>
                      <em>{describeRejection(reason)}</em>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>

      {selected && (
        <section className="panel panel--review">
          <h2>4 · Verify before approving</h2>
          <div className="review">
            <div className="review__preview">
              {selected.thumbnailUrl ? <img src={selected.thumbnailUrl} alt="" /> : <span>No preview</span>}
            </div>
            <dl className="review__facts">
              <dt>Title</dt><dd>{selected.title}</dd>
              <dt>Creator</dt><dd>{selected.creator ?? 'Unknown'}</dd>
              <dt>Licence</dt>
              <dd><a href={selected.licenseUrl} target="_blank" rel="noopener noreferrer">{licenseLabel(selected.license, selected.licenseVersion)} ↗</a></dd>
              <dt>Source page</dt>
              <dd><a href={selected.sourcePageUrl} target="_blank" rel="noopener noreferrer">{selected.sourcePageUrl} ↗</a></dd>
              <dt>Attribution</dt><dd>{selected.attribution}</dd>
              <dt>Metadata scanned</dt><dd className="review__scanned">{selected.scannedText}</dd>
            </dl>
          </div>

          <fieldset className="checklist">
            <legend>All four are required</legend>
            {CHECKLIST_ITEMS.map((item) => (
              <label key={item.key}>
                <input
                  type="checkbox"
                  checked={checklist[item.key]}
                  onChange={(e) => setChecklist((c) => ({ ...c, [item.key]: e.target.checked }))}
                />
                {item.label}
              </label>
            ))}
          </fieldset>

          <label className="reviewer">
            Reviewer name
            <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name" />
          </label>

          <div className="review__actions">
            <button className="primary" onClick={submitApproval} disabled={!ready}>Approve image</button>
            <button className="secondary" onClick={() => setSelected(null)}>Cancel</button>
          </div>
          {!ready && <p className="note">Tick every box and enter your name to enable approval.</p>}
        </section>
      )}

      {notice && <p className="notice">{notice}</p>}

      <section className="panel">
        <h2>5 · Approved library</h2>
        {approved.length === 0 ? (
          <p className="note">Nothing approved yet. Approved images appear here before they go live.</p>
        ) : (
          <ul className="approved">
            {approved.map((image) => {
              const boundTo = assignments.find((a) => a.imageId === image.id);
              return (
                <li key={image.id}>
                  <div className="approved__thumb"><img src={assetUrl(image.imageUrl)} alt="" loading="lazy" /></div>
                  <div className="approved__body">
                    <p className="card__title">{image.title} <code>{image.id}</code></p>
                    <p className="card__meta">
                      {image.creator ?? 'Unknown'}{' · '}
                      <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">
                        {licenseLabel(image.license, image.licenseVersion)}
                      </a>
                      {' · '}<a href={image.sourcePageUrl} target="_blank" rel="noopener noreferrer">source ↗</a>
                    </p>
                    <p className="card__meta"><code>{image.imageUrl}</code></p>
                    <p className="card__meta">Approved by {image.approvedBy} on {image.approvedAt}</p>
                    {boundTo && <p className="card__meta">In use on <code>{boundTo.placeholderId}</code></p>}
                  </div>
                  <div className="approved__actions">
                    {image.sourcedForPlaceholderId && !boundTo && (
                      <AssignToSourcedSlot
                        imageId={image.id}
                        placeholderId={image.sourcedForPlaceholderId}
                      />
                    )}
                    <button className="secondary" onClick={() => assignImage(slot.id, image.id)}>
                      Use for “{slot.label}”
                    </button>
                    {boundTo && (
                      <button className="secondary" onClick={() => unassign(boundTo.placeholderId)}>Unassign</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
