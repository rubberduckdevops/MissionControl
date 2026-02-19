use axum::{extract::State, Json};

use crate::{
    errors::AppResult,
    handlers::auth::{AppState, Claims},
    models::user::{User, UserPublic},
};

pub async fn list_users(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
) -> AppResult<Json<Vec<UserPublic>>> {
    let collection = state.db.collection::<User>("users");
    let mut cursor = collection
        .find(None, None)
        .await
        .map_err(crate::errors::AppError::Database)?;

    let mut users = Vec::new();
    while cursor.advance().await.map_err(crate::errors::AppError::Database)? {
        let user = cursor
            .deserialize_current()
            .map_err(crate::errors::AppError::Database)?;
        users.push(UserPublic::from(user));
    }
    Ok(Json(users))
}
