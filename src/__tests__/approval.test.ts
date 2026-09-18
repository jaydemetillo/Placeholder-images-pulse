import { describe, it, expect, beforeEach } from 'vitest';
import {
  approveCandidate,
  approvePending,
  stageCandidate,
  assignImage,
  unassign,
  getApproved,
  getPending,
  getAssignments,
  __resetStore,
  ApprovalRejectedError,
} from '../image-library/store';
import { resolveImage } from '../image-library/resolve-image';
import type { ApprovedImage, Candidate, LibraryImage, ReviewChecklist } from '../image-library/types';

const CANDIDATE: Candidate = {
  openverseId: 'ov-1',
  title: 'Infusion pump in hospital room',
  creator: 'A. Photographer',
  imageUrl: 'https://example.org/pump.jpg',
  thumbnailUrl: 'https://example.org/pump_t.jpg',
  sourcePageUrl: 'https://example.org/photos/pump',
  license: 'by',
  licenseVersion: '4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: '"Infusion pump in hospital room" by A. Photographer, CC BY 4.0',
  scannedText: 'Infusion pump in hospital room',
};

const ALL: ReviewChecklist = {
  realPhotoChecked: true,
  matchesEquipmentChecked: true,
  sourceAndLicenceChecked: true,
  noPatientInfoChecked: true,
};

beforeEach(() => __resetStore([], []));

describe('approval gate', () => {
  it.each(Object.keys(ALL) as (keyof ReviewChecklist)[])(
    'refuses approval when %s is unticked',
    (missing) => {
      expect(() => approveCandidate(CANDIDATE, { ...ALL, [missing]: false }, 'Jay')).toThrow(
        ApprovalRejectedError,
      );
      expect(getApproved()).toHaveLength(0);
    },
  );

  it('refuses approval without a named reviewer', () => {
    expect(() => approveCandidate(CANDIDATE, ALL, '   ')).toThrow(ApprovalRejectedError);
    expect(getApproved()).toHaveLength(0);
  });

  it('records full provenance when all four boxes are ticked', () => {
    const rec = approveCandidate(CANDIDATE, ALL, 'Jay', new Date('2026-09-18T10:00:00Z'));
    expect(rec).toMatchObject({
      status: 'approved',
      title: 'Infusion pump in hospital room',
      creator: 'A. Photographer',
      sourcePageUrl: 'https://example.org/photos/pump',
      license: 'by',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      attribution: '"Infusion pump in hospital room" by A. Photographer, CC BY 4.0',
      approvedBy: 'Jay',
      approvedAt: '2026-09-18',
      realPhotoChecked: true,
      noPatientInfoChecked: true,
    });
    expect(getApproved()).toHaveLength(1);
  });

  it('does not assign the image to any placeholder on approval', () => {
    approveCandidate(CANDIDATE, ALL, 'Jay');
    expect(getAssignments()).toHaveLength(0);
  });
});

describe('assignment', () => {
  it('refuses to assign an image that is not in the approved pool', () => {
    expect(() => assignImage('infusion-pump-card', 'img_999')).toThrow(ApprovalRejectedError);
    expect(getAssignments()).toHaveLength(0);
  });

  it('binds an approved image and replaces a prior binding for the same slot', () => {
    const a = approveCandidate(CANDIDATE, ALL, 'Jay');
    const b = approveCandidate({ ...CANDIDATE, openverseId: 'ov-2' }, ALL, 'Jay');
    assignImage('infusion-pump-card', a.id);
    assignImage('infusion-pump-card', b.id);
    expect(getAssignments()).toEqual([{ placeholderId: 'infusion-pump-card', imageId: b.id }]);
  });

  it('unassigns cleanly', () => {
    const a = approveCandidate(CANDIDATE, ALL, 'Jay');
    assignImage('infusion-pump-card', a.id);
    unassign('infusion-pump-card');
    expect(getAssignments()).toHaveLength(0);
  });
});

describe('resolver — only approved images can reach the app', () => {
  it('returns null for an unassigned slot', () => {
    expect(resolveImage('infusion-pump-card', [], [])).toBeNull();
  });

  it('returns null when the assignment points at a missing image', () => {
    expect(resolveImage('infusion-pump-card', [], [{ placeholderId: 'infusion-pump-card', imageId: 'img_001' }])).toBeNull();
  });

  it('returns null when the record is not approved', () => {
    const pending = { ...CANDIDATE, id: 'img_001', status: 'pending' } as unknown as ApprovedImage;
    expect(
      resolveImage('infusion-pump-card', [pending], [{ placeholderId: 'infusion-pump-card', imageId: 'img_001' }]),
    ).toBeNull();
  });

  it('refuses a staged record even when an assignment points straight at it', () => {
    const staged = stageCandidate(CANDIDATE, { sourcedForPlaceholderId: 'infusion-pump-card' });
    const assignments = [{ placeholderId: 'infusion-pump-card', imageId: staged.id }];
    expect(resolveImage('infusion-pump-card', getPending(), assignments)).toBeNull();
  });

  it('resolves an approved, assigned image', () => {
    const rec = approveCandidate(CANDIDATE, ALL, 'Jay');
    assignImage('infusion-pump-card', rec.id);
    expect(resolveImage('infusion-pump-card', getApproved(), getAssignments())?.id).toBe(rec.id);
  });
});


describe('staging — sourcing an image is not approving it', () => {
  it('lands as pending with every box unticked and no reviewer', () => {
    const staged = stageCandidate(CANDIDATE, { sourcedForPlaceholderId: 'infusion-pump-card' });
    expect(staged).toMatchObject({
      status: 'pending',
      sourcedForPlaceholderId: 'infusion-pump-card',
      realPhotoChecked: false,
      matchesEquipmentChecked: false,
      sourceAndLicenceChecked: false,
      noPatientInfoChecked: false,
      approvedBy: null,
      approvedAt: null,
    });
    expect(getApproved()).toHaveLength(0);
    expect(getPending()).toHaveLength(1);
  });

  it('keeps the upstream file URL when the app is pointed at a local copy', () => {
    const staged = stageCandidate(CANDIDATE, { imageUrl: '/images/infusion-pump-card.jpg' });
    expect(staged.imageUrl).toBe('/images/infusion-pump-card.jpg');
    expect(staged.originalFileUrl).toBe(CANDIDATE.imageUrl);
  });

  it('cannot be assigned to a slot while it is pending', () => {
    const staged = stageCandidate(CANDIDATE);
    expect(() => assignImage('infusion-pump-card', staged.id)).toThrow(ApprovalRejectedError);
    expect(getAssignments()).toHaveLength(0);
  });
});

describe('approving a staged record', () => {
  it.each(Object.keys(ALL) as (keyof ReviewChecklist)[])(
    'refuses approval when %s is unticked',
    (missing) => {
      const staged = stageCandidate(CANDIDATE);
      expect(() => approvePending(staged.id, { ...ALL, [missing]: false }, 'Jay')).toThrow(
        ApprovalRejectedError,
      );
      expect(getApproved()).toHaveLength(0);
      expect(getPending()).toHaveLength(1);
    },
  );

  it('refuses approval without a named reviewer', () => {
    const staged = stageCandidate(CANDIDATE);
    expect(() => approvePending(staged.id, ALL, '  ')).toThrow(ApprovalRejectedError);
    expect(getApproved()).toHaveLength(0);
  });

  it('promotes the record in place, keeping its provenance and id', () => {
    const staged = stageCandidate(CANDIDATE, {
      sourcedForPlaceholderId: 'infusion-pump-card',
      imageUrl: '/images/infusion-pump-card.jpg',
      modifications: 'Cropped to a square.',
    });
    const approved = approvePending(staged.id, ALL, 'Jay', new Date('2026-09-18T10:00:00Z'));

    expect(approved).toMatchObject({
      id: staged.id,
      status: 'approved',
      imageUrl: '/images/infusion-pump-card.jpg',
      originalFileUrl: CANDIDATE.imageUrl,
      modifications: 'Cropped to a square.',
      sourcePageUrl: CANDIDATE.sourcePageUrl,
      licenseUrl: CANDIDATE.licenseUrl,
      approvedBy: 'Jay',
      approvedAt: '2026-09-18',
    });
    expect(getPending()).toHaveLength(0);
    expect(getApproved()).toHaveLength(1);
  });

  it('still does not publish: approval assigns nothing', () => {
    const staged = stageCandidate(CANDIDATE, { sourcedForPlaceholderId: 'infusion-pump-card' });
    approvePending(staged.id, ALL, 'Jay');
    expect(getAssignments()).toHaveLength(0);
  });

  it('refuses to approve the same record twice', () => {
    const staged = stageCandidate(CANDIDATE);
    approvePending(staged.id, ALL, 'Jay');
    expect(() => approvePending(staged.id, ALL, 'Jay')).toThrow(ApprovalRejectedError);
  });

  it('refuses an id that is not in the library', () => {
    expect(() => approvePending('img_999', ALL, 'Jay')).toThrow(ApprovalRejectedError);
  });
});

describe('id allocation', () => {
  it('does not reuse an id already held by a seeded record', () => {
    const seeded = { ...CANDIDATE, id: 'img_003', status: 'pending' } as unknown as LibraryImage;
    __resetStore([seeded], []);
    expect(stageCandidate(CANDIDATE).id).toBe('img_004');
  });
});
