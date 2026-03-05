use async_graphql::{Context, Enum, Object, Schema, SimpleObject, EmptyMutation, EmptySubscription};
use std::sync::RwLock;

use crate::git;

pub type GitqSchema = Schema<QueryRoot, EmptyMutation, EmptySubscription>;

const WORKING_SENTINEL: &str = "__working__";

pub struct AppState {
    pub repo_path: RwLock<Option<String>>,
}

pub struct QueryRoot;

#[Object]
impl QueryRoot {
    async fn home_path(&self) -> String {
        git::home_path()
    }

    async fn list_directory(&self, path: String) -> async_graphql::Result<Vec<FsEntry>> {
        Ok(git::list_directory(&path)?
            .into_iter()
            .map(|e| FsEntry {
                name: e.name,
                path: e.path,
                is_git_repo: e.is_git_repo,
            })
            .collect())
    }

    async fn repository(&self, ctx: &Context<'_>) -> Option<RepositoryObject> {
        let state = ctx.data::<AppState>().ok()?;
        let path = state.repo_path.read().ok()?.clone()?;
        Some(RepositoryObject { path })
    }

    async fn open_repository(&self, ctx: &Context<'_>, path: String) -> async_graphql::Result<RepositoryObject> {
        git::open(&path)?;
        let state = ctx.data::<AppState>()?;
        *state.repo_path.write().map_err(|e| async_graphql::Error::new(e.to_string()))? = Some(path.clone());
        Ok(RepositoryObject { path })
    }
}

pub struct RepositoryObject {
    path: String,
}

#[Object]
impl RepositoryObject {
    async fn path(&self) -> &str {
        &self.path
    }

    async fn current_branch(&self) -> async_graphql::Result<String> {
        let repo = git::open(&self.path)?;
        Ok(git::current_branch(&repo)?)
    }

    async fn branches(&self) -> async_graphql::Result<Vec<Branch>> {
        let repo = git::open(&self.path)?;
        Ok(git::branches(&repo)?
            .into_iter()
            .map(|b| Branch {
                name: b.name,
                is_head: b.is_head,
            })
            .collect())
    }

    async fn tree(
        &self,
        path: Option<String>,
        r#ref: Option<String>,
    ) -> async_graphql::Result<Vec<TreeEntry>> {
        let entries = if r#ref.as_deref() == Some(WORKING_SENTINEL) {
            git::working_tree(&self.path, path.as_deref())?
        } else {
            let repo = git::open(&self.path)?;
            git::tree(&repo, path.as_deref(), r#ref.as_deref())?
        };
        Ok(entries
            .into_iter()
            .map(|e| TreeEntry {
                name: e.name,
                path: e.path,
                entry_type: match e.entry_type {
                    git::EntryType::Blob => EntryKind::Blob,
                    git::EntryType::Tree => EntryKind::Tree,
                },
            })
            .collect())
    }

    async fn file(
        &self,
        path: String,
        r#ref: Option<String>,
    ) -> async_graphql::Result<Option<FileContent>> {
        let result = if r#ref.as_deref() == Some(WORKING_SENTINEL) {
            git::working_file(&self.path, &path)
        } else {
            let repo = git::open(&self.path)?;
            git::file(&repo, &path, r#ref.as_deref())
        };
        match result {
            Ok(f) => Ok(Some(FileContent {
                path: f.path,
                content: f.content,
                size: f.size as i32,
                is_binary: f.is_binary,
            })),
            Err(_) => Ok(None),
        }
    }

    async fn diff(
        &self,
        base: String,
        head: String,
    ) -> async_graphql::Result<Vec<DiffEntry>> {
        let repo = git::open(&self.path)?;
        let files = if head == WORKING_SENTINEL {
            git::compare_with_working(&repo, &base)?
        } else if base == WORKING_SENTINEL {
            return Err("base cannot be __working__".into());
        } else {
            git::compare_branches(&repo, &base, &head)?
        };
        Ok(files
            .into_iter()
            .map(|e| DiffEntry {
                path: e.path,
                status: diff_status(e.status),
                additions: e.additions as i32,
                deletions: e.deletions as i32,
            })
            .collect())
    }

    async fn diff_file(
        &self,
        base: String,
        head: String,
        path: String,
    ) -> async_graphql::Result<FileDiff> {
        let repo = git::open(&self.path)?;
        let info = if head == WORKING_SENTINEL {
            git::diff_file_with_working(&repo, &base, &path)?
        } else if base == WORKING_SENTINEL {
            return Err("base cannot be __working__".into());
        } else {
            git::diff_file(&repo, &base, &head, &path)?
        };
        Ok(FileDiff {
            path: info.path,
            status: diff_status(info.status),
            is_binary: info.is_binary,
            hunks: info
                .hunks
                .into_iter()
                .map(|h| DiffHunk {
                    header: h.header,
                    old_start: h.old_start as i32,
                    old_lines: h.old_lines as i32,
                    new_start: h.new_start as i32,
                    new_lines: h.new_lines as i32,
                    lines: h
                        .lines
                        .into_iter()
                        .map(|l| DiffLine {
                            origin: l.origin.to_string(),
                            old_lineno: l.old_lineno.map(|n| n as i32),
                            new_lineno: l.new_lineno.map(|n| n as i32),
                            content: l.content,
                        })
                        .collect(),
                })
                .collect(),
        })
    }
}

#[derive(SimpleObject)]
struct Branch {
    name: String,
    is_head: bool,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq)]
enum EntryKind {
    Blob,
    Tree,
}

#[derive(SimpleObject)]
struct TreeEntry {
    name: String,
    path: String,
    entry_type: EntryKind,
}

#[derive(SimpleObject)]
struct FileContent {
    path: String,
    content: String,
    size: i32,
    is_binary: bool,
}

#[derive(SimpleObject)]
struct FsEntry {
    name: String,
    path: String,
    is_git_repo: bool,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq)]
enum DiffStatusKind {
    Added,
    Deleted,
    Modified,
    Renamed,
}

fn diff_status(s: git::DiffStatus) -> DiffStatusKind {
    match s {
        git::DiffStatus::Added => DiffStatusKind::Added,
        git::DiffStatus::Deleted => DiffStatusKind::Deleted,
        git::DiffStatus::Modified => DiffStatusKind::Modified,
        git::DiffStatus::Renamed => DiffStatusKind::Renamed,
    }
}

#[derive(SimpleObject)]
struct DiffEntry {
    path: String,
    status: DiffStatusKind,
    additions: i32,
    deletions: i32,
}

#[derive(SimpleObject)]
struct DiffLine {
    origin: String,
    old_lineno: Option<i32>,
    new_lineno: Option<i32>,
    content: String,
}

#[derive(SimpleObject)]
struct DiffHunk {
    header: String,
    old_start: i32,
    old_lines: i32,
    new_start: i32,
    new_lines: i32,
    lines: Vec<DiffLine>,
}

#[derive(SimpleObject)]
struct FileDiff {
    path: String,
    status: DiffStatusKind,
    is_binary: bool,
    hunks: Vec<DiffHunk>,
}
