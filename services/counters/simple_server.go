package main

import (
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"
)

type Response struct {
    Message   string `json:"message"`
    Service   string `json:"service"`
    Timestamp string `json:"timestamp"`
    Path      string `json:"path,omitempty"`
    Method    string `json:"method,omitempty"`
    Version   string `json:"version"`
}

type HealthResponse struct {
    Status    string `json:"status"`
    Service   string `json:"service"`
    Timestamp string `json:"timestamp"`
    Uptime    int64  `json:"uptime"`
}

var startTime = time.Now()

func corsHandler(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Access-Control-Allow-Origin", "*")
        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
        
        if r.Method == "OPTIONS" {
            w.WriteHeader(http.StatusOK)
            return
        }
        
        next(w, r)
    }
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
    response := HealthResponse{
        Status:    "healthy",
        Service:   "counters",
        Timestamp: time.Now().Format(time.RFC3339),
        Uptime:    time.Since(startTime).Milliseconds(),
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func readyHandler(w http.ResponseWriter, r *http.Request) {
    response := HealthResponse{
        Status:    "ready",
        Service:   "counters",
        Timestamp: time.Now().Format(time.RFC3339),
        Uptime:    time.Since(startTime).Milliseconds(),
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "text/plain")
    fmt.Fprintf(w, "# HELP http_requests_total Total HTTP requests\n# TYPE http_requests_total counter\nhttp_requests_total 1\n")
}

func defaultHandler(w http.ResponseWriter, r *http.Request) {
    response := Response{
        Message:   "counters is running",
        Service:   "counters",
        Timestamp: time.Now().Format(time.RFC3339),
        Path:      r.URL.Path,
        Method:    r.Method,
        Version:   "1.0.0",
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func main() {
    port := os.Getenv("PORT")
    if port == "" {
        port = "8098"
    }
    
    host := os.Getenv("HOST")
    if host == "" {
        host = "0.0.0.0"
    }
    
    mux := http.NewServeMux()
    mux.HandleFunc("/health", corsHandler(healthHandler))
    mux.HandleFunc("/ready", corsHandler(readyHandler))
    mux.HandleFunc("/metrics", corsHandler(metricsHandler))
    mux.HandleFunc("/", corsHandler(defaultHandler))
    
    server := &http.Server{
        Addr:    host + ":" + port,
        Handler: mux,
    }
    
    // Graceful shutdown
    go func() {
        sigChan := make(chan os.Signal, 1)
        signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT)
        <-sigChan
        log.Println("Shutting down gracefully...")
        server.Close()
    }()
    
    log.Printf("counters running on http://%s:%s", host, port)
    log.Printf("Health: http://%s:%s/health", host, port)
    
    if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
        log.Fatal("Server failed:", err)
    }
}
