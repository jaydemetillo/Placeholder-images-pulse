# Photos for items — a plain-English guide

**Who this is for:** designers, product people and engineers who need real photographs on
item rows instead of the same placeholder repeated eight times.

**How to read it.** Parts 1–4 are for everyone and assume no legal or backend knowledge.
Parts 5–8 are the engineering build. Part 9 is the honest list of things that will bite
you. Nothing here assumes you have read the code.

---

## Part 1 — The problem

The Transfer stock screen lists eight items and shows the same nitrile-gloves thumbnail on
every row. People scanning a storeroom list use the picture to find the thing. One picture
for eight different objects is worse than no picture, because it actively misleads.

So: get a real photo per item. That sounds like a ten-minute job. It isn't, for one reason.

**You cannot just download a picture you found.** Almost every photograph on the internet is
owned by whoever took it. Using one without permission is copyright infringement — and a
hospital-facing product is exactly the kind of thing that gets noticed. So we need photos
somebody has explicitly given permission to use, and we need to be able to *prove* it later.

That proof requirement is what turns a ten-minute job into a system.

---

## Part 2 — The rules, in plain English

### What a licence is

A licence is the photographer saying, in advance and in writing, "here is what you may do
with my photo". Creative Commons (CC) is a set of standard, pre-written licences so nobody
has to negotiate individually.

### The ones we accept

| Licence | Plain English | Do we credit? |
|---|---|---|
| **CC0** | "I give up my rights. Do anything." | Not legally required |
| **Public Domain Mark (PDM)** | "This is old/free enough that nobody owns it." | Not legally required |
| **CC BY** | "Use it however you like — *just credit me*." | **Yes, visibly** |

### The ones we reject, and why

| Licence | Why it's out |
|---|---|
| **CC BY-NC** | NC = non-commercial. We're a commercial product. |
| **CC BY-ND** | ND = no derivatives. We crop and resize. That's a derivative. |
| **CC BY-SA** | SA = share-alike. It asks you to license *your* work the same way. Don't go near it. |
| **No licence stated** | No permission = no. Silence is not a yes. |

### The important design decision: allowlist, not blocklist

We do **not** keep a list of banned licences. We keep a list of the three permitted ones,
and everything else is rejected automatically. If Creative Commons invents a new licence
next year, or Openverse adds a new code, it is rejected by default until a human explicitly
adds it. A blocklist would let it through.

This lives in `src/image-library/license-policy.ts`:

```ts
export const ALLOWED_LICENSES = ['cc0', 'pdm', 'by'] as const;
```

### Why AI-generated images are a problem here

Two reasons, and the second is the one that matters.

1. Their copyright status is unsettled.
2. **This is medical equipment.** An AI image of a "surgical suture kit" will look
   convincing and be subtly wrong — a needle curved the wrong way, a device that doesn't
   exist. Someone picking stock off a shelf against that picture is being actively misled.

We run a filter for it (`src/image-library/ai-heuristic.ts`) that looks for words like *AI*,
*generative*, *Midjourney*, *Stable Diffusion*, *DALL-E*, *synthetic*, *render*.

**It is a "likely non-AI" filter, not a guarantee, and you must not describe it as one.** It
reads the words the uploader typed. It cannot look at the picture. An AI image whose
uploader didn't label it sails straight through. That single fact is the entire reason a
human has to look at every image before it goes live.

One nice detail worth knowing: the matching is word-boundaried, not substring. A naive
`text.includes('ai')` would throw away *airway*, *repair*, *training* and *captain* — all
plausible words in a medical library.

### What "attribution" actually means

For CC BY only, you must visibly credit the photographer. Specifics:

- It must be **visible text on the page**. Not a `title=` tooltip — screen readers and
  touch users can't reach those, so a tooltip is not a credit.
- It must name the creator and the licence, and link to the source.
- If you changed the image, you must say so. We crop and resize every photo, so every CC BY
  record carries a "Cropped to a square and resized to 512×512" line.

On screen we split it: a short credit under the item name (creator + licence, linked), and
the full entry — title, creator, licence, changes — in the *Image credits* section at the
foot. The short one is short because a storeroom row is one line tall. It is never
truncated with an ellipsis, because **a clipped credit is not a credit**.

---

## Part 3 — How a photo gets onto a screen

Four gates. An image has to clear all four. Miss any one and it stays invisible.

```
Openverse search ─filter─▶ Candidate ─stage─▶ pending ─approve─▶ approved ─assign─▶ on screen
   (nothing saved)        (nothing saved)    (saved, inert)     (saved)
```

1. **Filter** — automatic. Wrong licence or AI-smelling words, and it never reaches a human.
2. **Stage** — saved to the library as `pending`. Has full provenance. Is *inert*: it cannot
   appear on any screen, no matter what.
3. **Approve** — a named human ticks four boxes. This is the only way out of `pending`.
4. **Assign** — a separate action that binds the approved image to a specific item slot.

**Approving does not publish.** That's deliberate, and people find it annoying until the
first time it saves them. Approving says "this image is legitimate". Assigning says "put it
on *this* row". Keeping them apart means you can never accidentally publish while reviewing.

---

## Part 4 — How to add a photo (no code)

Open the app, click **Image Library (admin)** in the top bar.

### If someone has already sourced images for you

They'll be waiting in **step 2, Pending your review**. Skip to *Reviewing* below.

### Sourcing one yourself

1. **Step 1 — pick the slot** you're filling. The search box pre-fills with that slot's
   search words.
2. **Step 3 — Search.** Untick *"Use offline fixtures"* to hit the real Openverse.
3. Look at the results. Then **open the collapsed *"N results withheld by the filters"***
   and read it. It tells you *why* each one was dropped. If everything was withheld for
   "Licence not allowed", your search terms are fine and the coverage is just bad — try
   different words. This list is there so you can see the filter working rather than
   trusting it blindly.

### Reviewing — what you're actually certifying

You tick four boxes. They are not a formality; they are a statement recorded permanently
against your name and today's date.

| Box | What to actually do |
|---|---|
| "I verified this is a real photo, not AI-generated." | Look at it properly. Count fingers, check the text on labels is real words, check the object could physically exist. The automatic filter cannot do this. |
| "I verified the image matches the requested equipment." | Is it *the thing*? A theatre lamp is not a headlamp. An ankle brace is not a walking boot. |
| "I checked the original source page and licence." | **Click the link.** Confirm the page itself states the licence we recorded. Don't trust the metadata. |
| "I verified no identifiable patient or private medical information is visible." | Faces, wristbands, charts, screens with names, ward whiteboards. |

Then type your name and hit **Approve**. The button stays disabled until all four are
ticked and a name is entered — there is no partial approval.

Finally hit **Assign to …**. Now it's on the screen.

### Things worth rejecting

- **Brand logos.** Most slots are configured `allowsBrandLogos: false`. A competitor's
  logo in your product UI is a problem you don't need.
- **People, unless the slot wants them.** Slots are `needsPeople: false` by default.
- **Anything you're unsure about.** The cost of rejecting a good photo is five more minutes
  of searching. The cost of approving a bad one is a legal letter or a picking error.

---

## Part 5 — The Openverse API (engineers)

[Openverse](https://openverse.org) is a WordPress Foundation search engine over openly
licensed media. Free, no key needed for basic use.

### The request

```
GET https://api.openverse.org/v1/images/
      ?q=blood+pressure+cuff+sphygmomanometer
      &license=cc0,pdm,by
      &page_size=20
      &page=1
```

We send `license=` so filtering starts server-side — **and we filter again on the client
anyway**. We never trust the server to have honoured the parameter. Both gates run on every
result. See `buildSearchUrl()` in `src/image-library/openverse.ts`.

### The response, trimmed to what matters

```jsonc
{
  "result_count": 26,
  "results": [{
    "id": "b6e24cac-…",
    "title": "Blood Pressure Cuff (Sphygmomanometer)",
    "creator": "Alabama Extension",
    "url": "https://live.staticflickr.com/…/53489355788_921fb9427d_b.jpg", // the file
    "thumbnail": "https://api.openverse.org/v1/images/…/thumb/",
    "foreign_landing_url": "https://www.flickr.com/photos/…/53489355788", // the source page
    "license": "cc0",
    "license_version": "1.0",
    "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
    "tags": [{ "name": "fitness" }, { "name": "health" }]
  }]
}
```

`url` is the image file. `foreign_landing_url` is the human-readable page where the licence
is actually stated. **You need both** — the first to download, the second so a reviewer can
verify. A result with no `foreign_landing_url` is rejected, because licence evidence you
can't open is not evidence.

### The filter, in full

```ts
export function filterResults(results: OpenverseResult[]): FilterOutcome {
  const candidates: Candidate[] = [];
  const rejected: FilteredResult[] = [];

  for (const result of results) {
    const licenseProblem = checkLicense(result);       // allowlist + source page present
    if (licenseProblem) { rejected.push({ result, reason: licenseProblem }); continue; }

    const aiProblem = checkLikelyNonAi(result);        // word-boundary metadata scan
    if (aiProblem) { rejected.push({ result, reason: aiProblem }); continue; }

    candidates.push(toCandidate(result));
  }
  return { candidates, rejected };
}
```

Note it returns rejections rather than dropping them. That is a product requirement, not a
debugging aid: a reviewer must be able to see what was withheld and why.

### API gotchas we actually hit

These cost real time, so they're written down:

- **`page_size` is capped at 20 for anonymous requests.** Ask for 40 and you get
  `{"detail":"page_size may not exceed 20 for anonymous requests"}`. Paginate instead.
- **Terms are ANDed, so long queries return nothing.** `"digital stethoscope medical
  equipment"` → **0 results**. `"stethoscope medical"` → 240. Start broad, then narrow.
  Every placeholder's `searchWords` in this repo needed loosening before it returned
  anything.
- **`upload.wikimedia.org` rate-limits hard (HTTP 429)** and rejects non-standard thumbnail
  widths with a 400 telling you to use their listed sizes. Back off and retry, and prefer
  the original file URL.
- **Some source hosts block non-browser clients.** `stocksnap.io` returned **403** to every
  request from our environment. The image CDN worked fine; only the human-readable page was
  blocked. This matters: it means a machine *cannot always* verify the licence at source,
  which is one more reason the human step exists.
- **Openverse's `/thumb/` endpoint returned 406** for some `Accept` headers. Use the
  provider's own file URL for downloads.
- **Corporate proxies:** Node's built-in `fetch` may fail where `curl` succeeds, because it
  doesn't pick up proxy env vars the same way. If ingest works locally and 401s in CI, look
  there first.

### Downloading and storing

Don't hotlink. Download the file and serve your own copy:

```
public/images/<placeholder-id>.jpg      # prototype
s3://…/assets/<sha256>.jpg              # production
```

Three reasons: the upstream host can swap the picture under your already-approved record;
every page load otherwise leaks your users to a third party; and links rot.

Record `originalFileUrl` (where it came from) and `modifications` (what you changed)
alongside. The prototype crops to a square and resizes to 512×512 — **that is a derivative
work, and CC BY requires you to say so.**

---

## Part 6 — How approvals work in code

### Two statuses, one library

```ts
type LibraryImage = PendingImage | ApprovedImage;
```

A `PendingImage` has all four attestations `false`, `approvedBy: null`, and full
provenance. An `ApprovedImage` has a reviewer name and a date.

### The gate

One function decides what any screen may render — `src/image-library/resolve-image.ts`:

```ts
export function resolveImage(placeholderId, library, assignments): ApprovedImage | null {
  const assignment = assignments.find((a) => a.placeholderId === placeholderId);
  if (!assignment) return null;

  const image = library.find((a) => a.id === assignment.imageId);
  if (!image) return null;
  if (image.status !== 'approved') return null;   // ← the gate

  return image;
}
```

Needs an assignment **and** approved status. A pending record assigned by mistake still
returns `null` and the slot draws its neutral placeholder. There is a second guard behind
it: `getApproved()` filters by status, so the live app never even receives a pending record.

### Staging can't accidentally approve

`stageCandidate()` takes no checklist and no reviewer parameter. There is no argument you
could pass to make it produce an approved record. Meanwhile both approval paths funnel
through one function:

```ts
function requireHumanApproval(checklist: ReviewChecklist, approvedBy: string): void {
  if (!allChecked(checklist)) throw new ApprovalRejectedError('All four verification checkboxes are required.');
  if (!approvedBy.trim())     throw new ApprovalRejectedError('A reviewer name is required.');
}
```

### The seed is guarded by a test

`src/__tests__/library-seed.test.ts` fails the build if anything checked into the repo ever
ships `status: 'approved'` or with a box pre-ticked. Committed images are the one path into
the library that doesn't go through the UI, so it's the one path that needs a test.

---

## Part 7 — Building this for production

The prototype keeps everything in `localStorage`. That is a prototype shortcut, and the
shapes are already correct for the real thing — only the transport changes.

### Put the gate in the database

In the prototype, `resolveImage()` is the only route to an image *because I wrote it that
way*. A new `SELECT` somewhere else could bypass it. Make it a constraint instead:

```sql
ALTER TABLE image_asset ADD CONSTRAINT image_asset_id_status_key UNIQUE (id, status);

CREATE TABLE item_image (
  item_id      text NOT NULL REFERENCES catalogue_item(id),
  asset_id     uuid NOT NULL,
  asset_status text NOT NULL DEFAULT 'approved',
  role         text NOT NULL DEFAULT 'primary',
  CHECK (asset_status = 'approved'),
  FOREIGN KEY (asset_id, asset_status) REFERENCES image_asset (id, status)
);
```

Now "only an approved asset can be bound to an item" is a database invariant that no ORM,
migration or admin script can violate. Useful side effect: revoking an approved asset that
is currently live **fails** with a foreign-key violation until someone explicitly unassigns
it. You can't quietly pull an image out from under a screen.

### Three tables, not two

| Table | Holds |
|---|---|
| `image_asset` | bytes pointer, sha256, provenance, licence, status |
| `item_image` | the binding to a catalogue item, plus role and ordering |
| `image_review_event` | **append-only**: what was ticked, by whom, when, against which sha256 |

The audit table matters. Attestation booleans on a mutable row are worthless six months
later when someone asks "what exactly did Jay certify, and was it this version of the
file?". The content hash on the event row answers it.

### Don't hand-write placeholder slots

Five hardcoded slots is a prototype affordance. In production, images attach to catalogue
items by SKU/GTIN, and the backlog is a query:

```sql
SELECT id, name FROM catalogue_item ci
WHERE NOT EXISTS (SELECT 1 FROM item_image ii WHERE ii.item_id = ci.id AND ii.role = 'primary');
```

That backlog maintains itself as the catalogue grows. Nobody has to remember to add a slot.

### Roles

*Sourcer* can stage (often a service account). *Reviewer* can approve. *Admin* can revoke.
Keep them distinct. **Sourcing can be fully automated precisely because staging is inert.**
Approving cannot be, ever.

### Jobs worth having

- **Sourcing job** — derives search terms from item name + category, stages the top 2–3
  candidates. Cron or agent; needs no human.
- **Link-rot job** — quarterly, re-fetch every `source_page_url`, flag anything that 404s
  or no longer states the licence you recorded. Source pages *do* vanish.

### Build order

1. The three tables and the FK constraint. About a day, and it's the load-bearing bit.
2. Ingest: download, hash, generate derivatives, push to CDN.
3. The review queue UI.
4. The automated sourcing job **last**. It's the flashiest piece and the least important —
   a human pasting a URL into a staging form gets the same result while you learn what
   reviewers actually need.

---

## Part 8 — Make the review queue fast

This is the part that decides whether the system gets used or quietly abandoned.

Five images through the current per-card form is fine. Five hundred is not — and nobody will
tell you they've stopped, they'll just stop. Budget real design time for:

- one item at a time, full-bleed, candidates side by side
- the source page one click away, opening in a new tab
- keyboard everything: `1`–`4` to tick, `Enter` to approve, `R` to reject, `→` for next
- reject reasons as one-click buttons, captured as data so you learn which search terms are
  failing
- a visible counter, because an invisible backlog is a demoralising one

A realistic reviewer does 20–60 images an hour on pre-filtered candidates. Plan the backlog
around that number and staff it, or the gap query grows forever.

---

## Part 9 — Challenges, honestly

**Coverage is thin, and this is the big one.** Openverse will not cover a medical equipment
catalogue. We hit this on the very first pass: there is no head-worn surgical headlamp on it
under any acceptable licence. `"surgical headlamp"`, `"ENT headlight"` and `"medical
headlight"` all return nothing usable, and the only genuine surgical-headlight photos show a
surgeon operating on a patient — which the slot explicitly doesn't want. That slot currently
holds a theatre lamp instead, flagged as a weak match for the reviewer to reject.

Across a few thousand SKUs, expect the same repeatedly. So plan for three sources:

| Source | Best for |
|---|---|
| **Supplier-provided images** | Best coverage, and it's the actual product you stock. Get permission in writing and record it exactly like a licence. |
| **Your own photography** | An afternoon in a storeroom with a phone and a light box covers your top few hundred items by volume — consistent, on-brand, zero licence risk. |
| **CC sourcing (this pipeline)** | The long tail, and filling gaps fast. |

Build the pipeline regardless: **all three need the same thing** — provenance, a named human
sign-off, and a hard gate between "we have a file" and "it's on a screen".

**Visual inconsistency.** CC photos come from different photographers, lighting and
backgrounds. Our five come from four sources and look it — one on white, one on a carpet.
Against a clean design system this reads as scruffy. Mitigate with a consistent crop and a
neutral thumbnail frame; accept you won't fully fix it without your own photography.

**The AI filter reads metadata only.** Worth repeating because people forget: it cannot look
at the picture. Never let it be described as a guarantee, in the UI or in a standup.

**Two deliberate filter trade-offs**, so nobody "fixes" them by accident:
- `synthetic` is matched, so a legitimate photo of a *synthetic graft* or *synthetic suture*
  gets withheld. Rejections are visible and reviewable, so this fails safe.
- `generator` is deliberately **not** matched by the `generative` rule — an *oxygen
  generator* is real equipment.

**Non-Latin creator names.** One of our five is credited to `آرمین`. Attribution strings are
user-generated text in any script and direction — don't assume Latin, don't truncate
mid-character, and check your RTL rendering.

**Patient privacy is a judgement call, not a checkbox.** Our walking boot photo is the
photographer's own leg — no face, nothing identifying, but it *is* a person's limb rather
than a product shot. The box says "no identifiable patient information"; someone has to
decide what identifiable means. Write that guidance down for your reviewers.

**Prototype approvals don't persist anywhere real.** `localStorage` is per-browser. Approving
in the prototype doesn't reach the repo, and clearing site data resets it. Don't demo
approvals to a stakeholder on a machine you then wipe.

---

## Glossary

| Term | Meaning |
|---|---|
| **Candidate** | A search result that passed the filters. Not saved anywhere. |
| **Pending** | Saved with full provenance, but inert — cannot reach a screen. |
| **Approved** | A named human ticked all four boxes. |
| **Assignment** | The binding of an approved image to a specific item slot. |
| **Placeholder / slot** | A named hole in the UI where an image goes. `id` is a contract — renaming one orphans its assignment. |
| **Provenance** | The paper trail: title, creator, licence, source page, original file URL, what you changed. |
| **Attribution** | The visible credit CC BY legally requires. |
| **Allowlist** | A list of what's permitted, where everything else is refused by default. |
