use std::sync::Arc;

use axum::{
    http::Request,
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use axum::http::header::HeaderName;
use jsonwebtoken::DecodingKey;
use tower_http::{
    cors::CorsLayer,
    request_id::{MakeRequestId, PropagateRequestIdLayer, RequestId, SetRequestIdLayer},
    trace::TraceLayer,
};
use axum::http::{HeaderValue, Method, header};
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
        auth::{me, AppState},
        ca::{ca_cert_status, ca_crl, ca_health, ca_provisioners, ca_roots},
        cti::{
            create_category, create_item, create_type, delete_category, delete_item, delete_type,
            list_categories, list_items, list_types,
        },
        dashboard::get_dashboard,
        feeds::{add_feed, delete_feed, get_feed_items, list_feeds},
        health::health_check,
        tasks::{add_note, create_task, delete_note, delete_task, get_task, list_tasks, update_task},
        users::list_users,
        weather::{
            create_weather_location, delete_weather_location, get_location_alerts,
            get_location_observations, list_weather_locations, trigger_weather_poll,
        },
    },
    middleware::{admin::require_admin, auth::require_auth},
    nws_client::NwsClient,
};

pub fn build_router(
    pool: Db,
    nws_client: Arc<NwsClient>,
    ca_client: reqwest::Client,
    intermediate_cert_der: Arc<Vec<u8>>,
    keycloak_decoding_key: Arc<DecodingKey>,
) -> Router {
    let state = AppState {
        db: pool,
        config: AppConfig::from_env(),
        nws_client,
        ca_client,
        intermediate_cert_der,
        keycloak_decoding_key,
    };

    let x_correlation_id = HeaderName::from_static("x-correlation-id");

    let health_route = Router::new()
        .route("/health", get(health_check));

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
        .route("/api/feeds", get(list_feeds).post(add_feed))
        .route("/api/feeds/:id", delete(delete_feed))
        .route("/api/feeds/:id/items", get(get_feed_items))
        .route("/api/weather/locations", get(list_weather_locations).post(create_weather_location))
        .route("/api/weather/locations/:id", delete(delete_weather_location))
        .route("/api/weather/locations/:id/alerts", get(get_location_alerts))
        .route("/api/weather/locations/:id/observations", get(get_location_observations))
        .route("/api/weather/poll", post(trigger_weather_poll))
        .route("/api/ca/health", get(ca_health))
        .route("/api/ca/roots", get(ca_roots))
        .route("/api/ca/crl", get(ca_crl))
        .route("/api/ca/provisioners", get(ca_provisioners))
        .route("/api/ca/cert-status", get(ca_cert_status))
        .merge(admin_routes)
        .layer(middleware::from_fn_with_state(state.clone(), require_auth));

    Router::new()
        .merge(health_route)
        .merge(protected_routes)
        .layer(PropagateRequestIdLayer::new(x_correlation_id.clone()))
        .layer(SetRequestIdLayer::new(x_correlation_id, AlwaysMakeRequestUuid))
        .layer(
            CorsLayer::new()
                .allow_origin(
                    state.config.frontend_origin
                        .parse::<HeaderValue>()
                        .expect("Invalid FRONTEND_ORIGIN"),
                )
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
                .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE]),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
