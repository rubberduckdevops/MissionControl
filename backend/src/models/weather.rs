use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherLocation {
    #[serde(rename = "_id")]
    pub id: String,
    pub user_id: String,
    pub label: String,
    pub lat: f64,
    pub lon: f64,
    // Cached from NWS /points/{lat},{lon} on first poll
    pub zone_id: Option<String>,
    pub forecast_office: Option<String>,
    pub observation_station_id: Option<String>,
    pub last_polled_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl WeatherLocation {
    pub fn new(user_id: String, label: String, lat: f64, lon: f64) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            user_id,
            label,
            lat,
            lon,
            zone_id: None,
            forecast_office: None,
            observation_station_id: None,
            last_polled_at: None,
            created_at: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherAlert {
    #[serde(rename = "_id")]
    pub id: String,
    pub location_id: String,
    pub nws_id: String,
    pub event: String,
    pub headline: Option<String>,
    pub description: Option<String>,
    pub severity: Option<String>,
    pub urgency: Option<String>,
    pub certainty: Option<String>,
    pub effective: Option<DateTime<Utc>>,
    pub expires: Option<DateTime<Utc>>,
    pub fetched_at: DateTime<Utc>,
}

impl WeatherAlert {
    pub fn new(
        location_id: String,
        nws_id: String,
        event: String,
        headline: Option<String>,
        description: Option<String>,
        severity: Option<String>,
        urgency: Option<String>,
        certainty: Option<String>,
        effective: Option<DateTime<Utc>>,
        expires: Option<DateTime<Utc>>,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            location_id,
            nws_id,
            event,
            headline,
            description,
            severity,
            urgency,
            certainty,
            effective,
            expires,
            fetched_at: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherObservation {
    #[serde(rename = "_id")]
    pub id: String,
    pub location_id: String,
    pub station_id: String,
    pub timestamp: DateTime<Utc>,
    pub temperature_c: Option<f64>,
    pub dewpoint_c: Option<f64>,
    pub wind_direction_deg: Option<f64>,
    pub wind_speed_kmh: Option<f64>,
    pub barometric_pressure_pa: Option<f64>,
    pub visibility_m: Option<f64>,
    pub text_description: Option<String>,
    pub fetched_at: DateTime<Utc>,
}

impl WeatherObservation {
    pub fn new(
        location_id: String,
        station_id: String,
        timestamp: DateTime<Utc>,
        temperature_c: Option<f64>,
        dewpoint_c: Option<f64>,
        wind_direction_deg: Option<f64>,
        wind_speed_kmh: Option<f64>,
        barometric_pressure_pa: Option<f64>,
        visibility_m: Option<f64>,
        text_description: Option<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            location_id,
            station_id,
            timestamp,
            temperature_c,
            dewpoint_c,
            wind_direction_deg,
            wind_speed_kmh,
            barometric_pressure_pa,
            visibility_m,
            text_description,
            fetched_at: Utc::now(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weather_location_new_defaults() {
        let loc = WeatherLocation::new(
            "user1".to_string(),
            "Test Location".to_string(),
            40.7128,
            -74.0060,
        );
        assert!(!loc.id.is_empty());
        assert_eq!(loc.label, "Test Location");
        assert_eq!(loc.lat, 40.7128);
        assert_eq!(loc.lon, -74.0060);
        assert!(loc.zone_id.is_none());
        assert!(loc.forecast_office.is_none());
        assert!(loc.observation_station_id.is_none());
        assert!(loc.last_polled_at.is_none());
    }

    #[test]
    fn weather_location_ids_are_unique() {
        let a = WeatherLocation::new("u".to_string(), "A".to_string(), 0.0, 0.0);
        let b = WeatherLocation::new("u".to_string(), "B".to_string(), 0.0, 0.0);
        assert_ne!(a.id, b.id);
    }

    #[test]
    fn weather_alert_roundtrips_json() {
        let alert = WeatherAlert::new(
            "loc1".to_string(),
            "urn:oid:test".to_string(),
            "Tornado Warning".to_string(),
            None,
            None,
            Some("Extreme".to_string()),
            None,
            None,
            None,
            None,
        );
        let json = serde_json::to_string(&alert).unwrap();
        let back: WeatherAlert = serde_json::from_str(&json).unwrap();
        assert_eq!(back.event, "Tornado Warning");
        assert!(back.headline.is_none());
    }

    #[test]
    fn weather_observation_roundtrips_json() {
        let obs = WeatherObservation::new(
            "loc1".to_string(),
            "KOKC".to_string(),
            Utc::now(),
            Some(22.5),
            None,
            None,
            None,
            None,
            None,
            Some("Partly Cloudy".to_string()),
        );
        let json = serde_json::to_string(&obs).unwrap();
        let back: WeatherObservation = serde_json::from_str(&json).unwrap();
        assert_eq!(back.temperature_c, Some(22.5));
        assert_eq!(back.text_description.as_deref(), Some("Partly Cloudy"));
    }
}
