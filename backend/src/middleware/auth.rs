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
    let auth_header = match req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
    {
        Some(header) => {
            tracing::debug!("Authorization header found, token length: {}", header.len());
            header
        }
        None => {
            tracing::warn!("No Authorization header or Bearer token found");
            return Err(AppError::Unauthorized);
        }
    };

    let validation = build_validation(&state.config);
    tracing::debug!("JWT validation config - audience: {:?}, issuer: {:?}", &state.config.keycloak_client_id, format!("{}/realms/{}", &state.config.keycloak_url, &state.config.keycloak_realm));

    let decode_result = {
        let key = state.keycloak_decoding_key.read().await;
        decode::<KeycloakClaims>(auth_header, &*key, &validation)
    };

    let token_data = match decode_result {
        Ok(data) => {
            tracing::debug!("JWT validation successful");
            data
        }
        Err(e) if matches!(e.kind(), ErrorKind::InvalidSignature) => {
            tracing::warn!("JWT signature invalid; refreshing Keycloak JWKS and retrying: {}", e);
            let new_key = fetch_decoding_key(&state.config)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to refresh Keycloak JWKS: {}", e);
                    AppError::Unauthorized
                })?;
            let mut write = state.keycloak_decoding_key.write().await;
            *write = new_key;
            drop(write);
            let key = state.keycloak_decoding_key.read().await;
            decode::<KeycloakClaims>(auth_header, &*key, &validation)
                .map_err(|e| {
                    tracing::error!("JWT validation failed after key refresh: {}", e);
                    AppError::Unauthorized
                })?
        }
        Err(e) => {
            tracing::warn!("JWT validation failed: {} (expected audience: {})", e, &state.config.keycloak_client_id);
            return Err(AppError::Unauthorized);
        }
    };

    // Temporary debug: decode as raw Value to see all claims
    if let Ok(raw_td) = {
        let key = state.keycloak_decoding_key.read().await;
        decode::<serde_json::Value>(auth_header, &*key, &build_validation(&state.config))
    } {
        tracing::debug!("Raw JWT claims: {}", raw_td.claims);
    }

    let kc = token_data.claims;
    tracing::debug!("Decoded token claims: sub={:?}, email={:?}, preferred_username={:?}, realm_access={:?}", kc.sub, kc.email, kc.preferred_username, kc.realm_access.as_ref().map(|r| &r.roles));

    let sub = kc.sub.ok_or_else(|| {
        tracing::error!("Token missing 'sub' claim");
        AppError::Unauthorized
    })?;
    let email = kc.email.ok_or_else(|| {
        tracing::error!("Token missing 'email' claim");
        AppError::Unauthorized
    })?;
    let username = kc.preferred_username.ok_or_else(|| {
        tracing::error!("Token missing 'preferred_username' claim");
        AppError::Unauthorized
    })?;
    let realm_access = kc.realm_access.ok_or_else(|| {
        tracing::error!("Token missing 'realm_access' claim");
        AppError::Unauthorized
    })?;
    
    let claims = Claims {
        sub,
        email,
        username,
        role: map_role(&realm_access.roles),
        exp: kc.exp,
    };

    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}
