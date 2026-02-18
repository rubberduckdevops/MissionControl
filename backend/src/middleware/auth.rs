use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation};

use crate::{
    errors::AppError,
    handlers::auth::{AppState, Claims},
};

pub async fn require_auth(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let auth_header = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(AppError::Unauthorized)?;

    let token_data = decode::<Claims>(
        auth_header,
        &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| AppError::Unauthorized)?;

    req.extensions_mut().insert(token_data.claims);
    Ok(next.run(req).await)
}
