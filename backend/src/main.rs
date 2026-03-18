use anyhow::Result;
use dotenvy::dotenv;
use mongodb::{Client, IndexModel, options::IndexOptions};
use bson::doc;
use std::{env, net::SocketAddr, sync::Arc};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod db;
mod errors;
mod handlers;
mod middleware;
mod models;
mod nws_client;
mod routes;
mod weather_poller;

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            env::var("RUST_LOG")
                .unwrap_or_else(|_| "missoncontrol=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let mongo_uri = env::var("MONGODB_URI").expect("MONGODB_URI must be set");
    let mongo_db = env::var("MONGODB_DB").expect("MONGODB_DB must be set");

    let client = Client::with_uri_str(&mongo_uri).await?;
    let db = client.database(&mongo_db);

    // Ensure unique indexes on email and username (idempotent)
    let users = db.collection::<bson::Document>("users");
    for field in ["email", "username"] {
        let opts = IndexOptions::builder().unique(true).build();
        let index = IndexModel::builder()
            .keys(doc! { field: 1 })
            .options(opts)
            .build();
        users.create_index(index, None).await?;
    }

    // Weather: index locations by user, alerts by nws_id (unique for deduplication)
    db.collection::<bson::Document>("weather_locations")
        .create_index(IndexModel::builder().keys(doc! { "user_id": 1 }).build(), None)
        .await?;
    db.collection::<bson::Document>("weather_alerts")
        .create_index(
            IndexModel::builder()
                .keys(doc! { "nws_id": 1 })
                .options(IndexOptions::builder().unique(true).build())
                .build(),
            None,
        )
        .await?;
    db.collection::<bson::Document>("weather_alerts")
        .create_index(
            IndexModel::builder()
                .keys(doc! { "location_id": 1, "fetched_at": -1 })
                .build(),
            None,
        )
        .await?;
    db.collection::<bson::Document>("weather_observations")
        .create_index(
            IndexModel::builder()
                .keys(doc! { "location_id": 1, "timestamp": -1 })
                .build(),
            None,
        )
        .await?;
    // TTL: auto-expire observations older than 48 hours
    db.collection::<bson::Document>("weather_observations")
        .create_index(
            IndexModel::builder()
                .keys(doc! { "fetched_at": 1 })
                .options(IndexOptions::builder().expire_after(std::time::Duration::from_secs(172800)).build())
                .build(),
            None,
        )
        .await?;
    tracing::info!("MongoDB indexes ensured");

    let nws = Arc::new(nws_client::NwsClient::new());
    let poll_interval = config::AppConfig::from_env().weather_poll_interval_minutes;
    let poller_db = db.clone();
    let poller_nws = Arc::clone(&nws);
    tokio::spawn(async move {
        weather_poller::run_weather_poller(poller_db, poller_nws, poll_interval).await;
    });

    let app = routes::build_router(db, nws);

    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Server listening on {addr}");
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>()).await?;
    Ok(())
}
