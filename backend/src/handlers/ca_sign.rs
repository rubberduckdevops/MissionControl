use axum::{extract::State, http::StatusCode, Json};
use bson::doc;
use chrono::Utc;
use jsonwebtoken::{Algorithm, Header};
use rcgen::{CertificateParams, DistinguishedName, DnType, KeyPair, SanType};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use x509_parser::prelude::*;

use crate::{
    errors::{AppError, AppResult},
    handlers::auth::{AppState, Claims},
    models::certificate::IssuedCert,
};

#[derive(Debug, Deserialize)]
pub struct TlsSignRequest {
    pub common_name: String,
    pub sans: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct TlsSignResponse {
    pub cert_pem: String,
    pub key_pem: String,
}

#[derive(Debug, Deserialize)]
pub struct SshSignRequest {
    pub public_key: String,
    pub principals: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct SshSignResponse {
    pub signed_cert: String,
}

#[derive(Serialize)]
struct ProvisionerClaims {
    iss: String,
    sub: String,
    aud: Vec<String>,
    iat: i64,
    nbf: i64,
    exp: i64,
    jti: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    sans: Option<Vec<String>>,
}

fn mint_ott(
    state: &AppState,
    sub: &str,
    audience: &str,
    sans: Option<Vec<String>>,
) -> AppResult<String> {
    let now = Utc::now().timestamp();
    let claims = ProvisionerClaims {
        iss: state.config.step_ca_provisioner_name.clone(),
        sub: sub.to_string(),
        aud: vec![audience.to_string()],
        iat: now,
        nbf: now,
        exp: now + 300, // 5 minutes
        jti: Uuid::new_v4().to_string(),
        sans,
    };

    let mut header = Header::new(Algorithm::ES256);
    header.kid = Some(state.config.step_ca_provisioner_name.clone());

    jsonwebtoken::encode(&header, &claims, &state.provisioner_key)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to mint provisioner token: {e}")))
}

pub async fn sign_tls_cert(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Json(payload): Json<TlsSignRequest>,
) -> AppResult<(StatusCode, Json<TlsSignResponse>)> {
    if payload.common_name.is_empty() {
        return Err(AppError::BadRequest("common_name is required".into()));
    }

    // Generate EC P-256 key pair and CSR
    let key_pair = KeyPair::generate()
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Key generation failed: {e}")))?;

    let mut san_types: Vec<SanType> = vec![];
    let mut all_names = vec![payload.common_name.clone()];
    all_names.extend(payload.sans.clone());
    for name in &all_names {
        san_types.push(
            SanType::DnsName(
                name.clone()
                    .try_into()
                    .map_err(|_| AppError::BadRequest(format!("Invalid DNS name: {name}")))?,
            ),
        );
    }

    let mut params = CertificateParams::default();
    params.distinguished_name = DistinguishedName::new();
    params.distinguished_name.push(DnType::CommonName, payload.common_name.as_str());
    params.subject_alt_names = san_types;

    let csr = params
        .serialize_request(&key_pair)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("CSR generation failed: {e}")))?;
    let csr_pem = csr
        .pem()
        .map_err(|e| AppError::Internal(anyhow::anyhow!("CSR PEM encoding failed: {e}")))?;
    let key_pem = key_pair.serialize_pem();

    // Mint provisioner OTT
    let sign_url = state
        .config
        .step_ca_url
        .join("/1.0/sign")
        .map_err(|e| AppError::Internal(anyhow::anyhow!("URL construction failed: {e}")))?;
    let ott = mint_ott(
        &state,
        &payload.common_name,
        sign_url.as_str(),
        Some(all_names.clone()),
    )?;

    // Send CSR to step-ca
    let body = serde_json::json!({ "csr": csr_pem, "ott": ott });
    let response = state
        .ca_client
        .post(sign_url.clone())
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("step-ca unreachable at {sign_url}: {e}");
            AppError::ServiceUnavailable("CA is unreachable".to_string())
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        tracing::error!("step-ca sign returned {status}: {text}");
        return Err(AppError::BadGateway(format!("CA signing failed: {text}")));
    }

    let signed: serde_json::Value = response.json().await.map_err(|e| {
        AppError::BadGateway(format!("Failed to parse CA sign response: {e}"))
    })?;

    let cert_pem = signed["crt"]
        .as_str()
        .ok_or_else(|| AppError::BadGateway("CA response missing 'crt' field".to_string()))?
        .to_string();

    // Parse cert to extract serial and expiry for storage
    let (serial, expires_at) = parse_cert_metadata(&cert_pem)?;

    // Store metadata (no PEM)
    let issued = IssuedCert::new(
        claims.sub,
        claims.email,
        payload.common_name,
        payload.sans,
        serial,
        expires_at,
    );
    state
        .db
        .collection::<IssuedCert>("issued_certificates")
        .insert_one(&issued, None)
        .await
        .map_err(AppError::Database)?;

    Ok((StatusCode::CREATED, Json(TlsSignResponse { cert_pem, key_pem })))
}

pub async fn sign_ssh_cert(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Json(payload): Json<SshSignRequest>,
) -> AppResult<Json<SshSignResponse>> {
    if payload.public_key.is_empty() {
        return Err(AppError::BadRequest("public_key is required".into()));
    }
    if payload.principals.is_empty() {
        return Err(AppError::BadRequest("at least one principal is required".into()));
    }

    let ssh_sign_url = state
        .config
        .step_ca_url
        .join("/1.0/ssh/sign")
        .map_err(|e| AppError::Internal(anyhow::anyhow!("URL construction failed: {e}")))?;
    let ott = mint_ott(&state, &claims.email, ssh_sign_url.as_str(), None)?;

    let body = serde_json::json!({
        "publicKey": payload.public_key,
        "ott": ott,
        "certType": "user",
        "keyID": claims.email,
        "principals": payload.principals,
    });

    let response = state
        .ca_client
        .post(ssh_sign_url.clone())
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("step-ca unreachable at {ssh_sign_url}: {e}");
            AppError::ServiceUnavailable("CA is unreachable".to_string())
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        tracing::error!("step-ca ssh/sign returned {status}: {text}");
        return Err(AppError::BadGateway(format!("CA SSH signing failed: {text}")));
    }

    let signed: serde_json::Value = response.json().await.map_err(|e| {
        AppError::BadGateway(format!("Failed to parse CA SSH sign response: {e}"))
    })?;

    let signed_cert = signed["crt"]
        .as_str()
        .ok_or_else(|| AppError::BadGateway("CA response missing 'crt' field".to_string()))?
        .to_string();

    Ok(Json(SshSignResponse { signed_cert }))
}

pub async fn list_issued_certs(
    State(state): State<AppState>,
) -> AppResult<Json<Vec<IssuedCert>>> {
    let collection = state.db.collection::<IssuedCert>("issued_certificates");
    let options = mongodb::options::FindOptions::builder()
        .sort(doc! { "issued_at": -1 })
        .build();
    let mut cursor = collection
        .find(doc! {}, options)
        .await
        .map_err(AppError::Database)?;

    let mut certs = Vec::new();
    while cursor.advance().await.map_err(AppError::Database)? {
        certs.push(cursor.deserialize_current().map_err(AppError::Database)?);
    }
    Ok(Json(certs))
}

fn parse_cert_metadata(cert_pem: &str) -> AppResult<(String, chrono::DateTime<Utc>)> {
    let pem_bytes = cert_pem.as_bytes();
    let (_, pem) = parse_x509_pem(pem_bytes)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to parse cert PEM: {e}")))?;
    let (_, cert) = X509Certificate::from_der(&pem.contents)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to parse cert DER: {e}")))?;

    let serial = cert
        .tbs_certificate
        .raw_serial()
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(":");

    let not_after_ts = cert.validity().not_after.timestamp();
    let expires_at = chrono::TimeZone::timestamp_opt(&Utc, not_after_ts, 0)
        .single()
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Invalid not_after timestamp in issued cert")))?;

    Ok((serial, expires_at))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_cert_metadata_invalid_pem() {
        let result = parse_cert_metadata("not a pem");
        assert!(result.is_err());
    }

    #[test]
    fn test_tls_sign_request_deserializes() {
        let json = r#"{"common_name":"example.com","sans":["www.example.com"]}"#;
        let req: TlsSignRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.common_name, "example.com");
        assert_eq!(req.sans, vec!["www.example.com"]);
    }

    #[test]
    fn test_ssh_sign_request_deserializes() {
        let json = r#"{"public_key":"ssh-ed25519 AAAA...","principals":["ec2-user","ubuntu"]}"#;
        let req: SshSignRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.principals, vec!["ec2-user", "ubuntu"]);
    }
}
