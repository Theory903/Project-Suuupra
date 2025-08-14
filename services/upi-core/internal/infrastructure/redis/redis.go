package redis

import (
	"context"
	"fmt"
	"time"

	"upi-core/internal/config"

	"github.com/redis/go-redis/v9"
)

// Client wraps the Redis client
type Client struct {
	*redis.Client
}

// New creates a new Redis client
func New(cfg config.RedisConfig) (*Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.GetRedisAddr(),
		Password: cfg.Password,
		DB:       cfg.DB,
		PoolSize: cfg.PoolSize,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &Client{Client: rdb}, nil
}

// Health checks the Redis connection health
func (c *Client) Health() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := c.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("Redis health check failed: %w", err)
	}

	return nil
}

// SetVPAMapping caches VPA to bank account mapping
func (c *Client) SetVPAMapping(ctx context.Context, vpa, bankCode, accountNumber string, ttl time.Duration) error {
	key := fmt.Sprintf("vpa:%s", vpa)
	value := fmt.Sprintf("%s:%s", bankCode, accountNumber)

	return c.Set(ctx, key, value, ttl).Err()
}

// GetVPAMapping retrieves VPA to bank account mapping from cache
func (c *Client) GetVPAMapping(ctx context.Context, vpa string) (bankCode, accountNumber string, err error) {
	key := fmt.Sprintf("vpa:%s", vpa)

	value, err := c.Get(ctx, key).Result()
	if err != nil {
		return "", "", err
	}

	// Parse value (format: bankCode:accountNumber)
	var parts []string
	for i, r := range value {
		if r == ':' {
			parts = []string{value[:i], value[i+1:]}
			break
		}
	}

	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid VPA mapping format: %s", value)
	}

	return parts[0], parts[1], nil
}

// SetBankHealth caches bank health status
func (c *Client) SetBankHealth(ctx context.Context, bankCode string, isHealthy bool, ttl time.Duration) error {
	key := fmt.Sprintf("bank:health:%s", bankCode)
	value := "0"
	if isHealthy {
		value = "1"
	}

	return c.Set(ctx, key, value, ttl).Err()
}

// GetBankHealth retrieves bank health status from cache
func (c *Client) GetBankHealth(ctx context.Context, bankCode string) (bool, error) {
	key := fmt.Sprintf("bank:health:%s", bankCode)

	value, err := c.Get(ctx, key).Result()
	if err != nil {
		return false, err
	}

	return value == "1", nil
}

// Close closes the Redis connection
func (c *Client) Close() error {
	return c.Client.Close()
}
