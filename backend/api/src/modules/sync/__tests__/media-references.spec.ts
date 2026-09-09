import { collectMediaReferences, resolveMediaReferences } from '../media-references';

const PHOTO = '11111111-1111-4111-8111-111111111111';
const SECOND_PHOTO = '77777777-7777-4777-8777-777777777777';
const SIGNATURE = '22222222-2222-4222-8222-222222222222';
const INVOICE = '33333333-3333-4333-8333-333333333333';
const SERVER_PHOTO = 'aaaaaaaa-1111-4111-8111-111111111111';
const SERVER_SIGNATURE = 'bbbbbbbb-2222-4222-8222-222222222222';

/** The shape a queued `CREATE_TRANSFER` carries: photos sit in an array inside an array. */
function transferPayload(): Record<string, unknown> {
  return {
    type: 'REPRESENTATIVE_TO_MERCHANT',
    toPartyId: '44444444-4444-4444-8444-444444444444',
    items: [
      {
        machineId: '55555555-5555-4555-8555-555555555555',
        photoMediaIds: [PHOTO, SECOND_PHOTO],
      },
      { machineId: '66666666-6666-4666-8666-666666666666' },
    ],
    senderSignature: { method: 'DRAWN_SIGNATURE', signatureMediaId: SIGNATURE },
  };
}

describe('collectMediaReferences', () => {
  it('finds every media field at every depth, singular and plural', () => {
    expect(collectMediaReferences(transferPayload()).sort()).toEqual(
      [PHOTO, SECOND_PHOTO, SIGNATURE].sort(),
    );
  });

  it('finds a media field on the payload root', () => {
    expect(collectMediaReferences({ invoiceMediaId: INVOICE })).toEqual([INVOICE]);
  });

  it('reports each id once however many times it appears', () => {
    const payload = { items: [{ photoMediaIds: [PHOTO] }, { photoMediaIds: [PHOTO] }] };

    expect(collectMediaReferences(payload)).toEqual([PHOTO]);
  });

  it('ignores fields that are not media, however uuid-shaped', () => {
    expect(collectMediaReferences({ machineId: PHOTO, toPartyId: SIGNATURE })).toEqual([]);
  });

  it('ignores a media field that is not a uuid', () => {
    expect(collectMediaReferences({ mediaId: 'not-a-uuid' })).toEqual([]);
    expect(collectMediaReferences({ photoMediaIds: ['not-a-uuid', 7] })).toEqual([]);
  });

  it('survives a payload with nothing in it', () => {
    expect(collectMediaReferences({})).toEqual([]);
    expect(collectMediaReferences(null)).toEqual([]);
  });
});

describe('resolveMediaReferences', () => {
  it('rewrites the device ids to the ones the uploads produced', () => {
    const resolved = resolveMediaReferences(
      transferPayload(),
      new Map([
        [PHOTO, SERVER_PHOTO],
        [SIGNATURE, SERVER_SIGNATURE],
      ]),
    );

    expect(collectMediaReferences(resolved).sort()).toEqual(
      [SERVER_PHOTO, SECOND_PHOTO, SERVER_SIGNATURE].sort(),
    );
  });

  it('leaves an id the server does not recognise alone, for the operation itself to report', () => {
    expect(resolveMediaReferences({ mediaId: PHOTO }, new Map())).toEqual({ mediaId: PHOTO });
  });

  it('changes nothing else about the payload', () => {
    const payload = transferPayload();
    const resolved = resolveMediaReferences(payload, new Map([[PHOTO, SERVER_PHOTO]]));

    expect(resolved.type).toBe(payload.type);
    expect(resolved.toPartyId).toBe(payload.toPartyId);
    expect((resolved.items as { machineId: string }[])[1].machineId).toBe(
      '66666666-6666-4666-8666-666666666666',
    );
  });

  it('does not mutate what it was given', () => {
    const payload = transferPayload();

    resolveMediaReferences(payload, new Map([[PHOTO, SERVER_PHOTO]]));

    expect(collectMediaReferences(payload)).toContain(PHOTO);
  });
});
