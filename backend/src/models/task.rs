use chrono::{DateTime, Utc};
use serde::{Deserialize, Deserializer, Serialize};
use uuid::Uuid;

use crate::models::cti::CtiSelection;

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
    pub assignee_id: Option<String>,
    pub cti: Option<CtiSelection>,
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
            assignee_id: None,
            cti: None,
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

fn default_page() -> u64 { 1 }
fn default_limit() -> u64 { 25 }

/// Query parameters for GET /api/tasks
/// Example: ?page=2&limit=10&status=todo,in_progress
#[derive(Debug, Deserialize)]
pub struct TaskQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_limit")]
    pub limit: u64,
    pub status: Option<String>,
}

impl TaskQuery {
    pub fn parsed_statuses(&self) -> Result<Option<Vec<String>>, String> {
        const VALID: &[&str] = &["todo", "in_progress", "done"];
        match &self.status {
            None => Ok(None),
            Some(s) if s.trim().is_empty() => Ok(None),
            Some(s) => {
                let statuses: Vec<String> = s
                    .split(',')
                    .map(|v| v.trim().to_string())
                    .filter(|v| !v.is_empty())
                    .collect();
                for status in &statuses {
                    if !VALID.contains(&status.as_str()) {
                        return Err(format!(
                            "invalid status '{}': must be one of todo, in_progress, done",
                            status
                        ));
                    }
                }
                if statuses.is_empty() { Ok(None) } else { Ok(Some(statuses)) }
            }
        }
    }
}

/// Paginated response envelope for GET /api/tasks
#[derive(Debug, Serialize)]
pub struct PaginatedTasksResponse {
    pub tasks: Vec<Task>,
    pub total: u64,
    pub page: u64,
    pub limit: u64,
    pub total_pages: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn task_new_defaults() {
        let t = Task::new("Fix vuln".to_string(), "Patch CVE-2024-1234".to_string());
        assert_eq!(t.title, "Fix vuln");
        assert_eq!(t.description, "Patch CVE-2024-1234");
        assert_eq!(t.status, "todo");
        assert!(t.notes.is_empty());
        assert!(t.assignee_id.is_none());
        assert!(t.cti.is_none());
        assert!(!t.id.is_empty());
    }

    #[test]
    fn task_ids_are_unique() {
        let a = Task::new("A".to_string(), "desc".to_string());
        let b = Task::new("A".to_string(), "desc".to_string());
        assert_ne!(a.id, b.id);
    }

    #[test]
    fn task_note_new_stores_fields() {
        let n = TaskNote::new("Investigated".to_string(), "user-99".to_string());
        assert_eq!(n.note, "Investigated");
        assert_eq!(n.author, "user-99");
        assert!(!n.id.is_empty());
    }

    #[test]
    fn task_with_assignee_and_cti_roundtrips_json() {
        let mut t = Task::new("T".to_string(), "D".to_string());
        t.assignee_id = Some("user-1".to_string());
        t.cti = Some(CtiSelection {
            category_id: "c".to_string(),
            type_id: "t".to_string(),
            item_id: "i".to_string(),
        });
        let json = serde_json::to_string(&t).unwrap();
        let back: Task = serde_json::from_str(&json).unwrap();
        assert_eq!(back.assignee_id, Some("user-1".to_string()));
        let cti = back.cti.unwrap();
        assert_eq!(cti.category_id, "c");
        assert_eq!(cti.type_id, "t");
        assert_eq!(cti.item_id, "i");
    }

    #[test]
    fn null_notes_field_deserializes_to_empty_vec() {
        // MongoDB can store null for an array field; our deserializer should treat it as []
        let json = r#"{"_id":"x","title":"T","description":"D","status":"todo","notes":null,"assignee_id":null,"cti":null,"created_at":"2024-01-01T00:00:00Z","updated_at":"2024-01-01T00:00:00Z"}"#;
        let t: Task = serde_json::from_str(json).unwrap();
        assert!(t.notes.is_empty());
    }

    #[test]
    fn task_query_defaults() {
        let q: TaskQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(q.page, 1);
        assert_eq!(q.limit, 25);
        assert!(q.status.is_none());
    }

    #[test]
    fn task_query_parsed_statuses_valid() {
        let q = TaskQuery { page: 1, limit: 25, status: Some("todo,in_progress".to_string()) };
        let result = q.parsed_statuses().unwrap();
        assert_eq!(result, Some(vec!["todo".to_string(), "in_progress".to_string()]));
    }

    #[test]
    fn task_query_parsed_statuses_invalid() {
        let q = TaskQuery { page: 1, limit: 25, status: Some("todo,bogus".to_string()) };
        let err = q.parsed_statuses().unwrap_err();
        assert!(err.contains("bogus"));
    }

    #[test]
    fn task_query_parsed_statuses_none_when_empty_string() {
        let q = TaskQuery { page: 1, limit: 25, status: Some("".to_string()) };
        assert_eq!(q.parsed_statuses().unwrap(), None);
    }

    #[test]
    fn task_query_parsed_statuses_none_when_absent() {
        let q = TaskQuery { page: 1, limit: 25, status: None };
        assert_eq!(q.parsed_statuses().unwrap(), None);
    }

    #[test]
    fn paginated_response_serializes() {
        let t = Task::new("T".to_string(), "D".to_string());
        let r = PaginatedTasksResponse {
            tasks: vec![t],
            total: 1,
            page: 1,
            limit: 25,
            total_pages: 1,
        };
        let json = serde_json::to_value(&r).unwrap();
        assert_eq!(json["total"], 1);
        assert_eq!(json["page"], 1);
        assert_eq!(json["total_pages"], 1);
        assert!(json["tasks"].is_array());
    }
}
