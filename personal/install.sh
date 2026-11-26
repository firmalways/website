#!/bin/sh
# Install the FirmAlways Personal hook (free). Read before running:
#   curl -fsSL https://firmalways.meapplication.co.th/personal/install.sh | sh
# What it does: downloads the latest release from GitHub, checks its SHA-256, puts it in
# ~/.firmalways/app, adds ~/.local/bin/firmalways, then runs `firmalways init` to add the
# hook to Codex / ChatGPT Desktop and Claude Code. Set FIRMALWAYS_NO_INIT=1 to skip that step.
set -eu

REPO="firmalways/personal"
VERSION="${FIRMALWAYS_VERSION:-latest}"
APP="${FIRMALWAYS_DIR:-$HOME/.firmalways/app}"
BIN="${FIRMALWAYS_BIN:-$HOME/.local/bin}"
ASSET="firmalways-personal-hook.tar.gz"

say() { printf '%s\n' "$*"; }
die() { say "firmalways: $*" >&2; exit 1; }

NODE="$(command -v node || true)"
[ -n "$NODE" ] || die "needs Node.js 18 or newer (https://nodejs.org). ต้องมี Node.js 18 ขึ้นไป"
major="$("$NODE" -p 'process.versions.node.split(".")[0]')"
[ "$major" -ge 18 ] || die "Node.js $major is too old, need 18+. Node.js รุ่นเก่าเกินไป"

if [ "$VERSION" = "latest" ]; then base="https://github.com/$REPO/releases/latest/download"
else base="https://github.com/$REPO/releases/download/$VERSION"; fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
if [ -n "${FIRMALWAYS_SOURCE:-}" ]; then # a local build folder, for testing a release before publishing it
  cp "$FIRMALWAYS_SOURCE/$ASSET" "$FIRMALWAYS_SOURCE/SHA256SUMS" "$tmp/" || die "no $ASSET in $FIRMALWAYS_SOURCE"
else
  say "Downloading $ASSET ..."
  curl -fsSL "$base/$ASSET" -o "$tmp/$ASSET" || die "download failed"
  curl -fsSL "$base/SHA256SUMS" -o "$tmp/SHA256SUMS" || die "checksum download failed"
fi
want="$(grep " $ASSET\$" "$tmp/SHA256SUMS" | cut -d' ' -f1)"
if command -v sha256sum >/dev/null 2>&1; then got="$(sha256sum "$tmp/$ASSET" | cut -d' ' -f1)"
else got="$(shasum -a 256 "$tmp/$ASSET" | cut -d' ' -f1)"; fi
[ -n "$want" ] && [ "$want" = "$got" ] || die "checksum mismatch, not installing"

rm -rf "$APP.new"
mkdir -p "$APP.new" "$BIN"
tar -xzf "$tmp/$ASSET" -C "$APP.new"
rm -rf "$APP"
mv "$APP.new" "$APP"

cat > "$BIN/firmalways" <<WRAP
#!/bin/sh
exec "$NODE" "$APP/hook/firmalways.js" "\$@"
WRAP
chmod +x "$BIN/firmalways"
say "Installed: $BIN/firmalways ($("$BIN/firmalways" version))"
case ":$PATH:" in *":$BIN:"*) ;; *) say "Add $BIN to your PATH to run firmalways from any terminal." ;; esac

if [ "${FIRMALWAYS_NO_INIT:-0}" != "1" ]; then "$BIN/firmalways" init; fi
