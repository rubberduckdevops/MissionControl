use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use crate::{
    config::AppConfig,
    db::Db,
    handlers::{
        auth::{login, me, register, AppState},
        dashboard::get_dashboard,
        health::health_check,
        tasks::{add_note, create_task, delete_note, delete_task, get_task, list_tasks, update_task},
    },
    middleware::auth::require_auth,
};

pub fn build_router(pool: Db) -> Router {
    let state = AppState {
        db: pool,
        config: AppConfig::from_env(),
    };

    let public_routes = Router::new()
        .route("/health", get(health_check))
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login));

    let protected_routes = Router::new()
        .route("/api/auth/me", get(me))
        .route("/api/dashboard", get(get_dashboard))
        .route("/api/tasks", get(list_tasks).post(create_task))
        .route("/api/tasks/:id", get(get_task).put(update_task).delete(delete_task))
        .route("/api/tasks/:id/notes", post(add_note))
        .route("/api/tasks/:id/notes/:note_id", delete(delete_note))
        .layer(middleware::from_fn_with_state(state.clone(), require_auth));

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
