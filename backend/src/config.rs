use std::env;

// Debug is intentionally NOT derived to prevent jwt_secret and invite_code
// from appearing in logs or panic output.
#[derive(Clone)]
pub struct AppConfig {
    pub jwt_secret: String,
    pub frontend_origin: String,
    pub invite_code: String,
}

impl AppConfig {
    pub fn from_env() -> Self {
        Self {
            jwt_secret: env::var("JWT_SECRET").expect("JWT_SECRET must be set"),
            frontend_origin: env::var("FRONTEND_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            invite_code: env::var("INVITE_CODE").expect("INVITE_CODE must be set"),
        }
    }
}
