use reqwest::Client;
use serde::Deserialize;

const NWS_BASE: &str = "https://api.weather.gov";
const USER_AGENT: &str = "MissionControl/1.0 (github.com/MissionControl)";

#[derive(Clone)]
pub struct NwsClient {
    client: Client,
}

impl NwsClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .user_agent(USER_AGENT)
            .build()
            .expect("Failed to build NWS HTTP client");
        Self { client }
    }

    /// Returns zone ID (last path segment of forecastZone URL), forecast office,
    /// and the observationStations URL for a given lat/lon.
    pub async fn get_point_metadata(
        &self,
        lat: f64,
        lon: f64,
    ) -> anyhow::Result<PointMetadata> {
        let url = format!("{NWS_BASE}/points/{lat:.4},{lon:.4}");
        let resp: PointGeoJson = self
            .client
            .get(&url)
            .header("Accept", "application/geo+json")
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;

        let props = resp.properties;
        let zone_id = props
            .forecast_zone
            .as_deref()
            .and_then(last_path_segment)
            .map(str::to_owned);
        Ok(PointMetadata {
            cwa: props.cwa,
            zone_id,
            observation_stations_url: props.observation_stations,
        })
    }

    /// Returns all active alerts for a NWS zone ID (e.g. "OKX_Z001").
    pub async fn get_active_alerts(&self, zone_id: &str) -> anyhow::Result<Vec<NwsAlert>> {
        let url = format!("{NWS_BASE}/alerts/active/zone/{zone_id}");
        let resp: AlertCollectionGeoJson = self
            .client
            .get(&url)
            .header("Accept", "application/geo+json")
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;

        Ok(resp
            .features
            .into_iter()
            .filter_map(|f| f.properties)
            .collect())
    }

    /// Returns the first station identifier from an observationStations URL.
    pub async fn get_first_station(&self, stations_url: &str) -> anyhow::Result<Option<String>> {
        let resp: StationCollectionGeoJson = self
            .client
            .get(stations_url)
            .header("Accept", "application/geo+json")
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;

        Ok(resp
            .features
            .into_iter()
            .next()
            .and_then(|f| f.properties)
            .map(|p| p.station_identifier))
    }

    /// Returns the latest observation for a station.
    pub async fn get_latest_observation(
        &self,
        station_id: &str,
    ) -> anyhow::Result<NwsObservation> {
        let url = format!("{NWS_BASE}/stations/{station_id}/observations/latest");
        let resp: ObservationGeoJson = self
            .client
            .get(&url)
            .header("Accept", "application/geo+json")
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;

        Ok(resp.properties)
    }
}

fn last_path_segment(url: &str) -> Option<&str> {
    url.trim_end_matches('/').rsplit('/').next()
}

// ── Response types ────────────────────────────────────────────────────────────

pub struct PointMetadata {
    pub cwa: Option<String>,
    pub zone_id: Option<String>,
    pub observation_stations_url: Option<String>,
}

#[derive(Deserialize)]
struct PointGeoJson {
    properties: PointProperties,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PointProperties {
    cwa: Option<String>,
    forecast_zone: Option<String>,
    observation_stations: Option<String>,
}

#[derive(Deserialize)]
struct AlertCollectionGeoJson {
    features: Vec<AlertFeature>,
}

#[derive(Deserialize)]
struct AlertFeature {
    properties: Option<NwsAlert>,
}

#[derive(Debug, Deserialize)]
pub struct NwsAlert {
    pub id: Option<String>,
    pub event: Option<String>,
    pub headline: Option<String>,
    pub description: Option<String>,
    pub severity: Option<String>,
    pub urgency: Option<String>,
    pub certainty: Option<String>,
    pub effective: Option<String>,
    pub expires: Option<String>,
}

#[derive(Deserialize)]
struct StationCollectionGeoJson {
    features: Vec<StationFeature>,
}

#[derive(Deserialize)]
struct StationFeature {
    properties: Option<StationProperties>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StationProperties {
    station_identifier: String,
}

#[derive(Deserialize)]
struct ObservationGeoJson {
    properties: NwsObservation,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NwsObservation {
    pub timestamp: Option<String>,
    pub text_description: Option<String>,
    pub temperature: Option<QuantitativeValue>,
    pub dewpoint: Option<QuantitativeValue>,
    pub wind_direction: Option<QuantitativeValue>,
    pub wind_speed: Option<QuantitativeValue>,
    pub barometric_pressure: Option<QuantitativeValue>,
    pub visibility: Option<QuantitativeValue>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuantitativeValue {
    pub value: Option<f64>,
    pub unit_code: Option<String>,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn last_path_segment_extracts_zone_id() {
        assert_eq!(
            last_path_segment("https://api.weather.gov/zones/forecast/OKX_Z001"),
            Some("OKX_Z001")
        );
    }

    #[test]
    fn last_path_segment_handles_trailing_slash() {
        assert_eq!(
            last_path_segment("https://api.weather.gov/zones/forecast/PHI_Z001/"),
            Some("PHI_Z001")
        );
    }

    #[test]
    fn last_path_segment_handles_simple_code() {
        assert_eq!(
            last_path_segment("https://api.weather.gov/zones/public/OKC"),
            Some("OKC")
        );
    }

    #[test]
    fn nws_alert_deserializes_with_optional_fields() {
        let json = r#"{
            "id": "urn:oid:2.49.0.1.840.0.abc123",
            "event": "Tornado Warning",
            "severity": "Extreme",
            "urgency": "Immediate",
            "certainty": "Observed",
            "headline": null,
            "description": null,
            "effective": null,
            "expires": null
        }"#;
        let alert: NwsAlert = serde_json::from_str(json).unwrap();
        assert_eq!(alert.event.as_deref(), Some("Tornado Warning"));
        assert!(alert.headline.is_none());
    }

    #[test]
    fn quantitative_value_deserializes_null_value() {
        let json = r#"{"value": null, "unitCode": "wmoUnit:degC", "qualityControl": "V"}"#;
        let qv: QuantitativeValue = serde_json::from_str(json).unwrap();
        assert!(qv.value.is_none());
    }
}
