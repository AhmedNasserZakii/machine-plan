import {
  buildPath,
  depthOf,
  isSelfOrDescendant,
  rewriteDescendantPath,
  toPathLabel,
  wouldCreateCycle,
} from '../category-path';

const ROOT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const CHILD = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const GRANDCHILD = 'cccccccccccccccccccccccccccccccc';

const ROOT_PATH = ROOT;
const CHILD_PATH = `${ROOT}.${CHILD}`;
const GRANDCHILD_PATH = `${ROOT}.${CHILD}.${GRANDCHILD}`;

describe('toPathLabel', () => {
  it('strips the hyphens an ltree label cannot carry', () => {
    expect(toPathLabel('0f8fad5b-d9cb-469f-a165-70867728950e')).toBe(
      '0f8fad5bd9cb469fa16570867728950e',
    );
  });
});

describe('buildPath', () => {
  it('makes a root out of a node with no parent', () => {
    expect(buildPath(null, ROOT)).toBe(ROOT_PATH);
  });

  it('appends the label to the parent path', () => {
    expect(buildPath(ROOT_PATH, CHILD)).toBe(CHILD_PATH);
  });

  it('treats an empty parent path as no parent, matching the promote-to-root SQL', () => {
    expect(buildPath('', ROOT)).toBe(ROOT_PATH);
  });
});

describe('depthOf', () => {
  it('puts a root at 0', () => {
    expect(depthOf(ROOT_PATH)).toBe(0);
  });

  it('counts one level per ancestor', () => {
    expect(depthOf(CHILD_PATH)).toBe(1);
    expect(depthOf(GRANDCHILD_PATH)).toBe(2);
  });
});

describe('isSelfOrDescendant', () => {
  it('includes the ancestor itself, as `<@` does', () => {
    expect(isSelfOrDescendant(ROOT_PATH, ROOT_PATH)).toBe(true);
  });

  it('includes a descendant at any depth', () => {
    expect(isSelfOrDescendant(GRANDCHILD_PATH, ROOT_PATH)).toBe(true);
  });

  it('excludes an ancestor of the node', () => {
    expect(isSelfOrDescendant(ROOT_PATH, CHILD_PATH)).toBe(false);
  });

  it('does not mistake a shared label prefix for ancestry', () => {
    expect(isSelfOrDescendant(`${ROOT}x`, ROOT_PATH)).toBe(false);
  });
});

describe('wouldCreateCycle', () => {
  it('allows a move to the root', () => {
    expect(wouldCreateCycle(CHILD_PATH, null)).toBe(false);
  });

  it('allows a move to an unrelated branch', () => {
    expect(wouldCreateCycle(CHILD_PATH, GRANDCHILD)).toBe(false);
  });

  it('refuses a move under the node itself', () => {
    expect(wouldCreateCycle(CHILD_PATH, CHILD_PATH)).toBe(true);
  });

  it('refuses a move under the node\u2019s own descendant', () => {
    expect(wouldCreateCycle(CHILD_PATH, GRANDCHILD_PATH)).toBe(true);
  });
});

describe('rewriteDescendantPath', () => {
  it('re-parents the moved node itself', () => {
    expect(rewriteDescendantPath(CHILD_PATH, CHILD_PATH, GRANDCHILD)).toBe(
      `${GRANDCHILD}.${CHILD}`,
    );
  });

  it('carries a descendant across with its tail intact', () => {
    expect(rewriteDescendantPath(GRANDCHILD_PATH, CHILD_PATH, ROOT_PATH)).toBe(
      `${ROOT}.${CHILD}.${GRANDCHILD}`,
    );
  });

  it('promotes a subtree to the root when there is no new parent', () => {
    expect(rewriteDescendantPath(GRANDCHILD_PATH, CHILD_PATH, null)).toBe(`${CHILD}.${GRANDCHILD}`);
  });
});
