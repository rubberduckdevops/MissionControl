use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use bson::{doc, to_bson};
use chrono::Utc;
use mongodb::options::FindOptions;
use serde::{Deserialize, Deserializer};

use crate::{
    errors::{AppError, AppResult},
    handlers::auth::{AppState, Claims},
    models::cti::CtiSelection,
    models::task::{PaginatedTasksResponse, Task, TaskNote, TaskQuery},
};

/// Custom deserializer that wraps a present field (even if null) in `Some`.
/// Combined with `#[serde(default)]`, this lets us distinguish:
///   - absent field → outer `None` (no change)
///   - `null` → `Some(None)` (clear the field)
///   - value → `Some(Some(v))` (set the field)
fn optional_nullable<'de, D, T>(de: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Ok(Some(Option::<T>::deserialize(de)?))
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub description: String,
    pub assignee_id: Option<String>,
    pub cti: Option<CtiSelection>,
}

/// For update requests we use `Option<Option<T>>` so the client can:
///   - omit a field entirely (outer None) → no change
///   - send `null` (Some(None)) → clear the field
///   - send a value (Some(Some(v))) → set the field
#[derive(Debug, Deserialize)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    #[serde(default, deserialize_with = "optional_nullable")]
    pub assignee_id: Option<Option<String>>,
    #[serde(default, deserialize_with = "optional_nullable")]
    pub cti: Option<Option<CtiSelection>>,
}

#[derive(Debug, Deserialize)]
pub struct AddNoteRequest {
    pub note: String,
}

pub async fn list_tasks(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Query(params): Query<TaskQuery>,
) -> AppResult<Json<PaginatedTasksResponse>> {
    if params.limit == 0 || params.limit > 100 {
        return Err(AppError::BadRequest(
            "limit must be between 1 and 100".to_string(),
        ));
    }
    if params.page == 0 {
        return Err(AppError::BadRequest("page must be >= 1".to_string()));
    }

    let statuses = params.parsed_statuses().map_err(AppError::BadRequest)?;

    let filter = match statuses {
        None => doc! {},
        Some(list) => doc! { "status": { "$in": list } },
    };

    let collection = state.db.collection::<Task>("tasks");

    let total = collection
        .count_documents(filter.clone(), None)
        .await
        .map_err(AppError::Database)?;

    let skip = (params.page - 1) * params.limit;
    let options = FindOptions::builder()
        .skip(skip)
        .limit(params.limit as i64)
        .sort(doc! { "created_at": -1 })
        .build();

    let mut cursor = collection
        .find(filter, options)
        .await
        .map_err(AppError::Database)?;

    let mut tasks = Vec::new();
    while cursor.advance().await.map_err(AppError::Database)? {
        tasks.push(cursor.deserialize_current().map_err(AppError::Database)?);
    }

    let total_pages = if total == 0 {
        1
    } else {
        (total + params.limit - 1) / params.limit
    };

    Ok(Json(PaginatedTasksResponse {
        tasks,
        total,
        page: params.page,
        limit: params.limit,
        total_pages,
    }))
}

pub async fn create_task(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Json(payload): Json<CreateTaskRequest>,
) -> AppResult<(StatusCode, Json<Task>)> {
    let mut task = Task::new(payload.title, payload.description);
    task.assignee_id = payload.assignee_id;
    task.cti = payload.cti;

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
    // assignee_id: Some(None) → clear, Some(Some(v)) → set
    if let Some(assignee) = payload.assignee_id {
        match assignee {
            None => set_doc.insert("assignee_id", bson::Bson::Null),
            Some(v) => set_doc.insert("assignee_id", v),
        };
    }
    // cti: same pattern
    if let Some(cti) = payload.cti {
        match cti {
            None => set_doc.insert("cti", bson::Bson::Null),
            Some(v) => set_doc.insert(
                "cti",
                to_bson(&v).map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?,
            ),
        };
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

#[cfg(test)]
mod tests {
    use super::*;

    /// When `assignee_id` is omitted from the JSON payload, the outer Option is None
    /// (meaning "don't touch this field").
    #[test]
    fn update_request_omitted_assignee_is_none() {
        let json = r#"{"title":"New title"}"#;
        let req: UpdateTaskRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.title, Some("New title".to_string()));
        assert!(req.assignee_id.is_none(), "omitted field should be None");
        assert!(req.cti.is_none());
    }

    /// When `assignee_id` is explicitly set to `null`, the outer Option is Some(None)
    /// (meaning "clear this field").
    #[test]
    fn update_request_null_assignee_is_some_none() {
        let json = r#"{"assignee_id":null}"#;
        let req: UpdateTaskRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.assignee_id, Some(None));
    }

    /// When `assignee_id` is a string value, the outer Option is Some(Some(v)).
    #[test]
    fn update_request_set_assignee_is_some_some() {
        let json = r#"{"assignee_id":"user-42"}"#;
        let req: UpdateTaskRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.assignee_id, Some(Some("user-42".to_string())));
    }

    /// When `cti` is omitted, outer Option is None.
    #[test]
    fn update_request_omitted_cti_is_none() {
        let json = r#"{}"#;
        let req: UpdateTaskRequest = serde_json::from_str(json).unwrap();
        assert!(req.cti.is_none());
    }

    /// When `cti` is null, it becomes Some(None) (clear).
    #[test]
    fn update_request_null_cti_is_some_none() {
        let json = r#"{"cti":null}"#;
        let req: UpdateTaskRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.cti, Some(None));
    }

    /// When `cti` is a full object, it becomes Some(Some(CtiSelection)).
    #[test]
    fn update_request_set_cti_is_some_some() {
        let json = r#"{"cti":{"category_id":"c1","type_id":"t1","item_id":"i1"}}"#;
        let req: UpdateTaskRequest = serde_json::from_str(json).unwrap();
        let cti = req.cti.unwrap().unwrap();
        assert_eq!(cti.category_id, "c1");
        assert_eq!(cti.type_id, "t1");
        assert_eq!(cti.item_id, "i1");
    }

    /// CreateTaskRequest accepts optional assignee and cti.
    #[test]
    fn create_request_with_optional_fields() {
        let json = r#"{"title":"T","description":"D","assignee_id":"u1","cti":{"category_id":"c","type_id":"t","item_id":"i"}}"#;
        let req: CreateTaskRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.assignee_id, Some("u1".to_string()));
        let cti = req.cti.unwrap();
        assert_eq!(cti.item_id, "i");
    }

    #[test]
    fn create_request_without_optional_fields() {
        let json = r#"{"title":"T","description":"D"}"#;
        let req: CreateTaskRequest = serde_json::from_str(json).unwrap();
        assert!(req.assignee_id.is_none());
        assert!(req.cti.is_none());
    }
}
