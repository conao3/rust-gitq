# gitq

A modern [cgit](https://git.zx2c4.com/cgit/about/) — browse local git repositories with a GitHub-like UI.

gitq is a desktop application that lets you discover and explore your local git repositories through a clean, modern interface inspired by GitHub. Think of it as cgit rebuilt for the desktop era: launch the app, navigate your filesystem to find repositories, and instantly get a familiar code browsing experience.

## Features

- **Filesystem navigator** — Browse your filesystem starting from `$HOME`, with git repositories automatically detected and highlighted
- **Repository view** — GitHub-like UI with file tree and file viewer once you open a repository
- **File tree** — Expandable/collapsible directory tree, sorted directories-first
- **File viewer** — View file contents with line numbers
- **Branch switching** — Switch between local branches from the header
- **Binary detection** — Gracefully handles binary files

## Architecture

```
Frontend (React + Tailwind)          Backend (Rust + Tauri 2)
┌──────────────────────┐            ┌──────────────────────┐
│                      │  invoke()  │ #[tauri::command]     │
│  graphql() helper    │ ────────>  │ fn graphql(query)     │
│                      │            │   → async-graphql     │
│  React components    │   JSON     │   → git2 (libgit2)    │
│                      │ <────────  │                       │
└──────────────────────┘            └──────────────────────┘
```

- Single `invoke("graphql")` command relays all queries to the async-graphql backend
- Repository operations powered by [git2](https://github.com/rust-lang/git2-rs) (libgit2 bindings)
- Built-in filesystem navigator discovers git repositories without OS dialogs

## Prerequisites

- [Nix](https://nixos.org/) with flakes enabled (provides all build dependencies)
- Or manually: Rust, Node.js, pnpm

## Getting Started

```sh
make install   # install frontend dependencies
make dev       # launch in development mode
```

## Development

```sh
make dev       # run with hot-reload
make dev-web   # run frontend only (in browser)
make build     # production build
make fmt       # format with treefmt (via nix)
make clean     # remove build artifacts
```

## License

Apache-2.0
