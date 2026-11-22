#!/bin/sh
# FirmAlways Gate installer.
#   curl -fsSL https://firmalways.meapplication.co.th/install.sh | sh
#
# Installs the latest release wheel from GitHub with uv, pipx or pip (in that
# order of preference), including PDF support. Nothing else is downloaded or run.
# Options (environment variables):
#   FIRMALWAYS_VERSION=v0.2.0   install a specific release instead of the latest
#   FIRMALWAYS_PACKAGE=<spec>   install this pip requirement instead (for testing)
set -eu

REPO="firmalways/gate"
say() { printf '%s\n' "$*"; }
fail() { printf 'firmalways-gate install: %s\n' "$*" >&2; exit 1; }

if [ -n "${FIRMALWAYS_PACKAGE:-}" ]; then
  SPEC="$FIRMALWAYS_PACKAGE"
else
  TAG="${FIRMALWAYS_VERSION:-}"
  if [ -z "$TAG" ]; then
    command -v curl >/dev/null 2>&1 || fail "curl is required"
    TAG=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n 1)
    [ -n "$TAG" ] || fail "could not find the latest release of $REPO"
  fi
  VERSION=${TAG#v}
  SPEC="firmalways-gate[pdf] @ https://github.com/$REPO/releases/download/$TAG/firmalways_gate-$VERSION-py3-none-any.whl"
fi

if command -v uv >/dev/null 2>&1; then
  say "Installing with uv: $SPEC"
  uv tool install --force "$SPEC"
elif command -v pipx >/dev/null 2>&1; then
  say "Installing with pipx: $SPEC"
  pipx install --force "$SPEC"
elif command -v python3 >/dev/null 2>&1; then
  python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' || fail "Python 3.11 or newer is required"
  say "Installing with pip --user: $SPEC"
  python3 -m pip install --user --upgrade "$SPEC"
else
  fail "install uv (https://docs.astral.sh/uv/), pipx or Python 3.11+ first"
fi

say ""
say "Installed. Try:"
say "  firmalways-gate scan \"นายสมชาย ใจดี โทร 0812345678\""
say "  firmalways-gate serve --policy policy.toml"
say "Docs: https://firmalways.meapplication.co.th"
