# 19 — Feature: Media (photos, signatures, invoices)

## Goal

Handle three kinds of images: hand-off condition photos, drawn signatures, and invoice photos.
All of them are captured on phones in the field, often on a bad connection, so upload behaviour
matters as much as storage.

## Endpoints

| Method | Path | Permission |
|---|---|---|
| POST | `/media/presign` | user — get a direct-upload URL |
| POST | `/media/confirm` | user — register the uploaded object |
| POST | `/media/upload` | user — fallback direct multipart upload |
| GET | `/media/:id` | user — returns a signed, time-limited URL |
| DELETE | `/media/:id` | owner or `settings.manage` |

## Preferred flow: presigned direct upload

1. Client calls `POST /media/presign`:
   ```json
   { "purpose":"TRANSFER_PHOTO", "mimeType":"image/jpeg", "sizeBytes": 184320, "checksum":"…" }
   ```
2. Server validates purpose/mime/size, generates a storage key
   `{purpose}/{yyyy}/{mm}/{uuid}.jpg`, returns a presigned PUT URL (15 min TTL).
3. Client uploads **straight to storage** — the API server never proxies image bytes.
4. Client calls `POST /media/confirm` with the media id; server HEADs the object, verifies size and
   checksum, marks the row `is_confirmed = true`.
5. Unconfirmed media older than 24h is deleted by a cleanup job.

`POST /media/upload` (multipart) exists as a fallback for environments where presigned URLs are
blocked. It is rate-limited harder.

## Constraints per purpose

| Purpose | Max size | Max per parent | Formats | Notes |
|---|---|---|---|---|
| `TRANSFER_PHOTO` | 2 MB after client compression | **4 per transfer item** | jpeg, webp | condition evidence |
| `SIGNATURE` | 200 KB | 1 per signature row | png (transparent) | drawn on canvas |
| `INVOICE` | 5 MB | 1 per transaction | jpeg, webp, pdf | receipts |
| `AVATAR` | 1 MB | 1 per user | jpeg, webp | |

The "not too many photos" requirement is enforced in the service layer with an explicit count check
returning `422 TOO_MANY_PHOTOS`.

## Compression — client-side first, server-side second

**Client (mandatory, see Flutter `13`):** resize longest edge to 1600 px, JPEG quality 75, strip
EXIF except orientation. A 6 MB phone photo becomes ~250 KB. This is the single biggest factor in
whether field upload works on a weak connection.

**Server (safety net):** on `confirm`, enqueue a `media-optimize` job that:
- re-encodes with `sharp` to WebP at quality 80,
- generates a `thumb` variant (320 px longest edge) for list screens,
- strips all remaining metadata,
- updates `size_bytes`, `width`, `height`.

Both the original and the thumbnail are kept; lists request `?variant=thumb`.

## Access control

- Objects are **private**. Every read goes through `GET /media/:id`, which checks that the caller may
  see the parent entity, then issues a 15-minute signed URL.
- Never return raw permanent storage URLs to clients.
- Signature images additionally require the caller to have access to the parent transfer.

## Storage layout

```
transfer-photos/2026/09/{uuid}.webp
transfer-photos/2026/09/{uuid}_thumb.webp
signatures/2026/09/{uuid}.png
invoices/2026/09/{uuid}.webp
avatars/{userId}.webp
```

Local dev uses MinIO with the identical S3 API so nothing changes between environments.

## Retention

- Transfer photos and signatures: **retained for the life of the machine record** — they are
  evidence. Never auto-deleted.
- Invoices: retained indefinitely (accounting requirement).
- Orphaned media (no parent after 24h): deleted nightly.

## Tests

- presign rejects an oversized declared size
- confirm rejects a checksum mismatch
- a 5th photo on a transfer item → 422
- a user from another branch requesting a media id → 403
- signed URLs expire
