use axum::{extract::State, Json};
use bson::doc;
use serde_json::{json, Value};

use crate::{
    errors::AppResult,
    handlers::auth::{AppState, Claims},
};

pub async fn get_dashboard(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
) -> AppResult<Json<Value>> {
    let users = state.db.collection::<bson::Document>("users");
    let total_users = users.count_documents(doc! {}).await?;

    let tasks = state.db.collection::<bson::Document>("tasks");
    let todo = tasks.count_documents(doc! { "status": "todo" }).await?;
    let in_progress = tasks.count_documents(doc! { "status": "in_progress" }).await?;
    let done = tasks.count_documents(doc! { "status": "done" }).await?;

    Ok(Json(json!({
        "message": format!("Welcome, {}!", claims.email),
        "user_id": claims.sub,
        "stats": {
            "total_users": total_users,
            "tasks": {
                "todo": todo,
                "in_progress": in_progress,
                "done": done,
            }
        }
    })))
}
