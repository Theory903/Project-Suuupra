#!/bin/bash

# Generate gRPC Go code from protobuf definitions
set -e

echo "🔄 Generating gRPC Go code from protobuf definitions..."

# Create generated directories
mkdir -p generated/banksim
mkdir -p generated/upicore

# Generate Bank Simulator gRPC code
protoc --go_out=generated/banksim --go_opt=paths=source_relative \
       --go-grpc_out=generated/banksim --go-grpc_opt=paths=source_relative \
       proto/bank_simulator.proto

# Generate UPI Core gRPC code
protoc --go_out=generated/upicore --go_opt=paths=source_relative \
       --go-grpc_out=generated/upicore --go-grpc_opt=paths=source_relative \
       proto/upi_core.proto

echo "✅ gRPC Go code generation completed!"
echo "📁 Generated files:"
echo "  - generated/banksim/bank_simulator.pb.go"
echo "  - generated/banksim/bank_simulator_grpc.pb.go"
echo "  - generated/upicore/upi_core.pb.go"
echo "  - generated/upicore/upi_core_grpc.pb.go"