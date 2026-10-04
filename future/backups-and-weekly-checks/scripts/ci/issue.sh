#!/usr/bin/env bash
# Opens (or adds to) a GitHub issue when an automated job finds a problem, and
# closes it once the job passes again. GitHub emails the repo owner about it.
# Usage: issue.sh open "<title>" <body-file>
#        issue.sh resolve "<title>" "<closing comment>"
set -euo pipefail
action="$1" title="$2"
existing=$(gh issue list --state open --search "\"$title\" in:title" --json number,title \
  --jq "map(select(.title == \"$title\")) | .[0].number // empty")

if [ "$action" = "open" ]; then
  if [ -n "$existing" ]; then
    gh issue comment "$existing" --body-file "$3"
  else
    gh issue create --title "$title" --body-file "$3"
  fi
elif [ "$action" = "resolve" ] && [ -n "$existing" ]; then
  gh issue close "$existing" --comment "$3"
fi
