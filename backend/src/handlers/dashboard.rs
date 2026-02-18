use axum::{extract::State, Json};
use serde_json::{json, Value};

use crate::{
    errors::AppResult,
    handlers::auth::{AppState, Claims},
};

pub async fn get_dashboard(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
) -> AppResult<Json<Value>> {
    let collection = state.db.collection::<bson::Document>("users");
    let total_users = collection.count_documents(None, None).await?;

    Ok(Json(json!({
        "message": format!("Welcome, {}!", claims.email),
        "user_id": claims.sub,
        "stats": {
            "total_users": total_users,
        }
    })))
}
