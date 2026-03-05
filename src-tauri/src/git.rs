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
    pub remote: Option<String>,
}

pub fn branches(repo: &Repository) -> Result<Vec<BranchInfo>, String> {
    let all = repo
        .branches(None)
        .map_err(|e| e.message().to_string())?;

    let head_name = current_branch(repo).unwrap_or_default();

    let mut result: Vec<BranchInfo> = all
        .filter_map(|b| b.ok())
        .filter_map(|(branch, branch_type)| {
            let name = branch.name().ok().flatten()?.to_string();
            let remote = match branch_type {
                git2::BranchType::Remote => {
                    let r = name.split('/').next().unwrap_or("").to_string();
                    Some(r)
                }
                git2::BranchType::Local => None,
            };
            Some(BranchInfo {
                is_head: branch_type == git2::BranchType::Local && name == head_name,
                name,
                remote,
            })
        })
        .collect();

    result.sort_by(|a, b| {
        a.remote
            .is_some()
            .cmp(&b.remote.is_some())
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(result)
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

#[derive(Copy, Clone)]
pub enum DiffStatus {
    Added,
    Deleted,
    Modified,
    Renamed,
}

pub struct DiffFileEntry {
    pub path: String,
    pub status: DiffStatus,
    pub additions: usize,
    pub deletions: usize,
}

pub struct DiffLineInfo {
    pub origin: char,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
    pub content: String,
}

pub struct DiffHunkInfo {
    pub header: String,
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLineInfo>,
}

pub struct FileDiffInfo {
    pub path: String,
    pub status: DiffStatus,
    pub is_binary: bool,
    pub hunks: Vec<DiffHunkInfo>,
}

pub fn merge_base(repo: &Repository, ref1: &str, ref2: &str) -> Result<String, String> {
    let oid1 = repo
        .revparse_single(ref1)
        .map_err(|e| e.message().to_string())?
        .id();
    let oid2 = repo
        .revparse_single(ref2)
        .map_err(|e| e.message().to_string())?
        .id();
    let base = repo
        .merge_base(oid1, oid2)
        .map_err(|e| e.message().to_string())?;
    Ok(base.to_string())
}

fn resolve_tree<'a>(repo: &'a Repository, git_ref: &str) -> Result<git2::Tree<'a>, String> {
    repo.revparse_single(git_ref)
        .map_err(|e| e.message().to_string())?
        .peel_to_tree()
        .map_err(|e| e.message().to_string())
}

fn delta_to_status(delta: git2::Delta) -> DiffStatus {
    match delta {
        git2::Delta::Added => DiffStatus::Added,
        git2::Delta::Deleted => DiffStatus::Deleted,
        git2::Delta::Renamed => DiffStatus::Renamed,
        _ => DiffStatus::Modified,
    }
}

pub fn compare_branches(
    repo: &Repository,
    base_ref: &str,
    head_ref: &str,
    ignore_whitespace: bool,
) -> Result<Vec<DiffFileEntry>, String> {
    let base_tree = resolve_tree(repo, base_ref)?;
    let head_tree = resolve_tree(repo, head_ref)?;

    let mut opts = git2::DiffOptions::new();
    opts.ignore_whitespace(ignore_whitespace);
    let diff = repo
        .diff_tree_to_tree(Some(&base_tree), Some(&head_tree), Some(&mut opts))
        .map_err(|e| e.message().to_string())?;

    let mut entries: Vec<DiffFileEntry> = diff
        .deltas()
        .map(|delta| {
            let path = delta
                .new_file()
                .path()
                .or_else(|| delta.old_file().path())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            DiffFileEntry {
                path,
                status: delta_to_status(delta.status()),
                additions: 0,
                deletions: 0,
            }
        })
        .collect();

    let stats = diff.stats().map_err(|e| e.message().to_string())?;
    let _ = stats;

    diff.foreach(
        &mut |_delta, _| true,
        None,
        None,
        Some(&mut |delta, _hunk, line| {
            let path = delta
                .new_file()
                .path()
                .or_else(|| delta.old_file().path())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            if let Some(entry) = entries.iter_mut().rfind(|e| e.path == path) {
                match line.origin() {
                    '+' => entry.additions += 1,
                    '-' => entry.deletions += 1,
                    _ => {}
                }
            }
            true
        }),
    )
    .map_err(|e| e.message().to_string())?;

    Ok(entries)
}

pub fn diff_file(
    repo: &Repository,
    base_ref: &str,
    head_ref: &str,
    path: &str,
    ignore_whitespace: bool,
) -> Result<FileDiffInfo, String> {
    let base_tree = resolve_tree(repo, base_ref)?;
    let head_tree = resolve_tree(repo, head_ref)?;

    let mut opts = git2::DiffOptions::new();
    opts.pathspec(path);
    opts.ignore_whitespace(ignore_whitespace);
    let diff = repo
        .diff_tree_to_tree(Some(&base_tree), Some(&head_tree), Some(&mut opts))
        .map_err(|e| e.message().to_string())?;

    let hunks = std::cell::RefCell::new(Vec::<DiffHunkInfo>::new());
    let is_binary = std::cell::Cell::new(false);
    let status = std::cell::Cell::new(DiffStatus::Modified);

    diff.foreach(
        &mut |delta, _| {
            is_binary.set(delta.new_file().is_binary() || delta.old_file().is_binary());
            status.set(delta_to_status(delta.status()));
            true
        },
        Some(&mut |_, _| true),
        Some(&mut |_, hunk| {
            hunks.borrow_mut().push(DiffHunkInfo {
                header: String::from_utf8_lossy(hunk.header()).trim().to_string(),
                old_start: hunk.old_start(),
                old_lines: hunk.old_lines(),
                new_start: hunk.new_start(),
                new_lines: hunk.new_lines(),
                lines: Vec::new(),
            });
            true
        }),
        Some(&mut |_, _, line| {
            if let Some(current_hunk) = hunks.borrow_mut().last_mut() {
                current_hunk.lines.push(DiffLineInfo {
                    origin: line.origin(),
                    old_lineno: line.old_lineno(),
                    new_lineno: line.new_lineno(),
                    content: String::from_utf8_lossy(line.content()).to_string(),
                });
            }
            true
        }),
    )
    .map_err(|e| e.message().to_string())?;

    Ok(FileDiffInfo {
        path: path.to_string(),
        status: status.get(),
        is_binary: is_binary.get(),
        hunks: hunks.into_inner(),
    })
}

pub fn working_tree(repo_path: &str, subpath: Option<&str>) -> Result<Vec<TreeEntry>, String> {
    let base = std::path::Path::new(repo_path);
    let dir = match subpath {
        Some(p) if !p.is_empty() => base.join(p),
        _ => base.to_path_buf(),
    };

    let read_dir = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;

    let mut entries: Vec<TreeEntry> = read_dir
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                return None;
            }
            let file_type = entry.file_type().ok()?;
            let entry_type = if file_type.is_dir() {
                EntryType::Tree
            } else if file_type.is_file() {
                EntryType::Blob
            } else {
                return None;
            };
            let entry_path = match subpath {
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

pub fn working_file(repo_path: &str, path: &str) -> Result<FileContent, String> {
    let full_path = std::path::Path::new(repo_path).join(path);
    let metadata = std::fs::metadata(&full_path).map_err(|e| e.to_string())?;
    let size = metadata.len() as usize;
    let bytes = std::fs::read(&full_path).map_err(|e| e.to_string())?;
    let is_binary = bytes.contains(&0);
    let content = if is_binary {
        String::new()
    } else {
        String::from_utf8_lossy(&bytes).to_string()
    };

    Ok(FileContent {
        path: path.to_string(),
        content,
        size,
        is_binary,
    })
}

pub fn compare_with_working(
    repo: &Repository,
    base_ref: &str,
    ignore_whitespace: bool,
) -> Result<Vec<DiffFileEntry>, String> {
    let base_tree = resolve_tree(repo, base_ref)?;

    let mut opts = git2::DiffOptions::new();
    opts.ignore_whitespace(ignore_whitespace);
    let diff = repo
        .diff_tree_to_workdir_with_index(Some(&base_tree), Some(&mut opts))
        .map_err(|e| e.message().to_string())?;

    let mut entries: Vec<DiffFileEntry> = diff
        .deltas()
        .map(|delta| {
            let path = delta
                .new_file()
                .path()
                .or_else(|| delta.old_file().path())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            DiffFileEntry {
                path,
                status: delta_to_status(delta.status()),
                additions: 0,
                deletions: 0,
            }
        })
        .collect();

    diff.foreach(
        &mut |_delta, _| true,
        None,
        None,
        Some(&mut |delta, _hunk, line| {
            let path = delta
                .new_file()
                .path()
                .or_else(|| delta.old_file().path())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            if let Some(entry) = entries.iter_mut().rfind(|e| e.path == path) {
                match line.origin() {
                    '+' => entry.additions += 1,
                    '-' => entry.deletions += 1,
                    _ => {}
                }
            }
            true
        }),
    )
    .map_err(|e| e.message().to_string())?;

    Ok(entries)
}

pub fn diff_file_with_working(
    repo: &Repository,
    base_ref: &str,
    path: &str,
    ignore_whitespace: bool,
) -> Result<FileDiffInfo, String> {
    let base_tree = resolve_tree(repo, base_ref)?;

    let mut opts = git2::DiffOptions::new();
    opts.pathspec(path);
    opts.ignore_whitespace(ignore_whitespace);
    let diff = repo
        .diff_tree_to_workdir_with_index(Some(&base_tree), Some(&mut opts))
        .map_err(|e| e.message().to_string())?;

    let hunks = std::cell::RefCell::new(Vec::<DiffHunkInfo>::new());
    let is_binary = std::cell::Cell::new(false);
    let status = std::cell::Cell::new(DiffStatus::Modified);

    diff.foreach(
        &mut |delta, _| {
            is_binary.set(delta.new_file().is_binary() || delta.old_file().is_binary());
            status.set(delta_to_status(delta.status()));
            true
        },
        Some(&mut |_, _| true),
        Some(&mut |_, hunk| {
            hunks.borrow_mut().push(DiffHunkInfo {
                header: String::from_utf8_lossy(hunk.header()).trim().to_string(),
                old_start: hunk.old_start(),
                old_lines: hunk.old_lines(),
                new_start: hunk.new_start(),
                new_lines: hunk.new_lines(),
                lines: Vec::new(),
            });
            true
        }),
        Some(&mut |_, _, line| {
            if let Some(current_hunk) = hunks.borrow_mut().last_mut() {
                current_hunk.lines.push(DiffLineInfo {
                    origin: line.origin(),
                    old_lineno: line.old_lineno(),
                    new_lineno: line.new_lineno(),
                    content: String::from_utf8_lossy(line.content()).to_string(),
                });
            }
            true
        }),
    )
    .map_err(|e| e.message().to_string())?;

    Ok(FileDiffInfo {
        path: path.to_string(),
        status: status.get(),
        is_binary: is_binary.get(),
        hunks: hunks.into_inner(),
    })
}

pub struct CommitInfo {
    pub oid: String,
    pub short_id: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub author_time: i64,
    pub parent_ids: Vec<String>,
}

#[derive(Copy, Clone)]
pub enum DecorKind {
    LocalBranch,
    RemoteBranch,
    Tag,
    Head,
}

pub struct Decoration {
    pub oid: String,
    pub name: String,
    pub kind: DecorKind,
}

pub fn commit_log(
    repo: &Repository,
    git_ref: Option<&str>,
    skip: usize,
    limit: usize,
) -> Result<Vec<CommitInfo>, String> {
    let mut revwalk = repo.revwalk().map_err(|e| e.message().to_string())?;
    revwalk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
        .map_err(|e| e.message().to_string())?;

    match git_ref {
        Some(r) => {
            let oid = repo.revparse_single(r)
                .map_err(|e| e.message().to_string())?
                .id();
            revwalk.push(oid).map_err(|e| e.message().to_string())?;
        }
        None => {
            revwalk.push_head().map_err(|e| e.message().to_string())?;
        }
    }

    revwalk
        .skip(skip)
        .take(limit)
        .map(|oid_result| {
            let oid = oid_result.map_err(|e| e.message().to_string())?;
            let commit = repo.find_commit(oid).map_err(|e| e.message().to_string())?;
            Ok(CommitInfo {
                oid: oid.to_string(),
                short_id: oid.to_string()[..7].to_string(),
                message: commit.summary().unwrap_or("").to_string(),
                author_name: commit.author().name().unwrap_or("").to_string(),
                author_email: commit.author().email().unwrap_or("").to_string(),
                author_time: commit.author().when().seconds(),
                parent_ids: commit.parent_ids().map(|id| id.to_string()).collect(),
            })
        })
        .collect()
}

pub fn decorations(repo: &Repository) -> Result<Vec<Decoration>, String> {
    let mut result = Vec::new();

    let head_oid = repo.head().ok().and_then(|h| h.target());

    for reference in repo.references().map_err(|e| e.message().to_string())? {
        let reference = match reference {
            Ok(r) => r,
            Err(_) => continue,
        };
        let name = match reference.name() {
            Some(n) => n.to_string(),
            None => continue,
        };
        let oid = match reference.peel_to_commit() {
            Ok(c) => c.id().to_string(),
            Err(_) => continue,
        };

        let (kind, display_name) = if let Some(rest) = name.strip_prefix("refs/heads/") {
            (DecorKind::LocalBranch, rest.to_string())
        } else if let Some(rest) = name.strip_prefix("refs/remotes/") {
            (DecorKind::RemoteBranch, rest.to_string())
        } else if let Some(rest) = name.strip_prefix("refs/tags/") {
            (DecorKind::Tag, rest.to_string())
        } else {
            continue;
        };

        result.push(Decoration { oid: oid.clone(), name: display_name, kind });

        if let Some(head) = head_oid {
            if kind as u8 == DecorKind::LocalBranch as u8 && oid == head.to_string() {
                if let Ok(h) = repo.head() {
                    if h.shorthand().map(|s| s == result.last().unwrap().name).unwrap_or(false) {
                        result.push(Decoration { oid, name: "HEAD".to_string(), kind: DecorKind::Head });
                    }
                }
            }
        }
    }

    Ok(result)
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
