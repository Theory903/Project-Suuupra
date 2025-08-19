use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct Location {
    pub id: Uuid,
    pub user_id: String,
    pub latitude: f64,
    pub longitude: f64,
    pub altitude: Option<f64>,
    pub accuracy: Option<f64>,
    pub timestamp: DateTime<Utc>,
}