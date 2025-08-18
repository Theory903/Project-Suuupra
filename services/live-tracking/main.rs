// Live Tracking Service - Real-time GPS and activity tracking
use std::sync::Arc;
use tokio::sync::RwLock;
use warp::{Filter, Rejection, Reply};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use redis::Client as RedisClient;
use sqlx::{Pool, Postgres};
use tracing::{info, error, warn, instrument};

mod config;
mod database;
mod models;
mod services;
mod handlers;
mod middleware;
mod utils;

use config::Config;
use services::{
    tracking_service::TrackingService,
    geolocation_service::GeolocationService,
    route_optimization::RouteOptimizer,
    analytics_service::AnalyticsService,
};

#[derive(Debug, Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db_pool: Pool<Postgres>,
    pub redis_client: RedisClient,
    pub tracking_service: Arc<TrackingService>,
    pub geolocation_service: Arc<GeolocationService>,
    pub route_optimizer: Arc<RouteOptimizer>,
    pub analytics_service: Arc<AnalyticsService>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting Live Tracking Service v1.0.0");

    // Load configuration
    let config = Arc::new(Config::from_env()?);
    info!("Configuration loaded for environment: {}", config.environment);

    // Initialize database pool
    let db_pool = database::create_pool(&config.database_url).await?;
    info!("Database connection pool created");

    // Run database migrations
    database::run_migrations(&db_pool).await?;
    info!("Database migrations completed");

    // Initialize Redis client
    let redis_client = redis::Client::open(config.redis_url.as_str())?;
    info!("Redis client initialized");

    // Initialize services
    let tracking_service = Arc::new(TrackingService::new(
        db_pool.clone(),
        redis_client.clone(),
        config.clone(),
    ));

    let geolocation_service = Arc::new(GeolocationService::new(
        db_pool.clone(),
        config.clone(),
    ));

    let route_optimizer = Arc::new(RouteOptimizer::new(
        db_pool.clone(),
        config.clone(),
    ));

    let analytics_service = Arc::new(AnalyticsService::new(
        db_pool.clone(),
        redis_client.clone(),
        config.clone(),
    ));

    // Create application state
    let app_state = AppState {
        config: config.clone(),
        db_pool,
        redis_client,
        tracking_service: tracking_service.clone(),
        geolocation_service,
        route_optimizer,
        analytics_service,
    };

    // Start background services
    tokio::spawn(start_background_tasks(app_state.clone()));

    // Setup API routes
    let api_routes = setup_routes(app_state.clone());

    // Start HTTP server
    let port = config.port;
    info!("Starting HTTP server on port {}", port);

    warp::serve(api_routes)
        .run(([0, 0, 0, 0], port))
        .await;

    Ok(())
}

fn setup_routes(
    app_state: AppState,
) -> impl Filter<Extract = impl Reply, Error = Rejection> + Clone {
    let cors = warp::cors()
        .allow_any_origin()
        .allow_headers(vec!["content-type", "authorization"])
        .allow_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"]);

    // Health check routes
    let health = warp::path("health")
        .and(warp::get())
        .and_then(handlers::health::health_check);

    let ready = warp::path!("health" / "ready")
        .and(warp::get())
        .and(with_app_state(app_state.clone()))
        .and_then(handlers::health::readiness_check);

    // Tracking routes
    let track_location = warp::path!("api" / "v1" / "track" / "location")
        .and(warp::post())
        .and(warp::body::json())
        .and(with_app_state(app_state.clone()))
        .and_then(handlers::tracking::track_location);

    let get_location = warp::path!("api" / "v1" / "location" / String)
        .and(warp::get())
        .and(with_app_state(app_state.clone()))
        .and_then(handlers::tracking::get_current_location);

    let get_location_history = warp::path!("api" / "v1" / "location" / String / "history")
        .and(warp::get())
        .and(warp::query())
        .and(with_app_state(app_state.clone()))
        .and_then(handlers::tracking::get_location_history);

    // Route optimization routes
    let optimize_route = warp::path!("api" / "v1" / "routes" / "optimize")
        .and(warp::post())
        .and(warp::body::json())
        .and(with_app_state(app_state.clone()))
        .and_then(handlers::routes::optimize_route);

    let get_route = warp::path!("api" / "v1" / "routes" / String)
        .and(warp::get())
        .and(with_app_state(app_state.clone()))
        .and_then(handlers::routes::get_route);

    // Analytics routes
    let get_analytics = warp::path!("api" / "v1" / "analytics")
        .and(warp::get())
        .and(warp::query())
        .and(with_app_state(app_state.clone()))
        .and_then(handlers::analytics::get_analytics);

    // Geofencing routes
    let create_geofence = warp::path!("api" / "v1" / "geofences")
        .and(warp::post())
        .and(warp::body::json())
        .and(with_app_state(app_state.clone()))
        .and_then(handlers::geofencing::create_geofence);

    let get_geofences = warp::path!("api" / "v1" / "geofences")
        .and(warp::get())
        .and(warp::query())
        .and(with_app_state(app_state.clone()))
        .and_then(handlers::geofencing::get_geofences);

    // WebSocket for real-time tracking
    let ws_tracking = warp::path!("ws" / "tracking" / String)
        .and(warp::ws())
        .and(with_app_state(app_state.clone()))
        .and_then(handlers::websocket::tracking_websocket);

    // Metrics endpoint
    let metrics = warp::path("metrics")
        .and(warp::get())
        .and_then(handlers::metrics::prometheus_metrics);

    // Root endpoint
    let root = warp::path::end()
        .and(warp::get())
        .map(|| {
            warp::reply::json(&serde_json::json!({
                "service": "Suuupra Live Tracking Service",
                "version": "1.0.0",
                "status": "running",
                "features": [
                    "Real-time GPS tracking",
                    "Route optimization",
                    "Geofencing",
                    "Analytics and reporting",
                    "WebSocket real-time updates"
                ]
            }))
        });

    root
        .or(health)
        .or(ready)
        .or(track_location)
        .or(get_location)
        .or(get_location_history)
        .or(optimize_route)
        .or(get_route)
        .or(get_analytics)
        .or(create_geofence)
        .or(get_geofences)
        .or(ws_tracking)
        .or(metrics)
        .with(cors)
        .with(warp::trace::request())
}

fn with_app_state(
    app_state: AppState,
) -> impl Filter<Extract = (AppState,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || app_state.clone())
}

async fn start_background_tasks(app_state: AppState) {
    info!("Starting background tasks");

    // Start location data aggregation
    let tracking_service = app_state.tracking_service.clone();
    tokio::spawn(async move {
        tracking_service.start_data_aggregation().await;
    });

    // Start analytics processing
    let analytics_service = app_state.analytics_service.clone();
    tokio::spawn(async move {
        analytics_service.start_processing().await;
    });

    // Start geofence monitoring
    let geolocation_service = app_state.geolocation_service.clone();
    tokio::spawn(async move {
        geolocation_service.start_geofence_monitoring().await;
    });

    info!("Background tasks started successfully");
}
