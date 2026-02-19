use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use bson::{doc, to_bson};
use chrono::Utc;
use serde::Deserialize;

use crate::{
    errors::{AppError, AppResult},
    handlers::auth::{AppState, Claims},
    models::user::{User, UserPublic},
};

#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    pub email: Option<String>,
    pub username: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRoleRequest {
    pub role: String,
}

fn is_duplicate_key(e: &mongodb::error::Error) -> bool {
    match e.kind.as_ref() {
        mongodb::error::ErrorKind::Write(mongodb::error::WriteFailure::WriteError(we)) => {
            we.code == 11000
        }
        mongodb::error::ErrorKind::Command(ce) => ce.code == 11000,
        _ => false,
    }
}

pub async fn admin_list_users(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
) -> AppResult<Json<Vec<UserPublic>>> {
    let collection = state.db.collection::<User>("users");
    let mut cursor = collection
        .find(None, None)
        .await
        .map_err(AppError::Database)?;

    let mut users = Vec::new();
    while cursor.advance().await.map_err(AppError::Database)? {
        let user = cursor
            .deserialize_current()
            .map_err(AppError::Database)?;
        users.push(UserPublic::from(user));
    }
    Ok(Json(users))
}

pub async fn admin_update_user(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateUserRequest>,
) -> AppResult<Json<UserPublic>> {
    let mut set_doc = doc! { "updated_at": to_bson(&Utc::now()).unwrap() };

    if let Some(email) = payload.email {
        set_doc.insert("email", email);
    }
    if let Some(username) = payload.username {
        set_doc.insert("username", username);
    }

    let options = mongodb::options::FindOneAndUpdateOptions::builder()
        .return_document(mongodb::options::ReturnDocument::After)
        .build();

    let collection = state.db.collection::<User>("users");
    let user = collection
        .find_one_and_update(doc! { "_id": &id }, doc! { "$set": set_doc }, options)
        .await
        .map_err(|e| {
            if is_duplicate_key(&e) {
                AppError::Conflict("Email or username already taken".into())
            } else {
                AppError::Database(e)
            }
        })?
        .ok_or(AppError::NotFound)?;

    Ok(Json(user.into()))
}

pub async fn admin_update_role(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateRoleRequest>,
) -> AppResult<Json<UserPublic>> {
    if claims.sub == id {
        return Err(AppError::BadRequest(
            "Cannot change your own role".into(),
        ));
    }

    if payload.role != "user" && payload.role != "admin" {
        return Err(AppError::BadRequest(
            "Role must be 'user' or 'admin'".into(),
        ));
    }

    let options = mongodb::options::FindOneAndUpdateOptions::builder()
        .return_document(mongodb::options::ReturnDocument::After)
        .build();

    let collection = state.db.collection::<User>("users");
    let user = collection
        .find_one_and_update(
            doc! { "_id": &id },
            doc! { "$set": { "role": &payload.role, "updated_at": to_bson(&Utc::now()).unwrap() } },
            options,
        )
        .await
        .map_err(AppError::Database)?
        .ok_or(AppError::NotFound)?;

    Ok(Json(user.into()))
}

pub async fn admin_delete_user(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<StatusCode> {
    if claims.sub == id {
        return Err(AppError::BadRequest(
            "Cannot delete your own account".into(),
        ));
    }

    let collection = state.db.collection::<User>("users");
    let result = collection
        .delete_one(doc! { "_id": &id }, None)
        .await
        .map_err(AppError::Database)?;

    if result.deleted_count == 0 {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}
