import { escapeLikeWildcards, likePattern } from '../search-pattern.util';

describe('likePattern', () => {
  it('wraps a plain term in wildcards', () => {
    expect(likePattern('ahmed')).toBe('%ahmed%');
  });

  it('trims incidental whitespace', () => {
    expect(likePattern('  ahmed  ')).toBe('%ahmed%');
  });

  /**
   * The queries are parameterized, so this is not injection — it is that `%` is a wildcard
   * *inside* the bound value. Unescaped, a search for `%` matches every row in the table.
   */
  it('escapes a bare percent so it cannot match everything', () => {
    expect(likePattern('%')).toBe('%\\%%');
  });

  it('escapes underscores so they match a literal underscore', () => {
    expect(likePattern('SN_01')).toBe('%SN\\_01%');
  });

  /** The escape character itself has to be escaped, or it consumes the character after it. */
  it('escapes backslashes', () => {
    expect(escapeLikeWildcards('a\\b')).toBe('a\\\\b');
  });

  it('leaves ordinary punctuation alone', () => {
    expect(likePattern('al-nasr & co.')).toBe('%al-nasr & co.%');
  });
});
