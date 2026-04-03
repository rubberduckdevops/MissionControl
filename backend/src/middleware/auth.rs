use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::decode;

use crate::{
    errors::AppError,
    handlers::auth::{AppState, Claims},
    keycloak::{build_validation, map_role, KeycloakClaims},
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

    let validation = build_validation(&state.config);
    let token_data = decode::<KeycloakClaims>(
        auth_header,
        &state.keycloak_decoding_key,
        &validation,
    )
    .map_err(|_| AppError::Unauthorized)?;

    let kc = token_data.claims;
    let claims = Claims {
        sub: kc.sub,
        email: kc.email,
        username: kc.preferred_username,
        role: map_role(&kc.realm_access.roles),
        exp: kc.exp,
    };

    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}
