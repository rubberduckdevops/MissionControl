use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, errors::ErrorKind};

use crate::{
    errors::AppError,
    handlers::auth::{AppState, Claims},
    keycloak::{build_validation, fetch_decoding_key, map_role, KeycloakClaims},
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

    let decode_result = {
        let key = state.keycloak_decoding_key.read().await;
        decode::<KeycloakClaims>(auth_header, &*key, &validation)
    };

    let token_data = match decode_result {
        Ok(data) => data,
        Err(e) if matches!(e.kind(), ErrorKind::InvalidSignature) => {
            // Signature mismatch may mean Keycloak rotated its signing key — refresh and retry once
            tracing::warn!("JWT signature invalid; refreshing Keycloak JWKS and retrying");
            let new_key = fetch_decoding_key(&state.config)
                .await
                .map_err(|_| AppError::Unauthorized)?;
            let mut write = state.keycloak_decoding_key.write().await;
            *write = new_key;
            drop(write);
            let key = state.keycloak_decoding_key.read().await;
            decode::<KeycloakClaims>(auth_header, &*key, &validation)
                .map_err(|_| AppError::Unauthorized)?
        }
        Err(_) => return Err(AppError::Unauthorized),
    };

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
