use chrono::{DateTime, Utc};
use serde::{Deserialize, Deserializer, Serialize};
use uuid::Uuid;

fn null_as_empty<'de, D, T>(de: D) -> Result<Vec<T>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Ok(Option::<Vec<T>>::deserialize(de)?.unwrap_or_default())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    #[serde(rename = "_id")]
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    #[serde(deserialize_with = "null_as_empty")]
    pub notes: Vec<TaskNote>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Task {
    pub fn new(title: String, description: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            title,
            description,
            status: "todo".to_string(),
            notes: vec![],
            created_at: now,
            updated_at: now,
        }
    }
}



#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskNote {
    #[serde(rename = "_id")]
    pub id: String, 
    pub note: String,
    pub author: String, // this is the ID of the User
    pub created_at: DateTime<Utc>
}

impl TaskNote {
    pub fn new(note: String, author: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            note,
            author,
            created_at: now,
        }
    }
}