use anyhow::Result;
use dotenvy::dotenv;
use mongodb::{Client, IndexModel, options::IndexOptions};
use bson::doc;
use std::env;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod db;
mod errors;
mod handlers;
mod middleware;
mod models;
mod routes;

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
    tracing::info!("MongoDB indexes ensured");

    let app = routes::build_router(db);

    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Server listening on {addr}");
    axum::serve(listener, app).await?;
    Ok(())
}
