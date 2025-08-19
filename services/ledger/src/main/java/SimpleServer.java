import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.time.Instant;

public class SimpleServer {
    
    private static final String SERVICE_NAME = "ledger";
    private static final long START_TIME = System.currentTimeMillis();
    
    static class HealthHandler implements HttpHandler {
        public void handle(HttpExchange exchange) throws IOException {
            setCorsHeaders(exchange);
            
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(200, 0);
                exchange.close();
                return;
            }
            
            String path = exchange.getRequestURI().getPath();
            String response;
            
            if ("/health".equals(path)) {
                response = String.format(
                    "{\"status\":\"healthy\",\"service\":\"%s\",\"timestamp\":\"%s\",\"uptime\":%d}",
                    SERVICE_NAME, Instant.now().toString(), System.currentTimeMillis() - START_TIME
                );
            } else if ("/ready".equals(path)) {
                response = String.format(
                    "{\"status\":\"ready\",\"service\":\"%s\",\"timestamp\":\"%s\",\"uptime\":%d}",
                    SERVICE_NAME, Instant.now().toString(), System.currentTimeMillis() - START_TIME
                );
            } else if ("/metrics".equals(path)) {
                response = "# HELP http_requests_total Total HTTP requests\n# TYPE http_requests_total counter\nhttp_requests_total 1\n";
                exchange.getResponseHeaders().set("Content-Type", "text/plain");
                exchange.sendResponseHeaders(200, response.length());
                OutputStream os = exchange.getResponseBody();
                os.write(response.getBytes());
                os.close();
                return;
            } else {
                response = String.format(
                    "{\"message\":\"%s is running\",\"service\":\"%s\",\"timestamp\":\"%s\",\"path\":\"%s\",\"method\":\"%s\",\"version\":\"1.0.0\"}",
                    SERVICE_NAME, SERVICE_NAME, Instant.now().toString(), path, exchange.getRequestMethod()
                );
            }
            
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length());
            OutputStream os = exchange.getResponseBody();
            os.write(response.getBytes());
            os.close();
        }
        
        private void setCorsHeaders(HttpExchange exchange) {
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        }
    }
    
    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8086"));
        String host = System.getenv().getOrDefault("HOST", "0.0.0.0");
        
        HttpServer server = HttpServer.create(new InetSocketAddress(host, port), 0);
        server.createContext("/", new HealthHandler());
        server.setExecutor(null);
        
        System.out.printf("%s running on http://%s:%d%n", SERVICE_NAME, host, port);
        System.out.printf("Health: http://%s:%d/health%n", host, port);
        
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("Shutting down gracefully...");
            server.stop(0);
        }));
        
        server.start();
    }
}
