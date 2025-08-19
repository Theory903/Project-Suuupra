-- Industry-grade wrk Lua script for comprehensive API testing

-- Service endpoints with weights for realistic traffic distribution
local services = {
    {path = "/healthz", weight = 15, name = "api_gateway"},
    {path = "/identity/actuator/health", weight = 12, name = "identity"},
    {path = "/payments/health", weight = 15, name = "payments"},
    {path = "/bank-simulator/api/banks", weight = 12, name = "banking"},
    {path = "/upi-core/health", weight = 10, name = "upi"},
    {path = "/content/health", weight = 10, name = "content"},
    {path = "/live-classes/health", weight = 8, name = "live_classes"},
    {path = "/commerce/health", weight = 8, name = "commerce"},
    {path = "/analytics/health", weight = 5, name = "analytics"},
    {path = "/notifications/health", weight = 5, name = "notifications"},
    {path = "/admin/health", weight = 3, name = "admin"},
    {path = "/llm-tutor/health", weight = 3, name = "llm_tutor"},
    {path = "/recommendations/health", weight = 2, name = "recommendations"}
}

-- Calculate total weight for weighted random selection
local total_weight = 0
for _, service in ipairs(services) do
    total_weight = total_weight + service.weight
end

-- Performance counters
local request_count = 0
local error_count = 0
local response_times = {}

-- Setup function called once per thread
function setup(thread)
    thread:set("id", math.random(1000000))
end

-- Request function called for each request
function request()
    -- Weighted random service selection
    local random = math.random() * total_weight
    local selected_service = services[1] -- default
    
    for _, service in ipairs(services) do
        random = random - service.weight
        if random <= 0 then
            selected_service = service
            break
        end
    end
    
    -- Industry-grade headers
    wrk.headers["User-Agent"] = "wrk-IndustryGrade/1.0"
    wrk.headers["X-Test-Type"] = "Industry-Load-Test"
    wrk.headers["X-Service"] = selected_service.name
    wrk.headers["Accept"] = "application/json"
    wrk.headers["Connection"] = "keep-alive"
    
    return wrk.format("GET", selected_service.path)
end

-- Response function called for each response
function response(status, headers, body)
    request_count = request_count + 1
    
    if status ~= 200 then
        error_count = error_count + 1
    end
    
    -- Track response times (simplified)
    table.insert(response_times, wrk.latency)
end

-- Done function called when test completes
function done(summary, latency, requests)
    print("\n🏆 Industry-Grade wrk Test Results")
    print("==================================")
    print(string.format("📊 Total Requests: %d", summary.requests))
    print(string.format("✅ Successful: %d (%.1f%%)", summary.requests - error_count, (summary.requests - error_count) / summary.requests * 100))
    print(string.format("❌ Errors: %d (%.1f%%)", error_count, error_count / summary.requests * 100))
    print(string.format("⚡ Requests/sec: %.2f", summary.requests / (summary.duration / 1000000)))
    print(string.format("⏱️  Avg Latency: %.2fms", latency.mean / 1000))
    print(string.format("📈 95th Percentile: %.2fms", latency:percentile(95) / 1000))
    print(string.format("📈 99th Percentile: %.2fms", latency:percentile(99) / 1000))
    print(string.format("🔥 Max Latency: %.2fms", latency.max / 1000))
    
    -- Performance assessment
    local success_rate = (summary.requests - error_count) / summary.requests * 100
    local avg_latency = latency.mean / 1000
    
    if success_rate >= 99 and avg_latency < 100 then
        print("\n🏆 EXCELLENT: System performance exceeds industry standards!")
    elseif success_rate >= 95 and avg_latency < 500 then
        print("\n✅ GOOD: System meets industry performance requirements")
    elseif success_rate >= 90 and avg_latency < 1000 then
        print("\n⚠️  WARNING: System under stress, optimization recommended")
    else
        print("\n🚨 CRITICAL: System performance below industry standards")
    end
end
