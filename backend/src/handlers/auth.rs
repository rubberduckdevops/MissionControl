use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{extract::State, Json};
use bson::doc;
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use mongodb::Database;
use serde::{Deserialize, Serialize};

use crate::{
    config::AppConfig,
    errors::{AppError, AppResult},
    models::user::{User, UserPublic},
};

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String, // user id (UUID string)
    pub email: String,
    pub role: String,
    pub exp: usize,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserPublic,
}

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub config: AppConfig,
}

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> AppResult<Json<AuthResponse>> {
    let argon2 = Argon2::default();
    let salt = SaltString::generate(&mut OsRng);
    let password_hash = argon2
        .hash_password(payload.password.as_bytes(), &salt)
        .map_err(|e| AppError::BadRequest(format!("Password hashing failed: {e}")))?
        .to_string();

    let user = User::new(payload.email, payload.username, password_hash);
    let collection = state.db.collection::<User>("users");

    collection.insert_one(&user, None).await.map_err(|e| {
        if is_duplicate_key(&e) {
            AppError::Conflict("Email or username already taken".into())
        } else {
            AppError::Database(e)
        }
    })?;

    let token = mint_token(&user, &state.config.jwt_secret)?;
    Ok(Json(AuthResponse {
        token,
        user: user.into(),
    }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> AppResult<Json<AuthResponse>> {
    let collection = state.db.collection::<User>("users");
    let user = collection
        .find_one(doc! { "email": &payload.email }, None)
        .await?
        .ok_or(AppError::Unauthorized)?;

    let parsed_hash = PasswordHash::new(&user.password_hash).map_err(|_| AppError::Unauthorized)?;
    Argon2::default()
        .verify_password(payload.password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::Unauthorized)?;

    let token = mint_token(&user, &state.config.jwt_secret)?;
    Ok(Json(AuthResponse {
        token,
        user: user.into(),
    }))
}

pub async fn me(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
) -> AppResult<Json<UserPublic>> {
    let collection = state.db.collection::<User>("users");
    let user = collection
        .find_one(doc! { "_id": &claims.sub }, None)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(user.into()))
}

fn mint_token(user: &User, secret: &str) -> AppResult<String> {
    let exp = (Utc::now() + Duration::hours(24)).timestamp() as usize;
    let claims = Claims {
        sub: user.id.clone(),
        email: user.email.clone(),
        role: user.role.clone(),
        exp,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(anyhow::anyhow!("JWT encode error: {e}")))
}

fn is_duplicate_key(e: &mongodb::error::Error) -> bool {
    matches!(
        e.kind.as_ref(),
        mongodb::error::ErrorKind::Write(mongodb::error::WriteFailure::WriteError(we))
            if we.code == 11000
    )
}
