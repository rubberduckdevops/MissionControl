use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use bson::doc;
use serde::Deserialize;

use crate::{
    errors::{AppError, AppResult},
    handlers::auth::{AppState, Claims},
    models::cti::{Category, CtiItem, CtiType},
};

// ── Query param structs ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CategoryIdFilter {
    pub category_id: String,
}

#[derive(Debug, Deserialize)]
pub struct TypeIdFilter {
    pub type_id: String,
}

// ── Request body structs ────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateCategoryRequest {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTypeRequest {
    pub name: String,
    pub category_id: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateItemRequest {
    pub name: String,
    pub type_id: String,
}

// ── Category handlers ────────────────────────────────────────────────────────

pub async fn list_categories(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
) -> AppResult<Json<Vec<Category>>> {
    let col = state.db.collection::<Category>("cti_categories");
    let mut cursor = col.find(None, None).await.map_err(AppError::Database)?;

    let mut items = Vec::new();
    while cursor.advance().await.map_err(AppError::Database)? {
        items.push(cursor.deserialize_current().map_err(AppError::Database)?);
    }
    Ok(Json(items))
}

pub async fn create_category(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Json(payload): Json<CreateCategoryRequest>,
) -> AppResult<(StatusCode, Json<Category>)> {
    let category = Category::new(payload.name);
    let col = state.db.collection::<Category>("cti_categories");
    col.insert_one(&category, None)
        .await
        .map_err(AppError::Database)?;
    Ok((StatusCode::CREATED, Json(category)))
}

pub async fn delete_category(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<StatusCode> {
    let col = state.db.collection::<Category>("cti_categories");
    let result = col
        .delete_one(doc! { "_id": &id }, None)
        .await
        .map_err(AppError::Database)?;
    if result.deleted_count == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

// ── Type handlers ────────────────────────────────────────────────────────────

pub async fn list_types(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Query(filter): Query<CategoryIdFilter>,
) -> AppResult<Json<Vec<CtiType>>> {
    let col = state.db.collection::<CtiType>("cti_types");
    let mut cursor = col
        .find(doc! { "category_id": &filter.category_id }, None)
        .await
        .map_err(AppError::Database)?;

    let mut items = Vec::new();
    while cursor.advance().await.map_err(AppError::Database)? {
        items.push(cursor.deserialize_current().map_err(AppError::Database)?);
    }
    Ok(Json(items))
}

pub async fn create_type(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Json(payload): Json<CreateTypeRequest>,
) -> AppResult<(StatusCode, Json<CtiType>)> {
    let cti_type = CtiType::new(payload.name, payload.category_id);
    let col = state.db.collection::<CtiType>("cti_types");
    col.insert_one(&cti_type, None)
        .await
        .map_err(AppError::Database)?;
    Ok((StatusCode::CREATED, Json(cti_type)))
}

pub async fn delete_type(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<StatusCode> {
    let col = state.db.collection::<CtiType>("cti_types");
    let result = col
        .delete_one(doc! { "_id": &id }, None)
        .await
        .map_err(AppError::Database)?;
    if result.deleted_count == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

// ── Item handlers ────────────────────────────────────────────────────────────

pub async fn list_items(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Query(filter): Query<TypeIdFilter>,
) -> AppResult<Json<Vec<CtiItem>>> {
    let col = state.db.collection::<CtiItem>("cti_items");
    let mut cursor = col
        .find(doc! { "type_id": &filter.type_id }, None)
        .await
        .map_err(AppError::Database)?;

    let mut items = Vec::new();
    while cursor.advance().await.map_err(AppError::Database)? {
        items.push(cursor.deserialize_current().map_err(AppError::Database)?);
    }
    Ok(Json(items))
}

pub async fn create_item(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Json(payload): Json<CreateItemRequest>,
) -> AppResult<(StatusCode, Json<CtiItem>)> {
    let item = CtiItem::new(payload.name, payload.type_id);
    let col = state.db.collection::<CtiItem>("cti_items");
    col.insert_one(&item, None)
        .await
        .map_err(AppError::Database)?;
    Ok((StatusCode::CREATED, Json(item)))
}

pub async fn delete_item(
    axum::Extension(_claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<StatusCode> {
    let col = state.db.collection::<CtiItem>("cti_items");
    let result = col
        .delete_one(doc! { "_id": &id }, None)
        .await
        .map_err(AppError::Database)?;
    if result.deleted_count == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}
