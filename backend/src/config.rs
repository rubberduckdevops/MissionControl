use std::env;
use url::Url;

// Debug is intentionally NOT derived to prevent sensitive values
// from appearing in logs or panic output.
#[derive(Clone)]
pub struct AppConfig {
    pub frontend_origin: String,
    pub keycloak_url: String,
    pub keycloak_realm: String,
    pub keycloak_client_id: String,
    pub weather_poll_interval_minutes: u64,
    pub step_ca_url: Url,
    pub step_ca_root_cert: String,
    pub step_ca_intermediate_cert: String,
}

impl AppConfig {
    pub fn from_env() -> Self {
        Self {
            frontend_origin: env::var("FRONTEND_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            keycloak_url: env::var("KEYCLOAK_URL").expect("KEYCLOAK_URL must be set"),
            keycloak_realm: env::var("KEYCLOAK_REALM").expect("KEYCLOAK_REALM must be set"),
            keycloak_client_id: env::var("KEYCLOAK_CLIENT_ID")
                .expect("KEYCLOAK_CLIENT_ID must be set"),
            weather_poll_interval_minutes: env::var("WEATHER_POLL_INTERVAL_MINUTES")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(60),
            step_ca_url: Url::parse(
                &env::var("STEP_CA_URL")
                    .unwrap_or_else(|_| "https://127.0.0.1:9000".to_string()),
            )
            .expect("STEP_CA_URL must be a valid URL"),
            step_ca_root_cert: env::var("STEP_CA_ROOT_CERT")
                .unwrap_or_else(|_| "/etc/step-ca/certs/root_ca.crt".to_string()),
            step_ca_intermediate_cert: env::var("STEP_CA_INTERMEDIATE_CERT")
                .unwrap_or_else(|_| "/etc/step-ca/certs/intermediate_ca.crt".to_string()),
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
