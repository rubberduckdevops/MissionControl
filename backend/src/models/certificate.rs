use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssuedCert {
    #[serde(rename = "_id")]
    pub id: String,
    pub requested_by: String,
    pub requested_by_email: String,
    pub common_name: String,
    pub sans: Vec<String>,
    pub serial: String,
    pub expires_at: DateTime<Utc>,
    pub issued_at: DateTime<Utc>,
}

impl IssuedCert {
    pub fn new(
        requested_by: String,
        requested_by_email: String,
        common_name: String,
        sans: Vec<String>,
        serial: String,
        expires_at: DateTime<Utc>,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            requested_by,
            requested_by_email,
            common_name,
            sans,
            serial,
            expires_at,
            issued_at: Utc::now(),
        }
    }
}
