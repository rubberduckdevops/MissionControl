use axum::{
    middleware,
    routing::{delete, get, post},
    Router,
};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use crate::{
    config::AppConfig,
    db::Db,
    handlers::{
        auth::{login, me, register, AppState},
        cti::{
            create_category, create_item, create_type, delete_category, delete_item, delete_type,
            list_categories, list_items, list_types,
        },
        dashboard::get_dashboard,
        health::health_check,
        tasks::{add_note, create_task, delete_note, delete_task, get_task, list_tasks, update_task},
        users::list_users,
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
        // Users
        .route("/api/users", get(list_users))
        // Tasks
        .route("/api/tasks", get(list_tasks).post(create_task))
        .route("/api/tasks/:id", get(get_task).put(update_task).delete(delete_task))
        .route("/api/tasks/:id/notes", post(add_note))
        .route("/api/tasks/:id/notes/:note_id", delete(delete_note))
        // CTI – Categories
        .route("/api/cti/categories", get(list_categories).post(create_category))
        .route("/api/cti/categories/:id", delete(delete_category))
        // CTI – Types
        .route("/api/cti/types", get(list_types).post(create_type))
        .route("/api/cti/types/:id", delete(delete_type))
        // CTI – Items
        .route("/api/cti/items", get(list_items).post(create_item))
        .route("/api/cti/items/:id", delete(delete_item))
        .layer(middleware::from_fn_with_state(state.clone(), require_auth));

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
