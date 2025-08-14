package kafka

import (
	"context"
	"fmt"
	"time"

	"upi-core/internal/config"

	"github.com/segmentio/kafka-go"
)

// Producer wraps the Kafka writer
type Producer struct {
	writers map[string]*kafka.Writer
	config  config.KafkaConfig
}

// NewProducer creates a new Kafka producer
func NewProducer(cfg config.KafkaConfig) (*Producer, error) {
	writers := make(map[string]*kafka.Writer)

	// Create writers for each topic
	topics := map[string]string{
		"transactions": cfg.Topics.Transactions,
		"settlements":  cfg.Topics.Settlements,
		"events":       cfg.Topics.Events,
	}

	for name, topic := range topics {
		if topic == "" {
			continue
		}

		writer := &kafka.Writer{
			Addr:         kafka.TCP(cfg.Brokers...),
			Topic:        topic,
			Balancer:     &kafka.LeastBytes{},
			RequiredAcks: kafka.RequireOne,
			Async:        false,
		}

		writers[name] = writer
	}

	return &Producer{
		writers: writers,
		config:  cfg,
	}, nil
}

// PublishTransactionEvent publishes a transaction event to Kafka
func (p *Producer) PublishTransactionEvent(ctx context.Context, transactionID string, event []byte) error {
	writer, exists := p.writers["transactions"]
	if !exists {
		return fmt.Errorf("transactions topic not configured")
	}

	message := kafka.Message{
		Key:   []byte(transactionID),
		Value: event,
		Time:  time.Now(),
	}

	return writer.WriteMessages(ctx, message)
}

// PublishSettlementEvent publishes a settlement event to Kafka
func (p *Producer) PublishSettlementEvent(ctx context.Context, settlementID string, event []byte) error {
	writer, exists := p.writers["settlements"]
	if !exists {
		return fmt.Errorf("settlements topic not configured")
	}

	message := kafka.Message{
		Key:   []byte(settlementID),
		Value: event,
		Time:  time.Now(),
	}

	return writer.WriteMessages(ctx, message)
}

// PublishEvent publishes a general event to Kafka
func (p *Producer) PublishEvent(ctx context.Context, eventID string, event []byte) error {
	writer, exists := p.writers["events"]
	if !exists {
		return fmt.Errorf("events topic not configured")
	}

	message := kafka.Message{
		Key:   []byte(eventID),
		Value: event,
		Time:  time.Now(),
	}

	return writer.WriteMessages(ctx, message)
}

// Close closes all Kafka writers
func (p *Producer) Close() error {
	var lastErr error
	for _, writer := range p.writers {
		if err := writer.Close(); err != nil {
			lastErr = err
		}
	}
	return lastErr
}

// Health checks the Kafka connection health
func (p *Producer) Health() error {
	// Try to get metadata from one of the brokers
	conn, err := kafka.Dial("tcp", p.config.Brokers[0])
	if err != nil {
		return fmt.Errorf("failed to connect to Kafka broker: %w", err)
	}
	defer conn.Close()

	return nil
}
