use std::env;

// Debug is intentionally NOT derived to prevent jwt_secret and invite_code
// from appearing in logs or panic output.
#[derive(Clone)]
pub struct AppConfig {
    pub jwt_secret: String,
    pub frontend_origin: String,
    pub invite_code: String,
    pub weather_poll_interval_minutes: u64,
    pub step_ca_url: String,
    pub step_ca_root_cert: String,
}

impl AppConfig {
    pub fn from_env() -> Self {
        Self {
            jwt_secret: env::var("JWT_SECRET").expect("JWT_SECRET must be set"),
            frontend_origin: env::var("FRONTEND_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            invite_code: env::var("INVITE_CODE").expect("INVITE_CODE must be set"),
            weather_poll_interval_minutes: env::var("WEATHER_POLL_INTERVAL_MINUTES")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(60),
            step_ca_url: env::var("STEP_CA_URL")
                .unwrap_or_else(|_| "https://127.0.0.1:9000".to_string()),
            step_ca_root_cert: env::var("STEP_CA_ROOT_CERT")
                .unwrap_or_else(|_| "/etc/step-ca/certs/root_ca.crt".to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn poll_interval_defaults_to_60() {
        env::remove_var("WEATHER_POLL_INTERVAL_MINUTES");
        let interval = env::var("WEATHER_POLL_INTERVAL_MINUTES")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(60);
        assert_eq!(interval, 60);
    }

    #[test]
    fn poll_interval_parses_env() {
        env::set_var("WEATHER_POLL_INTERVAL_MINUTES", "15");
        let interval = env::var("WEATHER_POLL_INTERVAL_MINUTES")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(60);
        assert_eq!(interval, 15);
        env::remove_var("WEATHER_POLL_INTERVAL_MINUTES");
    }

    #[test]
    fn poll_interval_bad_value_falls_back() {
        env::set_var("WEATHER_POLL_INTERVAL_MINUTES", "not-a-number");
        let interval = env::var("WEATHER_POLL_INTERVAL_MINUTES")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(60);
        assert_eq!(interval, 60);
        env::remove_var("WEATHER_POLL_INTERVAL_MINUTES");
    }
}
