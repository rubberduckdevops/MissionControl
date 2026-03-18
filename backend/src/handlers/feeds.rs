use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use bson::doc;
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::{
    errors::{AppError, AppResult},
    handlers::auth::{AppState, Claims},
    models::feed::Feed,
};

#[derive(Debug, Deserialize)]
pub struct AddFeedRequest {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Serialize)]
pub struct FeedItem {
    pub title: String,
    pub link: String,
    pub summary: String,
    pub published: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FeedItemsResponse {
    pub items: Vec<FeedItem>,
}

pub async fn list_feeds(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
) -> AppResult<Json<Vec<Feed>>> {
    let collection = state.db.collection::<Feed>("feeds");
    let mut cursor = collection
        .find(doc! { "user_id": &claims.sub })
        .await
        .map_err(AppError::Database)?;

    let mut feeds = Vec::new();
    while cursor.advance().await.map_err(AppError::Database)? {
        feeds.push(cursor.deserialize_current().map_err(AppError::Database)?);
    }
    Ok(Json(feeds))
}

pub async fn add_feed(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Json(payload): Json<AddFeedRequest>,
) -> AppResult<(StatusCode, Json<Feed>)> {
    let feed = Feed::new(claims.sub, payload.name, payload.url);
    let collection = state.db.collection::<Feed>("feeds");
    collection
        .insert_one(&feed)
        .await
        .map_err(AppError::Database)?;
    Ok((StatusCode::CREATED, Json(feed)))
}

pub async fn delete_feed(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<StatusCode> {
    let collection = state.db.collection::<Feed>("feeds");
    let result = collection
        .delete_one(doc! { "_id": &id, "user_id": &claims.sub })
        .await
        .map_err(AppError::Database)?;

    if result.deleted_count == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_feed_items(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<FeedItemsResponse>> {
    let collection = state.db.collection::<Feed>("feeds");
    let feed = collection
        .find_one(doc! { "_id": &id, "user_id": &claims.sub })
        .await
        .map_err(AppError::Database)?
        .ok_or(AppError::NotFound)?;

    let response = reqwest::get(&feed.url)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to fetch feed: {e}")))?;

    let bytes = response
        .bytes()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read feed response: {e}")))?;

    let parsed = feed_rs::parser::parse(bytes.as_ref())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to parse feed: {e}")))?;

    let items = parsed
        .entries
        .into_iter()
        .map(|entry| {
            let title = entry.title.map(|t| t.content).unwrap_or_default();
            let link = entry.links.into_iter().next().map(|l| l.href).unwrap_or_default();
            let summary = entry.summary.map(|s| s.content).unwrap_or_default();
            let published = entry.published.map(|dt| dt.with_timezone(&Utc).to_rfc3339());
            FeedItem { title, link, summary, published }
        })
        .collect();

    Ok(Json(FeedItemsResponse { items }))
}
