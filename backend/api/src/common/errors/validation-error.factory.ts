import { ValidationError } from 'class-validator';
import { ErrorCode } from '../constants/error-codes';
import { AppException, ErrorDetail } from './app.exception';

/**
 * Turns class-validator's nested tree into the flat `details` array documented in
 * `22-api-conventions-errors.md`, so the app can point at the offending field:
 * `{ "field": "items[0].machineId", "constraint": "…" }`.
 *
 * The rejected `value` is deliberately left out: the pipe sees raw request bodies, and echoing
 * them back would leak passwords and tokens into responses and logs. Services that want to show
 * a value pass it explicitly when they throw.
 */
export function flattenValidationErrors(errors: ValidationError[], parentPath = ''): ErrorDetail[] {
  const details: ErrorDetail[] = [];

  for (const error of errors) {
    const field = joinPath(parentPath, error.property);

    for (const constraint of Object.values(error.constraints ?? {})) {
      details.push({ field, constraint });
    }

    if (error.children && error.children.length > 0) {
      details.push(...flattenValidationErrors(error.children, field));
    }
  }

  return details;
}

export function validationException(errors: ValidationError[]): AppException {
  return new AppException(ErrorCode.VALIDATION_FAILED, {
    details: flattenValidationErrors(errors),
  });
}

/** Array members come through as numeric properties; render them as `items[0]`, not `items.0`. */
function joinPath(parentPath: string, property: string): string {
  if (!parentPath) return property;
  return /^\d+$/.test(property) ? `${parentPath}[${property}]` : `${parentPath}.${property}`;
}
