mod git;
mod graphql;

use async_graphql::{EmptyMutation, EmptySubscription, Schema};
use graphql::{AppState, QueryRoot};
use std::sync::RwLock;

#[tauri::command]
fn graphql(
    query: String,
    variables: Option<String>,
    schema: tauri::State<'_, graphql::GitqSchema>,
) -> String {
    let request: async_graphql::Request = if let Some(vars) = variables {
        let vars: serde_json::Value = serde_json::from_str(&vars).unwrap_or_default();
        let gql_vars = async_graphql::Variables::from_json(vars);
        async_graphql::Request::new(&query).variables(gql_vars)
    } else {
        async_graphql::Request::new(&query)
    };

    let response = futures::executor::block_on(schema.execute(request));
    serde_json::to_string(&response).unwrap_or_default()
}

fn main() {
    let state = AppState {
        repo_path: RwLock::new(None),
    };

    let schema = Schema::build(QueryRoot, EmptyMutation, EmptySubscription)
        .data(state)
        .finish();

    tauri::Builder::default()
        .manage(schema)
        .invoke_handler(tauri::generate_handler![graphql])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
