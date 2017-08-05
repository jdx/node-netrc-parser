#!/bin/sh

# Trust node-netrc-parser-test to test gpg encryption
# see https://blog.tersmitten.nl/how-to-ultimately-trust-a-public-key-non-interactively.html

echo "$( \
  gpg --list-keys --fingerprint \
  | grep node-netrc-parser-test -B 1 | head -n 1 \
  | tr -d '[:space:]' | awk '{ sub(/.*=/,"",$0); print $0 }' \
):6:" | gpg --import-ownertrust
