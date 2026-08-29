#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ruby_image="${A2TECHIFY_JEKYLL_IMAGE:-ruby@sha256:81c61dc8558e6df057cb389cca2b511134427b4b0391c71b0d4d71460776890d}"

command -v docker >/dev/null 2>&1 || {
  echo "docker is required for the containerized Jekyll check" >&2
  exit 127
}

node "$repo_dir/tools/validate-site.mjs"

docker run --rm --init \
  --user "$(id -u):$(id -g)" \
  --env HOME=/tmp/home \
  --env BUNDLE_APP_CONFIG=/tmp/bundle-config \
  --env BUNDLE_PATH=/tmp/bundle \
  --env JEKYLL_ENV=production \
  --volume "$repo_dir:/srv/jekyll:ro" \
  "$ruby_image" \
  bash -lc '
    mkdir -p "$HOME" "$BUNDLE_APP_CONFIG" "$BUNDLE_PATH" /tmp/site /tmp/repo
    cp -a /srv/jekyll/. /tmp/repo/
    cd /tmp/repo
    bundle install --jobs 2 --retry 3
    bundle exec jekyll build --destination /tmp/site
  '
