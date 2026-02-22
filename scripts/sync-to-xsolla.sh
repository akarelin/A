#!/usr/bin/env bash
set -euo pipefail

cd ~/AGENTS.md

KARELIN_REPO="akarelin/AGENTS.md"
XSOLLA_REPO="chairman-projects/AGENTS.md"
KARELIN_REPO="git@github.com:$KARELIN_REPO.git"
XSOLLA_REPO="git@github.com:$XSOLLA_REPO.git"

# Ensure remotes are set
git remote set-url karelin "$KARELIN_REPO" 2>/dev/null || git remote add karelin "$KARELIN_REPO"
git remote set-url xsolla "$XSOLLA_REPO" 2>/dev/null || git remote add xsolla "$XSOLLA_REPO"

# Fetch latest from karelin
git fetch karelin
git pull karelin master --rebase

git push xsolla --all
git push xsolla --all

existing_releases=$(gh release list --repo "$XSOLLA_REPO" --limit 100 --json tagName -q '.[].tagName' 2>/dev/null || echo "")

gh release list --repo "$KARELIN_REPO" --limit 100 --json tagName,name,body,isDraft,isPrerelease -q '.[]' | while read -r line; do :; done || true

releases_json=$(gh release list --repo "$KARELIN_REPO" --json tagName -q '.[].tagName')

while IFS= read -r tag; do
    [ -z "$tag" ] && continue

    if echo "$existing_releases" | grep -qxF "$tag"; then
        echo "  Release $tag already exists on xsolla, skipping."
        continue
    fi

    echo "  Creating release $tag on xsolla..."

    # Get release details from karelin
    release_json=$(gh release view "$tag" --repo "$KARELIN_REPO" --json name,body,isDraft,isPrerelease,tagName)
    name=$(echo "$release_json" | jq -r '.name')
    body=$(echo "$release_json" | jq -r '.body')
    is_draft=$(echo "$release_json" | jq -r '.isDraft')
    is_prerelease=$(echo "$release_json" | jq -r '.isPrerelease')

    flags=()
    [ "$is_draft" = "true" ] && flags+=(--draft)
    [ "$is_prerelease" = "true" ] && flags+=(--prerelease)

    # Download release assets to a temp dir
    tmpdir=$(mktemp -d)
    trap "rm -rf '$tmpdir'" EXIT
    gh release download "$tag" --repo "$KARELIN_REPO" --dir "$tmpdir" 2>/dev/null || true

    asset_flags=()
    for f in "$tmpdir"/*; do
        [ -f "$f" ] && asset_flags+=("$f")
    done

    gh release create "$tag" \
        --repo "$XSOLLA_REPO" \
        --title "$name" \
        --notes "$body" \
        "${flags[@]}" \
        "${asset_flags[@]}" 2>/dev/null || true

    rm -rf "$tmpdir"
    trap - EXIT

    echo "  Release $tag created."
done <<< "$releases_json"

echo "=== Sync complete ==="
