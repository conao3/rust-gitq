use git2::Repository;

pub fn open(path: &str) -> Result<Repository, String> {
    Repository::open(path).map_err(|e| e.message().to_string())
}

pub fn is_git_repo(path: &str) -> bool {
    std::path::Path::new(path).join(".git").exists()
}

pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_git_repo: bool,
}

pub fn list_directory(path: &str) -> Result<Vec<DirEntry>, String> {
    let read_dir = std::fs::read_dir(path).map_err(|e| e.to_string())?;

    let mut entries: Vec<DirEntry> = read_dir
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                return None;
            }
            let file_type = entry.file_type().ok()?;
            if !file_type.is_dir() {
                return None;
            }
            let full_path = entry.path().to_string_lossy().to_string();
            Some(DirEntry {
                is_git_repo: is_git_repo(&full_path),
                name,
                path: full_path,
            })
        })
        .collect();

    entries.sort_by(|a, b| {
        b.is_git_repo
            .cmp(&a.is_git_repo)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

pub fn home_path() -> String {
    std::env::var("HOME").unwrap_or_else(|_| "/".to_string())
}

pub fn current_branch(repo: &Repository) -> Result<String, String> {
    let head = repo.head().map_err(|e| e.message().to_string())?;
    Ok(head
        .shorthand()
        .unwrap_or("HEAD")
        .to_string())
}

pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
}

pub fn branches(repo: &Repository) -> Result<Vec<BranchInfo>, String> {
    let branches = repo
        .branches(Some(git2::BranchType::Local))
        .map_err(|e| e.message().to_string())?;

    let head_name = current_branch(repo).unwrap_or_default();

    branches
        .filter_map(|b| b.ok())
        .map(|(branch, _)| {
            let name = branch
                .name()
                .ok()
                .flatten()
                .unwrap_or("unknown")
                .to_string();
            Ok(BranchInfo {
                is_head: name == head_name,
                name,
            })
        })
        .collect()
}

pub enum EntryType {
    Blob,
    Tree,
}

pub struct TreeEntry {
    pub name: String,
    pub path: String,
    pub entry_type: EntryType,
}

pub fn tree(repo: &Repository, path: Option<&str>, git_ref: Option<&str>) -> Result<Vec<TreeEntry>, String> {
    let reference = match git_ref {
        Some(r) => repo.revparse_single(r).map_err(|e| e.message().to_string())?,
        None => {
            let head = repo.head().map_err(|e| e.message().to_string())?;
            head.peel_to_commit()
                .map_err(|e| e.message().to_string())?
                .into_object()
        }
    };

    let commit_tree = reference
        .peel_to_tree()
        .map_err(|e| e.message().to_string())?;

    let target_tree = match path {
        Some(p) if !p.is_empty() => {
            let entry = commit_tree
                .get_path(std::path::Path::new(p))
                .map_err(|e| e.message().to_string())?;
            repo.find_tree(entry.id())
                .map_err(|e| e.message().to_string())?
        }
        _ => commit_tree,
    };

    let mut entries: Vec<TreeEntry> = target_tree
        .iter()
        .filter_map(|entry| {
            let name = entry.name()?.to_string();
            let entry_type = match entry.kind()? {
                git2::ObjectType::Blob => EntryType::Blob,
                git2::ObjectType::Tree => EntryType::Tree,
                _ => return None,
            };
            let entry_path = match path {
                Some(p) if !p.is_empty() => format!("{}/{}", p, name),
                _ => name.clone(),
            };
            Some(TreeEntry {
                name,
                path: entry_path,
                entry_type,
            })
        })
        .collect();

    entries.sort_by(|a, b| {
        let type_order = |e: &TreeEntry| match e.entry_type {
            EntryType::Tree => 0,
            EntryType::Blob => 1,
        };
        type_order(a)
            .cmp(&type_order(b))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

pub struct FileContent {
    pub path: String,
    pub content: String,
    pub size: usize,
    pub is_binary: bool,
}

pub fn file(repo: &Repository, path: &str, git_ref: Option<&str>) -> Result<FileContent, String> {
    let reference = match git_ref {
        Some(r) => repo.revparse_single(r).map_err(|e| e.message().to_string())?,
        None => {
            let head = repo.head().map_err(|e| e.message().to_string())?;
            head.peel_to_commit()
                .map_err(|e| e.message().to_string())?
                .into_object()
        }
    };

    let tree = reference
        .peel_to_tree()
        .map_err(|e| e.message().to_string())?;

    let entry = tree
        .get_path(std::path::Path::new(path))
        .map_err(|e| e.message().to_string())?;

    let blob = repo
        .find_blob(entry.id())
        .map_err(|e| e.message().to_string())?;

    let is_binary = blob.is_binary();
    let size = blob.size();
    let content = if is_binary {
        String::new()
    } else {
        String::from_utf8_lossy(blob.content()).to_string()
    };

    Ok(FileContent {
        path: path.to_string(),
        content,
        size,
        is_binary,
    })
}
