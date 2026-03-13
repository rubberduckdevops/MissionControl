use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Feed {
    #[serde(rename = "_id")]
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub url: String,
    pub created_at: DateTime<Utc>,
}

impl Feed {
    pub fn new(user_id: String, name: String, url: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            user_id,
            name,
            url,
            created_at: Utc::now(),
        }
    }
}
