use axum::{extract::State, Json};
use chrono::{TimeZone, Utc};
use serde::Serialize;
use x509_parser::prelude::*;

use crate::{
    errors::{AppError, AppResult},
    handlers::auth::AppState,
};

#[derive(Serialize)]
pub struct CertStatusResponse {
    pub subject: String,
    pub issuer: String,
    pub serial: String,
    pub not_before: String,
    pub not_after: String,
    pub days_remaining: i64,
    pub status: String,
}

const ALLOWED_CA_PATHS: &[&str] = &["/health", "/roots", "/1.0/crl", "/1.0/provisioners"];

async fn proxy_ca(state: &AppState, path: &str) -> AppResult<Json<serde_json::Value>> {
    if !ALLOWED_CA_PATHS.contains(&path) {
        return Err(AppError::BadRequest(format!("CA path not permitted: {path}")));
    }
    let url = state.config.step_ca_url.join(path).map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to construct CA URL: {e}"))
    })?;

    let response = state
        .ca_client
        .get(&url)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("CA unreachable at {url}: {e}");
            AppError::ServiceUnavailable("CA is unreachable".to_string())
        })?;

    if !response.status().is_success() {
        tracing::error!("CA returned unexpected status {} for {url}", response.status());
        return Err(AppError::BadGateway(
            "CA returned an unexpected response".to_string(),
        ));
    }

    let body = response.json::<serde_json::Value>().await.map_err(|e| {
        tracing::error!("CA response parse error for {url}: {e}");
        AppError::BadGateway("CA returned invalid JSON".to_string())
    })?;

    Ok(Json(body))
}

pub async fn ca_health(State(state): State<AppState>) -> AppResult<Json<serde_json::Value>> {
    proxy_ca(&state, "/health").await
}

pub async fn ca_roots(State(state): State<AppState>) -> AppResult<Json<serde_json::Value>> {
    proxy_ca(&state, "/roots").await
}

pub async fn ca_crl(State(state): State<AppState>) -> AppResult<Json<serde_json::Value>> {
    proxy_ca(&state, "/1.0/crl").await
}

pub async fn ca_provisioners(
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    proxy_ca(&state, "/1.0/provisioners").await
}

pub async fn ca_cert_status(
    State(state): State<AppState>,
) -> AppResult<Json<CertStatusResponse>> {
    let (_, cert) = X509Certificate::from_der(&state.intermediate_cert_der).map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to parse intermediate cert: {e}"))
    })?;

    let not_before_ts = cert.validity().not_before.timestamp();
    let not_after_ts = cert.validity().not_after.timestamp();
    let now_ts = Utc::now().timestamp();
    let days_remaining = not_after_ts
        .checked_sub(now_ts)
        .map(|diff| diff / 86400)
        .unwrap_or(i64::MIN);

    let status = if days_remaining < 0 {
        "expired"
    } else if days_remaining <= 30 {
        "expiring_soon"
    } else {
        "ok"
    };

    let serial = cert
        .tbs_certificate
        .raw_serial()
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(":");

    let not_before = Utc
        .timestamp_opt(not_before_ts, 0)
        .single()
        .map(|dt| dt.to_rfc3339())
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Invalid not_before timestamp in cert")))?;

    let not_after = Utc
        .timestamp_opt(not_after_ts, 0)
        .single()
        .map(|dt| dt.to_rfc3339())
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Invalid not_after timestamp in cert")))?;

    Ok(Json(CertStatusResponse {
        subject: cert.subject().to_string(),
        issuer: cert.issuer().to_string(),
        serial,
        not_before,
        not_after,
        days_remaining,
        status: status.to_string(),
    }))
}
