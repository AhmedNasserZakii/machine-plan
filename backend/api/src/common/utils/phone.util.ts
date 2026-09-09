/**
 * Canonical phone storage format: local Egyptian form, `01XXXXXXXXX` (11 digits).
 *
 * Field staff type the number inconsistently — with the `+20` country code, with `0020`,
 * with spaces or dashes. Normalizing on the way in keeps `users.phone` genuinely unique
 * and makes login work regardless of how the number was typed.
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, '');

  let local = digits;
  if (local.startsWith('+20')) local = local.slice(3);
  else if (local.startsWith('0020')) local = local.slice(4);
  else if (local.startsWith('20') && local.length === 12) local = local.slice(2);

  // A bare mobile number without the trunk prefix, e.g. `1001234567`.
  if (local.length === 10 && local.startsWith('1')) local = `0${local}`;

  return local;
}

const EG_MOBILE = /^01[0125]\d{8}$/;

/** True for a valid Egyptian mobile number in canonical form. */
export function isValidEgyptianMobile(phone: string): boolean {
  return EG_MOBILE.test(normalizePhone(phone));
}
