use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub environment: String,
    pub port: u16,
    pub database_url: String,
    pub redis_url: String,
}

impl Config {
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Config {
            environment: env::var("NODE_ENV").unwrap_or_else(|_| "development".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8099".to_string())
                .parse()?,
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgresql://postgres:postgres123@postgres:5432/live_tracking".to_string()),
            redis_url: env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://redis:6379".to_string()),
        })
    }
}