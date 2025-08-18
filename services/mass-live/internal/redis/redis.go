package redis

import (
	"context"
	"encoding/json"

	"github.com/go-redis/redis/v8"
)

type Client struct {
	client *redis.Client
}

func New(redisURL string) (*Client, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}

	client := redis.NewClient(opt)

	// Test connection
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	return &Client{client: client}, nil
}

func (c *Client) Close() error {
	return c.client.Close()
}

func (c *Client) SetStream(streamID string, stream interface{}) error {
	data, err := json.Marshal(stream)
	if err != nil {
		return err
	}
	return c.client.Set(context.Background(), "stream:"+streamID, data, 0).Err()
}

func (c *Client) GetStream(streamID string, result interface{}) error {
	data, err := c.client.Get(context.Background(), "stream:"+streamID).Result()
	if err != nil {
		return err
	}

	return json.Unmarshal([]byte(data), result)
}

func (c *Client) DeleteStream(streamID string) error {
	return c.client.Del(context.Background(), "stream:"+streamID).Err()
}

func (c *Client) SetStreamViewerCount(streamID string, count int) error {
	return c.client.Set(context.Background(), "viewers:"+streamID, count, 0).Err()
}

func (c *Client) GetStreamViewerCount(streamID string) (int, error) {
	return c.client.Get(context.Background(), "viewers:"+streamID).Int()
}
