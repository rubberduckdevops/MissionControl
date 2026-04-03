use axum::{extract::State, Json};
use bson::{doc, to_bson};
use chrono::Utc;
use jsonwebtoken::DecodingKey;
use mongodb::{
    options::{FindOneAndUpdateOptions, ReturnDocument},
    Database,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::{
    config::AppConfig,
    errors::{AppError, AppResult},
    models::user::{User, UserPublic},
    nws_client::NwsClient,
};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub username: String,
    pub role: String,
    pub exp: usize,
}

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub config: AppConfig,
    pub nws_client: Arc<NwsClient>,
    pub ca_client: reqwest::Client,
    pub intermediate_cert_der: Arc<Vec<u8>>,
    pub keycloak_decoding_key: Arc<RwLock<DecodingKey>>,
}

pub async fn me(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
) -> AppResult<Json<UserPublic>> {
    let now = Utc::now();
    let collection = state.db.collection::<User>("users");
    let filter = doc! { "_id": &claims.sub };
    let update = doc! {
        "$set": {
            "email": &claims.email,
            "username": &claims.username,
            "updated_at": to_bson(&now).unwrap(),
        },
        "$setOnInsert": {
            "role": &claims.role,
            "created_at": to_bson(&now).unwrap(),
        }
    };
    let options = FindOneAndUpdateOptions::builder()
        .upsert(true)
        .return_document(ReturnDocument::After)
        .build();
    let user = collection
        .find_one_and_update(filter, update, options)
        .await?
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Upsert returned no document")))?;
    let mut user_public: UserPublic = user.into();
    user_public.role = claims.role;
    Ok(Json(user_public))
}
