import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.io.BufferedReader;
import java.net.InetSocketAddress;
import java.time.Instant;
import java.sql.*;
import java.security.MessageDigest;
import java.util.UUID;
import javax.crypto.spec.SecretKeySpec;
import javax.crypto.Mac;
import java.util.Base64;

public class SimpleServer {
    
    private static final String SERVICE_NAME = "identity";
    private static final long START_TIME = System.currentTimeMillis();
    private static Connection dbConnection;
    
    static class HealthHandler implements HttpHandler {
        public void handle(HttpExchange exchange) throws IOException {
            setCorsHeaders(exchange);
            
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(200, 0);
                exchange.close();
                return;
            }
            
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();
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
            } else if ("/api/v1/auth/register".equals(path) && "POST".equals(method)) {
                response = handleRegister(exchange);
            } else if ("/api/v1/auth/login".equals(path) && "POST".equals(method)) {
                response = handleLogin(exchange);
            } else {
                response = String.format(
                    "{\"message\":\"%s is running\",\"service\":\"%s\",\"timestamp\":\"%s\",\"path\":\"%s\",\"method\":\"%s\",\"version\":\"1.0.0\"}",
                    SERVICE_NAME, SERVICE_NAME, Instant.now().toString(), path, method
                );
            }
            
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            
            // Handle ERROR responses with custom status codes
            if (response.startsWith("ERROR:")) {
                String[] parts = response.split(":", 3);
                int statusCode = Integer.parseInt(parts[1]);
                String body = parts[2];
                exchange.sendResponseHeaders(statusCode, body.length());
                OutputStream os = exchange.getResponseBody();
                os.write(body.getBytes());
                os.close();
            } else {
                exchange.sendResponseHeaders(200, response.length());
                OutputStream os = exchange.getResponseBody();
                os.write(response.getBytes());
                os.close();
            }
        }
        
        private String handleRegister(HttpExchange exchange) throws IOException {
            try {
                String requestBody = getRequestBody(exchange);
                // Simple JSON parsing for email and password
                String email = extractJsonField(requestBody, "email");
                String password = extractJsonField(requestBody, "password");
                
                if (email == null || password == null) {
                    exchange.sendResponseHeaders(400, 0);
                    return "{\"success\":false,\"message\":\"Email and password are required\"}";
                }
                
                // Check if user exists
                try (PreparedStatement stmt = dbConnection.prepareStatement("SELECT COUNT(*) FROM users WHERE email = ?")) {
                    stmt.setString(1, email);
                    ResultSet rs = stmt.executeQuery();
                    if (rs.next() && rs.getInt(1) > 0) {
                        exchange.sendResponseHeaders(409, 0);
                        return "{\"success\":false,\"message\":\"User already exists\"}";
                    }
                }
                
                // Create user
                String userId = UUID.randomUUID().toString();
                String passwordHash = hashPassword(password);
                
                try (PreparedStatement stmt = dbConnection.prepareStatement(
                    "INSERT INTO users (id, email, password_hash, status, created_at, updated_at) VALUES (?::uuid, ?, ?, 'ACTIVE', NOW(), NOW())")) {
                    stmt.setString(1, userId);
                    stmt.setString(2, email);
                    stmt.setString(3, passwordHash);
                    stmt.executeUpdate();
                }
                
                // Assign default USER role
                try (PreparedStatement stmt = dbConnection.prepareStatement(
                    "INSERT INTO user_roles (user_id, role_id) SELECT ?::uuid, id FROM roles WHERE name = 'USER'")) {
                    stmt.setString(1, userId);
                    stmt.executeUpdate();
                }
                
                String token = generateJWT(userId, email, new String[]{"USER"});
                
                return String.format(
                    "{\"success\":true,\"message\":\"Registration successful\",\"token\":\"%s\",\"user\":{\"id\":\"%s\",\"email\":\"%s\",\"role\":\"USER\"}}",
                    token, userId, email
                );
                
            } catch (Exception e) {
                System.err.println("Registration error: " + e.getMessage());
                return "ERROR:500:{\"success\":false,\"message\":\"Registration failed\"}";
            }
        }
        
        private String handleLogin(HttpExchange exchange) throws IOException {
            try {
                String requestBody = getRequestBody(exchange);
                String email = extractJsonField(requestBody, "email");
                String password = extractJsonField(requestBody, "password");
                
                if (email == null || password == null) {
                    return "ERROR:400:{\"success\":false,\"message\":\"Email and password are required\"}";
                }
                
                // Find user
                try (PreparedStatement stmt = dbConnection.prepareStatement(
                    "SELECT u.id, u.email, u.password_hash, u.status FROM users u WHERE u.email = ?")) {
                    stmt.setString(1, email);
                    ResultSet rs = stmt.executeQuery();
                    
                    if (!rs.next()) {
                        return "ERROR:401:{\"success\":false,\"message\":\"Invalid credentials\"}";
                    }
                    
                    String userId = rs.getString("id");
                    String storedHash = rs.getString("password_hash");
                    String status = rs.getString("status");
                    
                    if (!"ACTIVE".equals(status)) {
                        return "ERROR:401:{\"success\":false,\"message\":\"Account is not active\"}";
                    }
                    
                    if (!verifyPassword(password, storedHash)) {
                        return "ERROR:401:{\"success\":false,\"message\":\"Invalid credentials\"}";
                    }
                    
                    // Get user roles
                    String[] roles = getUserRoles(userId);
                    String token = generateJWT(userId, email, roles);
                    
                    return String.format(
                        "{\"success\":true,\"message\":\"Login successful\",\"token\":\"%s\",\"user\":{\"id\":\"%s\",\"email\":\"%s\",\"roles\":[%s]}}",
                        token, userId, email, String.join(",", roles)
                    );
                }
                
            } catch (Exception e) {
                System.err.println("Login error: " + e.getMessage());
                return "ERROR:500:{\"success\":false,\"message\":\"Login failed\"}";
            }
        }
        
        private void setCorsHeaders(HttpExchange exchange) {
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        }
    }
    
    // Helper methods
    private static void initDatabase() {
        String dbUrl = System.getenv().getOrDefault("POSTGRES_HOST", "localhost");
        String dbPort = System.getenv().getOrDefault("POSTGRES_PORT", "5432");
        String dbName = System.getenv().getOrDefault("POSTGRES_DATABASE", "identity");
        String dbUser = System.getenv().getOrDefault("POSTGRES_USER", "postgres");
        String dbPassword = System.getenv().getOrDefault("POSTGRES_PASSWORD", "postgres123");
        
        try {
            Class.forName("org.postgresql.Driver");
            String connectionString = String.format("jdbc:postgresql://%s:%s/%s", dbUrl, dbPort, dbName);
            dbConnection = DriverManager.getConnection(connectionString, dbUser, dbPassword);
            System.out.println("Database connected successfully");
        } catch (Exception e) {
            System.err.println("Failed to connect to database: " + e.getMessage());
        }
    }
    
    private static String getRequestBody(HttpExchange exchange) throws IOException {
        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(exchange.getRequestBody()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
        }
        return body.toString();
    }
    
    private static String extractJsonField(String json, String field) {
        String pattern = "\"" + field + "\"\\s*:\\s*\"([^\"]+)\"";
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern);
        java.util.regex.Matcher m = p.matcher(json);
        return m.find() ? m.group(1) : null;
    }
    
    private static String hashPassword(String password) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] hash = md.digest(password.getBytes("UTF-8"));
        return Base64.getEncoder().encodeToString(hash);
    }
    
    private static boolean verifyPassword(String password, String hash) throws Exception {
        return hash.equals(hashPassword(password));
    }
    
    private static String[] getUserRoles(String userId) throws SQLException {
        try (PreparedStatement stmt = dbConnection.prepareStatement(
            "SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ?::uuid")) {
            stmt.setString(1, userId);
            ResultSet rs = stmt.executeQuery();
            java.util.List<String> roles = new java.util.ArrayList<>();
            while (rs.next()) {
                roles.add("\"" + rs.getString("name") + "\"");
            }
            return roles.toArray(new String[0]);
        }
    }
    
    private static String generateJWT(String userId, String email, String[] roles) {
        try {
            String jwtSecret = System.getenv().getOrDefault("JWT_SECRET", "dev_jwt_secret_key_change_in_production");
            long now = System.currentTimeMillis() / 1000;
            long exp = now + 3600; // 1 hour expiry
            
            // Simple JWT payload
            String payload = String.format(
                "{\"sub\":\"%s\",\"email\":\"%s\",\"roles\":[%s],\"iat\":%d,\"exp\":%d}",
                userId, email, String.join(",", roles), now, exp
            );
            
            String header = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
            
            String encodedHeader = Base64.getUrlEncoder().withoutPadding().encodeToString(header.getBytes());
            String encodedPayload = Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes());
            
            String data = encodedHeader + "." + encodedPayload;
            
            // Generate signature
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(jwtSecret.getBytes(), "HmacSHA256");
            mac.init(secretKey);
            byte[] signatureBytes = mac.doFinal(data.getBytes());
            String signature = Base64.getUrlEncoder().withoutPadding().encodeToString(signatureBytes);
            
            return data + "." + signature;
        } catch (Exception e) {
            System.err.println("JWT generation failed: " + e.getMessage());
            return "invalid-token";
        }
    }
    
    public static void main(String[] args) throws IOException {
        // Initialize database connection
        initDatabase();
        
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8081"));
        String host = System.getenv().getOrDefault("HOST", "0.0.0.0");
        
        HttpServer server = HttpServer.create(new InetSocketAddress(host, port), 0);
        server.createContext("/", new HealthHandler());
        server.setExecutor(null);
        
        System.out.printf("%s running on http://%s:%d%n", SERVICE_NAME, host, port);
        System.out.printf("Health: http://%s:%d/health%n", host, port);
        
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("Shutting down gracefully...");
            try {
                if (dbConnection != null && !dbConnection.isClosed()) {
                    dbConnection.close();
                }
            } catch (SQLException e) {
                System.err.println("Error closing database connection: " + e.getMessage());
            }
            server.stop(0);
        }));
        
        server.start();
    }
}
