use std::sync::Arc;

use bson::doc;
use chrono::{DateTime, Utc};
use tokio::time::{Duration, interval};

use crate::{
    db::Db,
    models::weather::{WeatherAlert, WeatherLocation, WeatherObservation},
    nws_client::NwsClient,
};

pub async fn run_weather_poller(db: Db, nws_client: Arc<NwsClient>, interval_minutes: u64) {
    let mut ticker = interval(Duration::from_secs(interval_minutes * 60));
    loop {
        ticker.tick().await;
        if let Err(e) = poll_all_locations(&db, &nws_client).await {
            tracing::error!("Weather poll cycle failed: {e:?}");
        }
    }
}

pub async fn poll_all_locations(db: &Db, nws_client: &NwsClient) -> anyhow::Result<()> {
    let collection = db.collection::<WeatherLocation>("weather_locations");
    let mut cursor = collection.find(None, None).await?;
    while cursor.advance().await? {
        let loc = cursor.deserialize_current()?;
        let loc_id = loc.id.clone();
        if let Err(e) = poll_location(db, nws_client, loc).await {
            tracing::warn!("Failed to poll location {loc_id}: {e:?}");
        }
    }
    Ok(())
}

async fn poll_location(db: &Db, nws_client: &NwsClient, loc: WeatherLocation) -> anyhow::Result<()> {
    let loc = ensure_points_resolved(db, nws_client, loc).await?;

    if let Some(ref zone_id) = loc.zone_id {
        fetch_and_store_alerts(db, nws_client, &loc.id, zone_id).await?;
    }

    if let Some(ref station_id) = loc.observation_station_id {
        fetch_and_store_observation(db, nws_client, &loc.id, station_id).await?;
    }

    db.collection::<bson::Document>("weather_locations")
        .update_one(
            doc! { "_id": &loc.id },
            doc! { "$set": { "last_polled_at": bson::DateTime::from_chrono(Utc::now()) } },
            None,
        )
        .await?;

    tracing::debug!("Polled location {} ({})", loc.id, loc.label);
    Ok(())
}

async fn ensure_points_resolved(
    db: &Db,
    nws_client: &NwsClient,
    loc: WeatherLocation,
) -> anyhow::Result<WeatherLocation> {
    if loc.zone_id.is_some() && loc.observation_station_id.is_some() {
        return Ok(loc);
    }

    let metadata = nws_client.get_point_metadata(loc.lat, loc.lon).await?;

    let station_id = if let Some(ref stations_url) = metadata.observation_stations_url {
        nws_client.get_first_station(stations_url).await?
    } else {
        None
    };

    db.collection::<bson::Document>("weather_locations")
        .update_one(
            doc! { "_id": &loc.id },
            doc! { "$set": {
                "zone_id": &metadata.zone_id,
                "forecast_office": &metadata.cwa,
                "observation_station_id": &station_id,
            }},
            None,
        )
        .await?;

    Ok(WeatherLocation {
        zone_id: metadata.zone_id,
        forecast_office: metadata.cwa,
        observation_station_id: station_id,
        ..loc
    })
}

async fn fetch_and_store_alerts(
    db: &Db,
    nws_client: &NwsClient,
    location_id: &str,
    zone_id: &str,
) -> anyhow::Result<()> {
    let alerts = nws_client.get_active_alerts(zone_id).await?;
    let collection = db.collection::<bson::Document>("weather_alerts");

    for alert in alerts {
        let Some(nws_id) = alert.id else { continue };
        let event = alert.event.unwrap_or_default();

        let effective = parse_optional_datetime(alert.effective.as_deref());
        let expires = parse_optional_datetime(alert.expires.as_deref());

        let new_alert = WeatherAlert::new(
            location_id.to_string(),
            nws_id.clone(),
            event,
            alert.headline,
            alert.description,
            alert.severity,
            alert.urgency,
            alert.certainty,
            effective,
            expires,
        );

        let alert_doc = bson::to_document(&new_alert)?;
        collection
            .update_one(
                doc! { "nws_id": &nws_id },
                doc! { "$setOnInsert": alert_doc },
                mongodb::options::UpdateOptions::builder().upsert(true).build(),
            )
            .await?;
    }
    Ok(())
}

async fn fetch_and_store_observation(
    db: &Db,
    nws_client: &NwsClient,
    location_id: &str,
    station_id: &str,
) -> anyhow::Result<()> {
    let obs = nws_client.get_latest_observation(station_id).await?;

    let timestamp = parse_optional_datetime(obs.timestamp.as_deref())
        .unwrap_or_else(Utc::now);

    let observation = WeatherObservation::new(
        location_id.to_string(),
        station_id.to_string(),
        timestamp,
        obs.temperature.and_then(|v| v.value),
        obs.dewpoint.and_then(|v| v.value),
        obs.wind_direction.and_then(|v| v.value),
        obs.wind_speed.and_then(|v| v.value),
        obs.barometric_pressure.and_then(|v| v.value),
        obs.visibility.and_then(|v| v.value),
        obs.text_description,
    );

    db.collection::<WeatherObservation>("weather_observations")
        .insert_one(&observation, None)
        .await?;

    Ok(())
}

fn parse_optional_datetime(s: Option<&str>) -> Option<DateTime<Utc>> {
    s.and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_optional_datetime_handles_valid_iso8601() {
        let result = parse_optional_datetime(Some("2024-06-15T14:00:00+00:00"));
        assert!(result.is_some());
    }

    #[test]
    fn parse_optional_datetime_returns_none_for_none_input() {
        assert!(parse_optional_datetime(None).is_none());
    }

    #[test]
    fn parse_optional_datetime_returns_none_for_invalid() {
        assert!(parse_optional_datetime(Some("not-a-date")).is_none());
    }
}
