use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use bson::doc;
use mongodb::options::FindOptions;
use serde::Deserialize;

use crate::{
    errors::{AppError, AppResult},
    handlers::auth::{AppState, Claims},
    models::weather::{WeatherAlert, WeatherLocation, WeatherObservation},
};

#[derive(Debug, Deserialize)]
pub struct CreateWeatherLocationRequest {
    pub label: String,
    pub lat: f64,
    pub lon: f64,
}

fn validate_coordinates(lat: f64, lon: f64) -> AppResult<()> {
    if !(-90.0..=90.0).contains(&lat) {
        return Err(AppError::BadRequest("lat must be between -90 and 90".to_string()));
    }
    if !(-180.0..=180.0).contains(&lon) {
        return Err(AppError::BadRequest("lon must be between -180 and 180".to_string()));
    }
    Ok(())
}

pub async fn list_weather_locations(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
) -> AppResult<Json<Vec<WeatherLocation>>> {
    let collection = state.db.collection::<WeatherLocation>("weather_locations");
    let mut cursor = collection
        .find(doc! { "user_id": &claims.sub }, None)
        .await
        .map_err(AppError::Database)?;

    let mut locations = Vec::new();
    while cursor.advance().await.map_err(AppError::Database)? {
        locations.push(cursor.deserialize_current().map_err(AppError::Database)?);
    }
    Ok(Json(locations))
}

pub async fn create_weather_location(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Json(payload): Json<CreateWeatherLocationRequest>,
) -> AppResult<(StatusCode, Json<WeatherLocation>)> {
    validate_coordinates(payload.lat, payload.lon)?;

    let location = WeatherLocation::new(claims.sub, payload.label, payload.lat, payload.lon);
    let collection = state.db.collection::<WeatherLocation>("weather_locations");
    collection
        .insert_one(&location, None)
        .await
        .map_err(AppError::Database)?;
    Ok((StatusCode::CREATED, Json(location)))
}

pub async fn delete_weather_location(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<StatusCode> {
    let collection = state.db.collection::<WeatherLocation>("weather_locations");
    let result = collection
        .delete_one(doc! { "_id": &id, "user_id": &claims.sub }, None)
        .await
        .map_err(AppError::Database)?;

    if result.deleted_count == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_location_alerts(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Vec<WeatherAlert>>> {
    verify_location_ownership(&state, &id, &claims.sub).await?;

    let collection = state.db.collection::<WeatherAlert>("weather_alerts");
    let opts = FindOptions::builder()
        .sort(doc! { "fetched_at": -1 })
        .limit(100)
        .build();
    let mut cursor = collection
        .find(doc! { "location_id": &id }, opts)
        .await
        .map_err(AppError::Database)?;

    let mut alerts = Vec::new();
    while cursor.advance().await.map_err(AppError::Database)? {
        alerts.push(cursor.deserialize_current().map_err(AppError::Database)?);
    }
    Ok(Json(alerts))
}

pub async fn get_location_observations(
    axum::Extension(claims): axum::Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Vec<WeatherObservation>>> {
    verify_location_ownership(&state, &id, &claims.sub).await?;

    let collection = state.db.collection::<WeatherObservation>("weather_observations");
    let opts = FindOptions::builder()
        .sort(doc! { "timestamp": -1 })
        .limit(48)
        .build();
    let mut cursor = collection
        .find(doc! { "location_id": &id }, opts)
        .await
        .map_err(AppError::Database)?;

    let mut observations = Vec::new();
    while cursor.advance().await.map_err(AppError::Database)? {
        observations.push(cursor.deserialize_current().map_err(AppError::Database)?);
    }
    Ok(Json(observations))
}

async fn verify_location_ownership(
    state: &AppState,
    location_id: &str,
    user_id: &str,
) -> AppResult<WeatherLocation> {
    let collection = state.db.collection::<WeatherLocation>("weather_locations");
    let location = collection
        .find_one(doc! { "_id": location_id }, None)
        .await
        .map_err(AppError::Database)?
        .ok_or(AppError::NotFound)?;

    if location.user_id != user_id {
        return Err(AppError::Forbidden);
    }
    Ok(location)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_lat_rejects_out_of_range() {
        assert!(validate_coordinates(200.0, 0.0).is_err());
        assert!(validate_coordinates(-91.0, 0.0).is_err());
    }

    #[test]
    fn validate_lon_rejects_out_of_range() {
        assert!(validate_coordinates(0.0, 181.0).is_err());
        assert!(validate_coordinates(0.0, -200.0).is_err());
    }

    #[test]
    fn validate_coordinates_accepts_valid() {
        assert!(validate_coordinates(40.7128, -74.0060).is_ok());
        assert!(validate_coordinates(90.0, 180.0).is_ok());
        assert!(validate_coordinates(-90.0, -180.0).is_ok());
    }
}
