package websocket

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// TODO: Implement proper origin checking
		return true
	},
}

type Hub struct {
	clients     map[*Client]bool
	broadcast   chan []byte
	register    chan *Client
	unregister  chan *Client
	redisClient *redis.Client
	logger      *slog.Logger
	mu          sync.RWMutex
}

type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	send     chan []byte
	userID   string
	streamID string
	role     string
}

type Message struct {
	Type      string      `json:"type"`
	StreamID  string      `json:"stream_id,omitempty"`
	UserID    string      `json:"user_id,omitempty"`
	Username  string      `json:"username,omitempty"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
}

func NewHub(redisClient *redis.Client, logger *slog.Logger) *Hub {
	return &Hub{
		clients:     make(map[*Client]bool),
		broadcast:   make(chan []byte, 256),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		redisClient: redisClient,
		logger:      logger,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

			h.logger.Info("Client connected",
				slog.String("user_id", client.userID),
				slog.String("stream_id", client.streamID),
			)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

			h.logger.Info("Client disconnected",
				slog.String("user_id", client.userID),
				slog.String("stream_id", client.streamID),
			)

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					delete(h.clients, client)
					close(client.send)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) HandleWebSocket(c *gin.Context) {
	streamID := c.Param("streamId")
	if streamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stream ID required"})
		return
	}

	// Get user info from context (set by auth middleware)
	userID, _ := c.Get("user_id")
	username, _ := c.Get("username")
	role, _ := c.Get("role")

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.Error("WebSocket upgrade failed", slog.Any("error", err))
		return
	}

	client := &Client{
		hub:      h,
		conn:     conn,
		send:     make(chan []byte, 256),
		userID:   userID.(string),
		streamID: streamID,
		role:     role.(string),
	}

	// Register client
	h.register <- client

	// Add viewer to stream (if not the streamer)
	if role != "streamer" {
		ctx := context.Background()
		h.redisClient.SAdd(ctx, "stream_viewers:"+streamID, userID)

		// Send join message to other clients
		joinMsg := Message{
			Type:      "viewer_joined",
			StreamID:  streamID,
			UserID:    userID.(string),
			Username:  username.(string),
			Timestamp: time.Now(),
		}
		h.broadcastToStream(streamID, joinMsg)
	}

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

func (h *Hub) broadcastToStream(streamID string, message Message) {
	data, err := json.Marshal(message)
	if err != nil {
		h.logger.Error("Failed to marshal message", slog.Any("error", err))
		return
	}

	h.mu.RLock()
	for client := range h.clients {
		if client.streamID == streamID {
			select {
			case client.send <- data:
			default:
				delete(h.clients, client)
				close(client.send)
			}
		}
	}
	h.mu.RUnlock()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()

		// Remove viewer from stream
		if c.role != "streamer" {
			ctx := context.Background()
			c.hub.redisClient.SRem(ctx, "stream_viewers:"+c.streamID, c.userID)

			// Send leave message
			leaveMsg := Message{
				Type:      "viewer_left",
				StreamID:  c.streamID,
				UserID:    c.userID,
				Timestamp: time.Now(),
			}
			c.hub.broadcastToStream(c.streamID, leaveMsg)
		}
	}()

	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, messageData, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.hub.logger.Error("WebSocket error", slog.Any("error", err))
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(messageData, &msg); err != nil {
			c.hub.logger.Error("Failed to unmarshal message", slog.Any("error", err))
			continue
		}

		// Set message metadata
		msg.UserID = c.userID
		msg.StreamID = c.streamID
		msg.Timestamp = time.Now()

		// Handle different message types
		c.handleMessage(msg)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(msg Message) {
	switch msg.Type {
	case "chat_message":
		c.handleChatMessage(msg)
	case "viewer_count_request":
		c.handleViewerCountRequest(msg)
	case "stream_quality_change":
		c.handleQualityChange(msg)
	default:
		c.hub.logger.Warn("Unknown message type", slog.String("type", msg.Type))
	}
}

func (c *Client) handleChatMessage(msg Message) {
	// TODO: Implement chat moderation and filtering

	// Store chat message in Redis
	ctx := context.Background()
	chatKey := "stream_chat:" + c.streamID

	chatData := map[string]interface{}{
		"user_id":   c.userID,
		"message":   msg.Data,
		"timestamp": msg.Timestamp.Unix(),
	}

	chatJSON, _ := json.Marshal(chatData)
	c.hub.redisClient.LPush(ctx, chatKey, chatJSON)
	c.hub.redisClient.LTrim(ctx, chatKey, 0, 999) // Keep last 1000 messages

	// Broadcast to all clients in the stream
	c.hub.broadcastToStream(c.streamID, msg)
}

func (c *Client) handleViewerCountRequest(msg Message) {
	ctx := context.Background()
	count, _ := c.hub.redisClient.SCard(ctx, "stream_viewers:"+c.streamID).Result()

	response := Message{
		Type:      "viewer_count",
		StreamID:  c.streamID,
		Data:      map[string]interface{}{"count": count},
		Timestamp: time.Now(),
	}

	responseData, _ := json.Marshal(response)
	select {
	case c.send <- responseData:
	default:
		close(c.send)
	}
}

func (c *Client) handleQualityChange(msg Message) {
	// TODO: Implement quality change logic
	c.hub.logger.Info("Quality change requested",
		slog.String("user_id", c.userID),
		slog.String("stream_id", c.streamID),
		slog.Any("data", msg.Data),
	)
}
