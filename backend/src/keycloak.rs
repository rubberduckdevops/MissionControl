use anyhow::{anyhow, Result};
use jsonwebtoken::{Algorithm, DecodingKey, Validation};
use serde::Deserialize;

use crate::config::AppConfig;

#[derive(Debug, Deserialize, Clone)]
pub struct RealmAccess {
    pub roles: Vec<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct KeycloakClaims {
    pub sub: String,
    pub email: String,
    pub preferred_username: String,
    pub realm_access: RealmAccess,
    pub exp: usize,
}

pub fn map_role(roles: &[String]) -> String {
    if roles.iter().any(|r| r == "admin") {
        "admin".to_string()
    } else {
        "user".to_string()
    }
}

pub fn build_validation(config: &AppConfig) -> Validation {
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_audience(&[&config.keycloak_client_id]);
    validation
}

#[derive(Deserialize)]
struct JwksResponse {
    keys: Vec<JwkKey>,
}

#[derive(Deserialize)]
struct JwkKey {
    #[serde(rename = "use")]
    use_: Option<String>,
    kty: String,
    n: String,
    e: String,
}

pub async fn fetch_decoding_key(config: &AppConfig) -> Result<DecodingKey> {
    let url = format!(
        "{}/realms/{}/protocol/openid-connect/certs",
        config.keycloak_url, config.keycloak_realm
    );

    let jwks: JwksResponse = reqwest::get(&url)
        .await
        .map_err(|e| anyhow!("Failed to fetch JWKS from Keycloak: {e}"))?
        .json()
        .await
        .map_err(|e| anyhow!("Failed to parse JWKS response: {e}"))?;

    let key = jwks
        .keys
        .into_iter()
        .find(|k| k.kty == "RSA" && k.use_.as_deref() == Some("sig"))
        .ok_or_else(|| anyhow!("No RSA signing key found in Keycloak JWKS"))?;

    DecodingKey::from_rsa_components(&key.n, &key.e)
        .map_err(|e| anyhow!("Failed to build RSA decoding key: {e}"))
}
