use async_graphql::{Context, Enum, Object, Schema, SimpleObject, EmptyMutation, EmptySubscription};
use std::sync::RwLock;

use crate::git;

pub type GitqSchema = Schema<QueryRoot, EmptyMutation, EmptySubscription>;

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
        let repo = git::open(&self.path)?;
        Ok(git::tree(&repo, path.as_deref(), r#ref.as_deref())?
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
        let repo = git::open(&self.path)?;
        match git::file(&repo, &path, r#ref.as_deref()) {
            Ok(f) => Ok(Some(FileContent {
                path: f.path,
                content: f.content,
                size: f.size as i32,
                is_binary: f.is_binary,
            })),
            Err(_) => Ok(None),
        }
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
