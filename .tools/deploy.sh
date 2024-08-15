#!/usr/bin/env bash

set -eo pipefail


main() {
  RMT="${1:-origin}"
  git pull ${RMT} main
  git fetch ${RMT} --tags

  last_tagged_commit=$(git rev-list --tags --max-count=1)

  # Check if it's first release
  if [[ -z $last_tagged_commit ]]; then
    echo "First release"
    new_tag="0.0.1"

    git tag -a "$new_tag" -m "Release $new_tag"
    git push ${RMT} "$new_tag"
    git push ${RMT} main
    return
  fi

  latest_tag=$(git describe --tags $last_tagged_commit)

  # Read the latest tag
  IFS='.' read -r -a version <<< "$latest_tag"

  echo "Deploying $latest_tag"
  ((version[2]++))
  new_tag="${version[0]}.${version[1]}.${version[2]}"
  echo "New tag: $new_tag"

  git tag -a "$new_tag" -m "Release $new_tag"
  git push ${RMT} main
  git push ${RMT} "$new_tag"
}

main "$@"
