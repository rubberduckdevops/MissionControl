use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    #[serde(rename = "_id")]
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

impl Category {
    pub fn new(name: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            created_at: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CtiType {
    #[serde(rename = "_id")]
    pub id: String,
    pub name: String,
    pub category_id: String,
    pub created_at: DateTime<Utc>,
}

impl CtiType {
    pub fn new(name: String, category_id: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            category_id,
            created_at: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CtiItem {
    #[serde(rename = "_id")]
    pub id: String,
    pub name: String,
    pub type_id: String,
    pub created_at: DateTime<Utc>,
}

impl CtiItem {
    pub fn new(name: String, type_id: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            type_id,
            created_at: Utc::now(),
        }
    }
}

/// Embedded in a Task to record which Category/Type/Item it is classified under.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CtiSelection {
    pub category_id: String,
    pub type_id: String,
    pub item_id: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn category_new_sets_name_and_generates_id() {
        let cat = Category::new("Malware".to_string());
        assert_eq!(cat.name, "Malware");
        assert!(!cat.id.is_empty());
    }

    #[test]
    fn category_ids_are_unique() {
        let a = Category::new("A".to_string());
        let b = Category::new("A".to_string());
        assert_ne!(a.id, b.id);
    }

    #[test]
    fn cti_type_new_stores_category_id() {
        let t = CtiType::new("Ransomware".to_string(), "cat-123".to_string());
        assert_eq!(t.name, "Ransomware");
        assert_eq!(t.category_id, "cat-123");
        assert!(!t.id.is_empty());
    }

    #[test]
    fn cti_item_new_stores_type_id() {
        let item = CtiItem::new("LockBit".to_string(), "type-456".to_string());
        assert_eq!(item.name, "LockBit");
        assert_eq!(item.type_id, "type-456");
        assert!(!item.id.is_empty());
    }

    #[test]
    fn cti_selection_roundtrips_json() {
        let sel = CtiSelection {
            category_id: "c1".to_string(),
            type_id: "t1".to_string(),
            item_id: "i1".to_string(),
        };
        let json = serde_json::to_string(&sel).unwrap();
        let back: CtiSelection = serde_json::from_str(&json).unwrap();
        assert_eq!(back.category_id, "c1");
        assert_eq!(back.type_id, "t1");
        assert_eq!(back.item_id, "i1");
    }
}
