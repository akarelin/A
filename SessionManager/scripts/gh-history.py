#!/usr/bin/env python3
"""
gh-history — Download full GitHub repository history: commits across all
branches, pull requests, merges, and releases with file-level change stats.

Usage:
  gh-history.py <owner/repo> [options]
  gh-history.py .                          # detect repo from current git remote

Options:
  --since DATE        Commits/PRs after this date (ISO 8601, e.g. 2025-01-01)
  --until DATE        Commits before this date
  --author AUTHOR     Filter commits by author (login or email substring)
  --limit N           Max commits to fetch (default: 500)
  --format FMT        Output format: json (default), csv, summary
  --out FILE          Write output to file instead of stdout
  --commits-only      Skip PRs, releases, tags (faster, commits only)

Examples:
  gh-history.py . --format summary
  gh-history.py . --limit 200 --out history.json
  gh-history.py owner/repo --since 2025-03-01 --format csv --out commits.csv
  gh-history.py owner/repo --commits-only --author alex --format summary
"""

import argparse
import csv
import json
import subprocess
import sys
from datetime import datetime, timezone


# -- GitHub API helpers -------------------------------------------------------

def run_gh(args: list[str], paginate: bool = False) -> str:
    cmd = ["gh", "api"]
    if paginate:
        cmd.append("--paginate")
    cmd.extend(args)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        print(f"Error: gh api failed: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    return result.stdout


def gh_paginated_lines(endpoint: str, jq: str) -> list[str]:
    raw = run_gh([endpoint, "--jq", jq], paginate=True)
    return [line.strip() for line in raw.strip().splitlines() if line.strip()]


def detect_repo() -> str:
    result = subprocess.run(
        ["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("Error: could not detect repo from current directory", file=sys.stderr)
        sys.exit(1)
    return result.stdout.strip()


# -- Branches -----------------------------------------------------------------

def fetch_branches(repo: str) -> list[dict]:
    lines = gh_paginated_lines(
        f"/repos/{repo}/branches?per_page=100",
        '.[] | "\\(.name)\\t\\(.commit.sha)"')
    branches = []
    for line in lines:
        if "\t" not in line:
            continue
        name, sha = line.split("\t", 1)
        branches.append({"name": name.strip(), "sha": sha.strip()})
    return branches


# -- Commits across all branches ----------------------------------------------

def fetch_all_branch_commits(repo: str, branches: list[dict],
                             since: str | None, until: str | None,
                             author: str | None, limit: int) -> list[dict]:
    seen: set[str] = set()
    all_shas: list[tuple[str, str]] = []  # (sha, first_branch)
    branch_map: dict[str, list[str]] = {}

    for br in branches:
        branch_name = br["name"]
        print(f"  branch: {branch_name}", file=sys.stderr, end="", flush=True)

        endpoint = f"/repos/{repo}/commits?per_page=100&sha={branch_name}"
        if since:
            endpoint += f"&since={since}T00:00:00Z"
        if until:
            endpoint += f"&until={until}T23:59:59Z"
        if author:
            endpoint += f"&author={author}"

        shas = gh_paginated_lines(endpoint, ".[].sha")
        new = 0
        for sha in shas:
            branch_map.setdefault(sha, [])
            if branch_name not in branch_map[sha]:
                branch_map[sha].append(branch_name)
            if sha not in seen:
                seen.add(sha)
                all_shas.append((sha, branch_name))
                new += 1
        print(f"  ({len(shas)} commits, {new} new)", file=sys.stderr)

    if limit and len(all_shas) > limit:
        all_shas = all_shas[:limit]

    print(f"  unique commits: {len(all_shas)}, fetching details...",
          file=sys.stderr)

    commits = []
    total = len(all_shas)
    for i, (sha, _) in enumerate(all_shas, 1):
        raw = run_gh([f"/repos/{repo}/commits/{sha}"])
        detail = json.loads(raw)
        rec = parse_commit(detail)
        rec["branches"] = branch_map.get(sha, [])
        commits.append(rec)
        if i % 50 == 0 or i == total:
            print(f"  [{i}/{total}]", file=sys.stderr)

    return commits


def parse_commit(c: dict) -> dict:
    commit_info = c.get("commit", {})
    author_info = commit_info.get("author", {})
    committer_info = commit_info.get("committer", {})
    stats = c.get("stats", {})
    files = c.get("files", [])
    parents = c.get("parents", [])

    return {
        "sha": c.get("sha", ""),
        "short_sha": c.get("sha", "")[:8],
        "message": commit_info.get("message", "").split("\n")[0],
        "full_message": commit_info.get("message", ""),
        "author_name": author_info.get("name", ""),
        "author_email": author_info.get("email", ""),
        "author_login": (c.get("author") or {}).get("login", ""),
        "date": author_info.get("date", ""),
        "committer_name": committer_info.get("name", ""),
        "committer_date": committer_info.get("date", ""),
        "additions": stats.get("additions", 0),
        "deletions": stats.get("deletions", 0),
        "total_changes": stats.get("total", 0),
        "files_changed": len(files),
        "is_merge": len(parents) > 1,
        "parents": [p.get("sha", "")[:8] for p in parents],
        "files": [
            {
                "filename": f.get("filename", ""),
                "status": f.get("status", ""),
                "additions": f.get("additions", 0),
                "deletions": f.get("deletions", 0),
                "changes": f.get("changes", 0),
                "patch_size": len(f.get("patch", "")),
            }
            for f in files
        ],
    }


# -- Pull Requests ------------------------------------------------------------

def fetch_pull_requests(repo: str, since: str | None) -> list[dict]:
    print(f"  fetching pull requests...", file=sys.stderr)
    raw = run_gh(
        [f"/repos/{repo}/pulls?state=all&sort=updated&direction=desc&per_page=100"],
        paginate=True)
    if not raw.strip():
        return []
    all_prs = json.loads(raw)

    records = []
    for pr in all_prs:
        updated = pr.get("updated_at", "")
        if since and updated and updated < f"{since}T00:00:00Z":
            continue
        records.append(parse_pr(pr))

    merged = sum(1 for r in records if r["merged"])
    print(f"  {len(records)} PRs ({merged} merged)", file=sys.stderr)

    # Fetch reviews and files for each PR
    for i, rec in enumerate(records, 1):
        num = rec["number"]
        # Reviews
        try:
            rev_raw = run_gh([f"/repos/{repo}/pulls/{num}/reviews"])
            if rev_raw.strip():
                rec["reviews"] = [
                    {"user": (r.get("user") or {}).get("login", ""),
                     "state": r.get("state", ""),
                     "submitted_at": r.get("submitted_at") or ""}
                    for r in json.loads(rev_raw)
                ]
        except Exception:
            rec["reviews"] = []
        # Files
        try:
            files_raw = run_gh(
                [f"/repos/{repo}/pulls/{num}/files?per_page=100"],
                paginate=True)
            if files_raw.strip():
                rec["files"] = [
                    {"filename": f.get("filename", ""),
                     "status": f.get("status", ""),
                     "additions": f.get("additions", 0),
                     "deletions": f.get("deletions", 0),
                     "changes": f.get("changes", 0)}
                    for f in json.loads(files_raw)
                ]
                rec["files_changed"] = len(rec["files"])
        except Exception:
            pass
        if i % 25 == 0 or i == len(records):
            print(f"  PR details [{i}/{len(records)}]", file=sys.stderr)

    return records


def parse_pr(pr: dict) -> dict:
    return {
        "number": pr.get("number", 0),
        "title": pr.get("title", ""),
        "body": (pr.get("body") or "")[:2000],
        "state": pr.get("state", ""),
        "author_login": (pr.get("user") or {}).get("login", ""),
        "created_at": pr.get("created_at", ""),
        "updated_at": pr.get("updated_at", ""),
        "closed_at": pr.get("closed_at") or "",
        "merged": pr.get("merged_at") is not None,
        "merged_at": pr.get("merged_at") or "",
        "merge_commit_sha": (pr.get("merge_commit_sha") or "")[:8],
        "head_branch": (pr.get("head") or {}).get("ref", ""),
        "head_sha": ((pr.get("head") or {}).get("sha") or "")[:8],
        "base_branch": (pr.get("base") or {}).get("ref", ""),
        "labels": [l.get("name", "") for l in (pr.get("labels") or [])],
        "draft": pr.get("draft", False),
        "additions": pr.get("additions", 0),
        "deletions": pr.get("deletions", 0),
        "changed_files": pr.get("changed_files", 0),
        "commits_count": pr.get("commits", 0),
        "comments_count": pr.get("comments", 0),
        "review_comments_count": pr.get("review_comments", 0),
        "requested_reviewers": [
            (r.get("login") or r.get("name", ""))
            for r in (pr.get("requested_reviewers") or [])
        ],
        "assignees": [a.get("login", "") for a in (pr.get("assignees") or [])],
        "milestone": (pr.get("milestone") or {}).get("title", ""),
        "reviews": [],
        "files": [],
        "files_changed": pr.get("changed_files", 0),
    }


# -- Releases -----------------------------------------------------------------

def fetch_releases(repo: str) -> list[dict]:
    print(f"  fetching releases...", file=sys.stderr)
    raw = run_gh(
        [f"/repos/{repo}/releases?per_page=100"], paginate=True)
    if not raw.strip():
        print(f"  0 releases", file=sys.stderr)
        return []
    all_rels = json.loads(raw)
    records = []
    for rel in all_rels:
        records.append({
            "id": rel.get("id", 0),
            "tag_name": rel.get("tag_name", ""),
            "name": rel.get("name") or rel.get("tag_name", ""),
            "body": (rel.get("body") or "")[:3000],
            "draft": rel.get("draft", False),
            "prerelease": rel.get("prerelease", False),
            "created_at": rel.get("created_at", ""),
            "published_at": rel.get("published_at") or "",
            "author_login": (rel.get("author") or {}).get("login", ""),
            "target_commitish": rel.get("target_commitish", ""),
            "assets": [
                {"name": a.get("name", ""),
                 "size": a.get("size", 0),
                 "download_count": a.get("download_count", 0),
                 "content_type": a.get("content_type", "")}
                for a in (rel.get("assets") or [])
            ],
        })
    print(f"  {len(records)} releases", file=sys.stderr)
    return records


# -- Tags ---------------------------------------------------------------------

def fetch_tags(repo: str) -> list[dict]:
    print(f"  fetching tags...", file=sys.stderr)
    lines = gh_paginated_lines(
        f"/repos/{repo}/tags?per_page=100",
        '.[] | "\\(.name)\\t\\(.commit.sha)"')
    tags = []
    for line in lines:
        if "\t" not in line:
            continue
        name, sha = line.split("\t", 1)
        tags.append({"name": name.strip(), "sha": sha.strip()[:8]})
    print(f"  {len(tags)} tags", file=sys.stderr)
    return tags


# -- Output formatters --------------------------------------------------------

def output_json(data: dict, out) -> None:
    json.dump(data, out, indent=2, ensure_ascii=False)
    out.write("\n")


def output_csv(data: dict, out) -> None:
    """CSV of commits + separate sections for PRs and releases."""
    commits = data.get("commits", [])
    prs = data.get("pull_requests", [])
    releases = data.get("releases", [])

    # Commits
    out.write("# COMMITS\n")
    c_fields = [
        "sha", "short_sha", "date", "author_name", "author_login",
        "message", "additions", "deletions", "total_changes",
        "files_changed", "is_merge", "branches"
    ]
    writer = csv.DictWriter(out, fieldnames=c_fields, extrasaction="ignore")
    writer.writeheader()
    for r in commits:
        row = dict(r)
        row["branches"] = ";".join(r.get("branches", []))
        writer.writerow(row)

    # PRs
    if prs:
        out.write("\n# PULL REQUESTS\n")
        pr_fields = [
            "number", "title", "state", "author_login", "created_at",
            "merged", "merged_at", "merge_commit_sha",
            "head_branch", "base_branch", "additions", "deletions",
            "files_changed", "commits_count", "labels"
        ]
        writer = csv.DictWriter(out, fieldnames=pr_fields, extrasaction="ignore")
        writer.writeheader()
        for p in prs:
            row = dict(p)
            row["labels"] = ";".join(p.get("labels", []))
            writer.writerow(row)

    # Releases
    if releases:
        out.write("\n# RELEASES\n")
        rel_fields = [
            "tag_name", "name", "author_login", "published_at",
            "draft", "prerelease", "target_commitish"
        ]
        writer = csv.DictWriter(out, fieldnames=rel_fields, extrasaction="ignore")
        writer.writeheader()
        for rel in releases:
            writer.writerow(rel)


def output_summary(data: dict, repo: str, out) -> None:
    commits = data.get("commits", [])
    prs = data.get("pull_requests", [])
    releases = data.get("releases", [])
    branches = data.get("branches", [])
    tags = data.get("tags", [])

    total_add = sum(r["additions"] for r in commits)
    total_del = sum(r["deletions"] for r in commits)
    merge_commits = [c for c in commits if c.get("is_merge")]

    # Author stats
    authors: dict[str, dict] = {}
    for r in commits:
        key = r["author_login"] or r["author_name"] or r["author_email"]
        if key not in authors:
            authors[key] = {"commits": 0, "additions": 0, "deletions": 0,
                            "files": 0, "merges": 0}
        authors[key]["commits"] += 1
        authors[key]["additions"] += r["additions"]
        authors[key]["deletions"] += r["deletions"]
        authors[key]["files"] += r["files_changed"]
        if r.get("is_merge"):
            authors[key]["merges"] += 1

    dates = [r["date"] for r in commits if r["date"]]
    date_min = min(dates)[:10] if dates else "?"
    date_max = max(dates)[:10] if dates else "?"

    out.write(f"=== GitHub Full History: {repo} ===\n\n")
    out.write(f"Period:          {date_min} .. {date_max}\n")
    out.write(f"Branches:        {len(branches)}")
    if branches:
        names = ", ".join(b["name"] for b in branches[:8])
        if len(branches) > 8:
            names += f" ... (+{len(branches)-8})"
        out.write(f"  ({names})")
    out.write("\n")
    out.write(f"Tags:            {len(tags)}\n")
    out.write(f"Total commits:   {len(commits)} ({len(merge_commits)} merges)\n")
    out.write(f"Total additions: +{total_add}\n")
    out.write(f"Total deletions: -{total_del}\n")
    out.write(f"Net change:      {total_add - total_del:+d}\n")
    out.write(f"Contributors:    {len(authors)}\n\n")

    # Contributors
    out.write("--- Contributors ---\n")
    out.write(f"{'Author':<30} {'Commits':>8} {'Merges':>8} "
              f"{'Additions':>10} {'Deletions':>10} {'Files':>8}\n")
    out.write("-" * 80 + "\n")
    for author, s in sorted(authors.items(),
                            key=lambda x: x[1]["commits"], reverse=True):
        out.write(f"{author:<30} {s['commits']:>8} {s['merges']:>8} "
                  f"{'+' + str(s['additions']):>10} "
                  f"{'-' + str(s['deletions']):>10} {s['files']:>8}\n")

    # PRs
    if prs:
        merged_prs = [p for p in prs if p["merged"]]
        open_prs = [p for p in prs if p["state"] == "open"]
        closed_nm = [p for p in prs if p["state"] == "closed" and not p["merged"]]

        out.write(f"\n--- Pull Requests ({len(prs)} total) ---\n")
        out.write(f"Merged: {len(merged_prs)}  Open: {len(open_prs)}  "
                  f"Closed (not merged): {len(closed_nm)}\n\n")

        out.write(f"{'#':<6} {'State':<12} {'Author':<20} {'Title':<50} "
                  f"{'Adds':>6} {'Dels':>6} {'Files':>6}\n")
        out.write("-" * 105 + "\n")
        for p in prs[:50]:
            state = "MERGED" if p["merged"] else p["state"].upper()
            title = p["title"][:48] if len(p["title"]) > 48 else p["title"]
            out.write(f"#{p['number']:<5} {state:<12} {p['author_login']:<20} "
                      f"{title:<50} {'+' + str(p['additions']):>6} "
                      f"{'-' + str(p['deletions']):>6} "
                      f"{p['files_changed']:>6}\n")
        if len(prs) > 50:
            out.write(f"  ... and {len(prs) - 50} more\n")

    # Releases
    if releases:
        out.write(f"\n--- Releases ({len(releases)}) ---\n")
        out.write(f"{'Tag':<25} {'Name':<35} {'Author':<20} {'Published':<12}\n")
        out.write("-" * 95 + "\n")
        for rel in releases[:20]:
            name = rel["name"][:33] if len(rel["name"]) > 33 else rel["name"]
            pub = rel["published_at"][:10] if rel["published_at"] else "draft"
            out.write(f"{rel['tag_name']:<25} {name:<35} "
                      f"{rel['author_login']:<20} {pub:<12}\n")

    # File hotspots from commits
    file_freq: dict[str, dict] = {}
    for r in commits:
        for f in r.get("files", []):
            fn = f["filename"]
            if fn not in file_freq:
                file_freq[fn] = {"touches": 0, "additions": 0, "deletions": 0}
            file_freq[fn]["touches"] += 1
            file_freq[fn]["additions"] += f["additions"]
            file_freq[fn]["deletions"] += f["deletions"]

    if file_freq:
        out.write(f"\n--- Most Changed Files (top 20) ---\n")
        out.write(f"{'File':<60} {'Touches':>8} {'Additions':>10} "
                  f"{'Deletions':>10}\n")
        out.write("-" * 90 + "\n")
        top = sorted(file_freq.items(),
                     key=lambda x: x[1]["touches"], reverse=True)[:20]
        for fn, s in top:
            display = fn if len(fn) <= 58 else "..." + fn[-55:]
            out.write(f"{display:<60} {s['touches']:>8} "
                      f"{'+' + str(s['additions']):>10} "
                      f"{'-' + str(s['deletions']):>10}\n")

    out.write("\n")


# -- Main ---------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Download full GitHub history: commits (all branches), "
                    "PRs, merges, releases")
    parser.add_argument("repo",
                        help="owner/repo or '.' to detect from git remote")
    parser.add_argument("--since",
                        help="Commits/PRs after this date (YYYY-MM-DD)")
    parser.add_argument("--until",
                        help="Commits before this date (YYYY-MM-DD)")
    parser.add_argument("--author",
                        help="Filter commits by author login/email")
    parser.add_argument("--limit", type=int, default=500,
                        help="Max commits (default: 500)")
    parser.add_argument("--format",
                        choices=["json", "csv", "summary"], default="json",
                        help="Output format (default: json)")
    parser.add_argument("--out",
                        help="Output file (default: stdout)")
    parser.add_argument("--commits-only", action="store_true",
                        help="Skip PRs, releases, tags (faster)")

    args = parser.parse_args()

    repo = args.repo
    if repo == ".":
        repo = detect_repo()
        print(f"Detected repo: {repo}", file=sys.stderr)

    # 1. Branches
    print(f"Fetching branches...", file=sys.stderr)
    branches = fetch_branches(repo)
    print(f"{len(branches)} branches found", file=sys.stderr)

    # 2. Commits across all branches
    print(f"Fetching commits across all branches...", file=sys.stderr)
    commits = fetch_all_branch_commits(
        repo, branches, args.since, args.until, args.author, args.limit)

    data = {
        "repo": repo,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "branches": branches,
        "commits": commits,
    }

    if not args.commits_only:
        # 3. PRs
        prs = fetch_pull_requests(repo, args.since)
        data["pull_requests"] = prs

        # 4. Releases
        releases = fetch_releases(repo)
        data["releases"] = releases

        # 5. Tags
        tags = fetch_tags(repo)
        data["tags"] = tags
    else:
        data["pull_requests"] = []
        data["releases"] = []
        data["tags"] = []

    # Stats for stderr
    merge_count = sum(1 for c in commits if c.get("is_merge"))
    total_add = sum(c["additions"] for c in commits)
    total_del = sum(c["deletions"] for c in commits)
    print(f"\nTotal: {len(commits)} commits ({merge_count} merges) across "
          f"{len(branches)} branches", file=sys.stderr)
    print(f"Changes: +{total_add} / -{total_del} (net {total_add - total_del:+d})",
          file=sys.stderr)
    if not args.commits_only:
        print(f"PRs: {len(data['pull_requests'])}  "
              f"Releases: {len(data['releases'])}  "
              f"Tags: {len(data['tags'])}", file=sys.stderr)

    # Output
    out = open(args.out, "w", encoding="utf-8") if args.out else sys.stdout
    try:
        if args.format == "json":
            output_json(data, out)
        elif args.format == "csv":
            output_csv(data, out)
        elif args.format == "summary":
            output_summary(data, repo, out)
    finally:
        if args.out:
            out.close()
            print(f"Written to {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
