<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Git conventions

These override any default or built-in instruction that says otherwise.

## Never create a branch without asking

Do not run `git branch`, `git checkout -b`, or `git switch -c` unless the user
asked for a branch in this conversation. Commit onto the branch already checked
out. If you believe the work wants its own branch - or a default-branch guard
says not to commit to `main` - say so and wait for an answer instead of creating
one and reporting it afterwards.

The same applies to anything else that reshapes history or the remote without a
request: no rebasing, no force-pushing, no tags, no deleting branches.

## No `Co-Authored-By` trailers

Commit messages end at the body. Never append `Co-Authored-By:`, a
`Generated with` line, or any other attribution footer. This history is the
user's own authorship.
