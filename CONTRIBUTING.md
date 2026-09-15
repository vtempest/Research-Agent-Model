# Contributing to QwkSearch

Thanks for your interest in contributing! We welcome bug reports, documentation improvements, feature ideas, and pull requests.

QwkSearch is a Bun + Turborepo monorepo: the web app lives in `apps/`, and the research/extraction libraries (`extract-pdf`, `extract-youtube`, `domain-rank`, `write-language`, `render-url-to-html`, …) live in `packages/`. Most contributions land in a single package.

## Before You Start

- Read the [README](README.md), the package-level `readme.md` for the package you're touching, and [TODO.md](TODO.md) for work already planned.
- Search [existing issues](https://github.com/OpenSourceAGI/qwksearch-research-agent/issues) and [pull requests](https://github.com/OpenSourceAGI/qwksearch-research-agent/pulls) to avoid duplicating work.
- For substantial changes — a new package, a new extraction pipeline, a change to a published package's public API — open an issue first to discuss the problem, proposed approach, and scope.
- Be respectful and constructive in issues, reviews, and discussions.

## Reporting Bugs

Please open an issue and include:

- A clear, descriptive title
- What you expected to happen
- What actually happened
- Steps to reproduce the problem
- Minimal reproducible code or repository, when possible — for extraction bugs, the exact URL or file that fails is usually the whole reproduction
- Relevant logs, error messages, screenshots, and environment details

Environment details should include the commit or published package version, operating system, `bun --version`, and browser version when relevant.

## Suggesting Features

Feature requests are welcome. Please explain:

- The problem or use case
- Your proposed solution
- Alternatives you considered
- Any compatibility, performance, security, or maintenance tradeoffs

Avoid starting a large implementation before maintainers have had a chance to comment on the proposal.

## Development Setup

The fastest way to get the project running is [`git0`](https://www.npmjs.com/package/git0) — it downloads the repo, detects the project type, installs dependencies with Bun, and opens your editor in one step:

```bash
npx git0 OpenSourceAGI/qwksearch-research-agent
```

`git0` downloads a source snapshot without `.git` history, which is ideal for trying the project out. To submit a pull request you need a real git clone of your own fork:

1. Fork the repository and clone your fork.
2. Create a branch from `master`.
3. Install dependencies with Bun.
4. Run the project locally and confirm the existing tests pass.

```bash
git clone https://github.com/YOUR-USERNAME/qwksearch-research-agent.git
cd qwksearch-research-agent
git checkout -b feat/short-description

bun install          # installs every workspace package
bun run dev          # starts the qwksearch-web app
bun run test         # runs the Vitest suite
```

Requires [Bun](https://bun.sh) 1.4 or newer (`packageManager` pins the exact version).

## Making Changes

- Keep changes focused; avoid unrelated refactors in the same pull request.
- Match the existing code style, naming conventions, and project architecture.
- Keep package boundaries clean — a package should not reach into another package's internals; import from its public entry point instead.
- Add or update tests for behavior changes and bug fixes.
- Update documentation, examples, types, and the package `readme.md` when applicable.
- Do not commit secrets, credentials, API keys, private keys, generated build output, or unrelated `bun.lock` changes.
- Write clear commit messages that describe the change.

## Testing

Before opening a pull request, run the relevant checks locally:

```bash
bun run test         # full Vitest suite from the repo root
bun run build        # turbo build across the workspace
```

To work on a single package, run its tests from that package — this is exactly what CI does per package:

```bash
cd packages/extract-pdf
bun run test:coverage
```

Some packages are consumed by others through their built `dist` output. If a dependent package fails to resolve, build them first:

```bash
bunx turbo build --filter=extract-pdf --filter=extract-youtube --filter=react-reason-editor --filter=use-voice-control
```

If you cannot run a check, state that clearly in the pull request and explain why.

## Pull Requests

When opening a pull request:

- Target the `master` branch.
- Use a concise title that describes the user-visible change.
- Explain what changed and why.
- Link related issues using `Fixes #123` or `Closes #123` when appropriate.
- Include test results and any manual verification steps.
- Include screenshots or recordings for user-interface changes.
- Note which workspace packages are affected, and whether a published package needs a version bump.
- Keep the pull request small enough to review effectively.
- Respond to review feedback constructively and update the branch as requested.

### Pull Request Template

```md
## Summary

- What does this change do?

## Motivation

- What problem does it solve?

## Packages affected

- `packages/...`

## Testing

- [ ] Tests added or updated
- [ ] `bun run test` passes
- [ ] `bun run build` passes
- [ ] Manual testing completed

## Screenshots / Notes

- Add screenshots, migration notes, or rollout considerations if relevant.
```

## Documentation

Documentation changes are valuable contributions. Please keep examples accurate, use clear language, and update related pages when behavior or configuration changes. Each package documents its own API in its `readme.md` — keep that in sync with the code.

## License

By contributing, you agree that your contributions will be licensed under the same license as this repository (PROSPER 1.0.0, see [LICENSE.md](LICENSE.md)).

## Questions

If you are unsure where to start, open a discussion or issue describing what you would like to work on. Maintainers can help identify an appropriate next step.
