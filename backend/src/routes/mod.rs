use std::sync::Arc;

use axum::{
    http::Request,
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use axum::http::header::HeaderName;
use tower_governor::{
    governor::GovernorConfigBuilder,
    key_extractor::SmartIpKeyExtractor,
    GovernorLayer,
};
use tower_http::{
    cors::CorsLayer,
    request_id::{MakeRequestId, PropagateRequestIdLayer, RequestId, SetRequestIdLayer},
    trace::TraceLayer,
};
use uuid::Uuid;

/// Always generates a fresh server-side UUID, ignoring any client-supplied header.
/// Prevents log injection via forged X-Correlation-ID values.
#[derive(Clone, Default)]
struct AlwaysMakeRequestUuid;

impl MakeRequestId for AlwaysMakeRequestUuid {
    fn make_request_id<B>(&mut self, _request: &Request<B>) -> Option<RequestId> {
        let id = Uuid::new_v4().to_string().parse().ok()?;
        Some(RequestId::new(id))
    }
}

use crate::{
    config::AppConfig,
    db::Db,
    handlers::{
        admin::{admin_delete_user, admin_list_users, admin_update_role, admin_update_user},
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
    middleware::{admin::require_admin, auth::require_auth},
};

pub fn build_router(pool: Db) -> Router {
    let state = AppState {
        db: pool,
        config: AppConfig::from_env(),
    };

    // Rate limit: 10 req/min per IP (1 token/6s, burst of 10).
    // SmartIpKeyExtractor prefers X-Forwarded-For when present (reverse proxy deployments)
    // and falls back to the TCP peer address for direct connections.
    let governor_conf = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(6)
            .burst_size(10)
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .unwrap(),
    );

    let x_correlation_id = HeaderName::from_static("x-correlation-id");

    let health_route = Router::new()
        .route("/health", get(health_check));

    // Rate-limited to 10 req/min per IP
    let auth_routes = Router::new()
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .layer(GovernorLayer { config: governor_conf });

    let admin_routes = Router::new()
        .route("/api/admin/users", get(admin_list_users))
        .route(
            "/api/admin/users/:id",
            put(admin_update_user).delete(admin_delete_user),
        )
        .route("/api/admin/users/:id/role", put(admin_update_role))
        .layer(middleware::from_fn(require_admin));

    let protected_routes = Router::new()
        .route("/api/auth/me", get(me))
        .route("/api/dashboard", get(get_dashboard))
        .route("/api/users", get(list_users))
        .route("/api/tasks", get(list_tasks).post(create_task))
        .route("/api/tasks/:id", get(get_task).put(update_task).delete(delete_task))
        .route("/api/tasks/:id/notes", post(add_note))
        .route("/api/tasks/:id/notes/:note_id", delete(delete_note))
        .route("/api/cti/categories", get(list_categories).post(create_category))
        .route("/api/cti/categories/:id", delete(delete_category))
        .route("/api/cti/types", get(list_types).post(create_type))
        .route("/api/cti/types/:id", delete(delete_type))
        .route("/api/cti/items", get(list_items).post(create_item))
        .route("/api/cti/items/:id", delete(delete_item))
        .merge(admin_routes)
        .layer(middleware::from_fn_with_state(state.clone(), require_auth));

    Router::new()
        .merge(health_route)
        .merge(auth_routes)
        .merge(protected_routes)
        .layer(PropagateRequestIdLayer::new(x_correlation_id.clone()))
        .layer(SetRequestIdLayer::new(x_correlation_id, AlwaysMakeRequestUuid))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
