package ingestion

import (
	"mass-live/internal/config"
	"mass-live/internal/streaming"
	"mass-live/pkg/logger"
)

type Server struct {
	config          *config.Config
	streamingEngine *streaming.Engine
	logger          logger.Logger
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
	// TODO: Implement RTMP server
	return nil
}

func (s *Server) Stop() {
	s.logger.Info("Stopping RTMP ingestion server")
	// TODO: Stop RTMP server
}
