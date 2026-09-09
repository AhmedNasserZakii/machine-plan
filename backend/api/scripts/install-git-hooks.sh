#!/usr/bin/env bash
#
# `5.1`: the "documented equivalent" to Husky this repo uses instead of the framework itself —
# a monorepo where `.git` lives two levels above the only `package.json` (this one) does not fit
# Husky's assumption that they are the same directory. Runs from `npm install`'s `prepare` hook,
# so it self-installs for anyone who clones the repo and runs `npm install` in `backend/api`; a
# no-op (never a failure) anywhere `.git` is not found — CI checks out a real `.git`, harmlessly
# reinstalling the hook into a container nothing ever commits from, and an npm mirror/tarball
# install with no `.git` at all skips it silently rather than breaking the install.
#
set -uo pipefail

cd "$(dirname "$0")/.."
repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"

if [ -z "$repo_root" ]; then
  exit 0
fi

hooks_dir="$repo_root/.git/hooks"
mkdir -p "$hooks_dir"
cp "$repo_root/scripts/git-hooks/pre-commit" "$hooks_dir/pre-commit"
chmod +x "$hooks_dir/pre-commit"
