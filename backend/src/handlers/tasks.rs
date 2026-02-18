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
    models::task::{Task, TaskNote},
};

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub description: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddNoteRequest {
    pub note: String,
}

pub async fn list_tasks(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
) -> AppResult<Json<Vec<Task>>> {
    let collection = state.db.collection::<Task>("tasks");
    let mut cursor = collection
        .find(None, None)
        .await
        .map_err(AppError::Database)?;

    let mut tasks = Vec::new();
    while cursor.advance().await.map_err(AppError::Database)? {
        tasks.push(cursor.deserialize_current().map_err(AppError::Database)?);
    }
    Ok(Json(tasks))
}

pub async fn create_task(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Json(payload): Json<CreateTaskRequest>,
) -> AppResult<(StatusCode, Json<Task>)> {
    let task = Task::new(payload.title, payload.description);
    let collection = state.db.collection::<Task>("tasks");
    collection
        .insert_one(&task, None)
        .await
        .map_err(AppError::Database)?;
    Ok((StatusCode::CREATED, Json(task)))
}

pub async fn get_task(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Task>> {
    let collection = state.db.collection::<Task>("tasks");
    let task = collection
        .find_one(doc! { "_id": &id }, None)
        .await
        .map_err(AppError::Database)?
        .ok_or(AppError::NotFound)?;
    Ok(Json(task))
}

pub async fn update_task(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateTaskRequest>,
) -> AppResult<Json<Task>> {
    let collection = state.db.collection::<Task>("tasks");

    let mut set_doc = doc! { "updated_at": to_bson(&Utc::now()).unwrap() };
    if let Some(title) = payload.title {
        set_doc.insert("title", title);
    }
    if let Some(description) = payload.description {
        set_doc.insert("description", description);
    }
    if let Some(status) = payload.status {
        set_doc.insert("status", status);
    }

    let options = mongodb::options::FindOneAndUpdateOptions::builder()
        .return_document(mongodb::options::ReturnDocument::After)
        .build();

    let task = collection
        .find_one_and_update(doc! { "_id": &id }, doc! { "$set": set_doc }, options)
        .await
        .map_err(AppError::Database)?
        .ok_or(AppError::NotFound)?;

    Ok(Json(task))
}

pub async fn delete_task(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<StatusCode> {
    let collection = state.db.collection::<Task>("tasks");
    let result = collection
        .delete_one(doc! { "_id": &id }, None)
        .await
        .map_err(AppError::Database)?;

    if result.deleted_count == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn add_note(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<AddNoteRequest>,
) -> AppResult<Json<Task>> {
    let note = TaskNote::new(payload.note, claims.sub);
    let note_bson = to_bson(&note).map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    let collection = state.db.collection::<Task>("tasks");
    let options = mongodb::options::FindOneAndUpdateOptions::builder()
        .return_document(mongodb::options::ReturnDocument::After)
        .build();

    let task = collection
        .find_one_and_update(
            doc! { "_id": &id },
            doc! { "$push": { "notes": note_bson }, "$set": { "updated_at": to_bson(&Utc::now()).unwrap() } },
            options,
        )
        .await
        .map_err(AppError::Database)?
        .ok_or(AppError::NotFound)?;

    Ok(Json(task))
}

pub async fn delete_note(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Path((task_id, note_id)): Path<(String, String)>,
) -> AppResult<Json<Task>> {
    let collection = state.db.collection::<Task>("tasks");
    let options = mongodb::options::FindOneAndUpdateOptions::builder()
        .return_document(mongodb::options::ReturnDocument::After)
        .build();

    let task = collection
        .find_one_and_update(
            doc! { "_id": &task_id },
            doc! {
                "$pull": { "notes": { "_id": &note_id } },
                "$set": { "updated_at": to_bson(&Utc::now()).unwrap() }
            },
            options,
        )
        .await
        .map_err(AppError::Database)?
        .ok_or(AppError::NotFound)?;

    Ok(Json(task))
}
