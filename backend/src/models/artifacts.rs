use uuid::Uuid;


struct ArtifactLocation {
    pub city: String, 
    pub state: String,
    pub street_1: String, 
    pub street_2: Some(String),
    pub zip_code: String
}


struct ArtifactItem {
    #[serde(rename = "_id")]
    pub id: String,
    pub title: String,
    pub description: String,
    pub location: String, 
    
}