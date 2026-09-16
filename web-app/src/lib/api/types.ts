import type { components, paths } from './generated/schema';

export type Schema<K extends keyof components['schemas']> = components['schemas'][K];

export type Paths = paths;

/** Response body of a GET, unwrapped from the success envelope. */
export type GetData<P extends keyof paths> =
  paths[P] extends { get: { responses: { 200: { content: { 'application/json': infer R } } } } }
    ? R extends { data: infer D }
      ? D
      : R
    : never;

export type Me = Schema<'MeResponse'>;
export type AuthTokens = Schema<'AuthTokensResponse'>;
