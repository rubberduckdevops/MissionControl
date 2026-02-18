use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    #[serde(rename = "_id")]
    pub id: String,
    pub email: String,
    pub username: String,
    pub password_hash: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl User {
    pub fn new(email: String, username: String, password_hash: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            email,
            username,
            password_hash,
            role: "user".to_string(),
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct UserPublic {
    pub id: String,
    pub email: String,
    pub username: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
}

impl From<User> for UserPublic {
    fn from(u: User) -> Self {
        Self {
            id: u.id,
            email: u.email,
            username: u.username,
            role: u.role,
            created_at: u.created_at,
        }
    }
}

