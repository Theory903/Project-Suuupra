package server

import (
	"context"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// LoggingUnaryInterceptor logs gRPC unary requests and responses
func LoggingUnaryInterceptor(logger *logrus.Logger) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req interface{},
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (interface{}, error) {
		start := time.Now()

		logger.WithFields(logrus.Fields{
			"method": info.FullMethod,
			"type":   "unary",
		}).Info("gRPC request started")

		// Call the handler
		resp, err := handler(ctx, req)

		// Log the result
		duration := time.Since(start)
		fields := logrus.Fields{
			"method":   info.FullMethod,
			"type":     "unary",
			"duration": duration,
		}

		if err != nil {
			st, _ := status.FromError(err)
			fields["error"] = st.Message()
			fields["code"] = st.Code()
			logger.WithFields(fields).Error("gRPC request failed")
		} else {
			logger.WithFields(fields).Info("gRPC request completed")
		}

		return resp, err
	}
}

// LoggingStreamInterceptor logs gRPC streaming requests
func LoggingStreamInterceptor(logger *logrus.Logger) grpc.StreamServerInterceptor {
	return func(
		srv interface{},
		stream grpc.ServerStream,
		info *grpc.StreamServerInfo,
		handler grpc.StreamHandler,
	) error {
		start := time.Now()

		logger.WithFields(logrus.Fields{
			"method": info.FullMethod,
			"type":   "stream",
		}).Info("gRPC stream started")

		// Call the handler
		err := handler(srv, stream)

		// Log the result
		duration := time.Since(start)
		fields := logrus.Fields{
			"method":   info.FullMethod,
			"type":     "stream",
			"duration": duration,
		}

		if err != nil {
			st, _ := status.FromError(err)
			fields["error"] = st.Message()
			fields["code"] = st.Code()
			logger.WithFields(fields).Error("gRPC stream failed")
		} else {
			logger.WithFields(fields).Info("gRPC stream completed")
		}

		return err
	}
}

// RecoveryUnaryInterceptor recovers from panics in unary handlers
func RecoveryUnaryInterceptor(logger *logrus.Logger) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req interface{},
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (resp interface{}, err error) {
		defer func() {
			if r := recover(); r != nil {
				logger.WithFields(logrus.Fields{
					"method": info.FullMethod,
					"panic":  r,
				}).Error("gRPC handler panicked")
				err = status.Error(codes.Internal, "internal server error")
			}
		}()

		return handler(ctx, req)
	}
}

// RecoveryStreamInterceptor recovers from panics in stream handlers
func RecoveryStreamInterceptor(logger *logrus.Logger) grpc.StreamServerInterceptor {
	return func(
		srv interface{},
		stream grpc.ServerStream,
		info *grpc.StreamServerInfo,
		handler grpc.StreamHandler,
	) (err error) {
		defer func() {
			if r := recover(); r != nil {
				logger.WithFields(logrus.Fields{
					"method": info.FullMethod,
					"panic":  r,
				}).Error("gRPC stream handler panicked")
				err = status.Error(codes.Internal, "internal server error")
			}
		}()

		return handler(srv, stream)
	}
}
