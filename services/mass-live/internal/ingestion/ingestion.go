package ingestion

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"mass-live/internal/config"
	"mass-live/internal/streaming"
	"mass-live/pkg/logger"
)

type Server struct {
	config          *config.Config
	streamingEngine *streaming.Engine
	logger          logger.Logger
	server          *http.Server
}

func New(cfg *config.Config, engine *streaming.Engine, logger logger.Logger) *Server {
	return &Server{
		config:          cfg,
		streamingEngine: engine,
		logger:          logger,
	}
}

func (s *Server) Start() error {
	s.logger.Info("Starting RTMP ingestion server", "port", s.config.RTMPPort)

	// Implement RTMP server using HTTP server for RTMP endpoint
	mux := http.NewServeMux()

	// RTMP publish endpoint
	mux.HandleFunc("/publish/", s.handleRTMPPublish)

	// RTMP play endpoint
	mux.HandleFunc("/play/", s.handleRTMPPlay)

	// Health check endpoint
	mux.HandleFunc("/health", s.handleHealth)

	server := &http.Server{
		Addr:    ":" + s.config.RTMPPort,
		Handler: mux,
	}

	s.logger.Info("RTMP ingestion server started", "addr", server.Addr)

	// Store server reference for graceful shutdown
	s.server = server

	// Start server in goroutine
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			s.logger.Error("RTMP server failed", "error", err)
		}
	}()

	return nil
}

func (s *Server) Stop() {
	s.logger.Info("Stopping RTMP ingestion server")
	// Stop RTMP server

	// In a production implementation, this would gracefully shutdown
	// the HTTP server and clean up any active streams
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if s.server != nil {
		if err := s.server.Shutdown(ctx); err != nil {
			s.logger.Error("Failed to gracefully shutdown RTMP server", "error", err)
		} else {
			s.logger.Info("RTMP server stopped gracefully")
		}
	}
}

// handleRTMPPublish handles RTMP stream publishing
func (s *Server) handleRTMPPublish(w http.ResponseWriter, r *http.Request) {
	streamKey := r.URL.Path[len("/publish/"):]
	s.logger.Info("RTMP publish request", "stream_key", streamKey)

	// In a production implementation, this would:
	// 1. Authenticate the stream key
	// 2. Setup transcoding pipeline
	// 3. Begin processing the RTMP stream
	// 4. Forward to CDN/distribution

	// For now, return success
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status": "stream_started", "stream_key": "%s"}`, streamKey)
}

// handleRTMPPlay handles RTMP stream playback
func (s *Server) handleRTMPPlay(w http.ResponseWriter, r *http.Request) {
	streamKey := r.URL.Path[len("/play/"):]
	s.logger.Info("RTMP play request", "stream_key", streamKey)

	// In a production implementation, this would:
	// 1. Validate stream availability
	// 2. Setup playback session
	// 3. Stream content to client

	// For now, return stream info
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status": "stream_playing", "stream_key": "%s"}`, streamKey)
}

// handleHealth provides health check for the ingestion server
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, `{"status": "healthy", "service": "rtmp_ingestion"}`)
}
