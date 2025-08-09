package com.suuupra.identity.abac;

import com.fasterxml.jackson.databind.JsonNode;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

@Component
public class CelPolicyEngine implements PolicyDecisionPoint {

    private final PolicyService policyService;
    private final MeterRegistry meterRegistry;
    private final Timer policyEvalTimer;

    public CelPolicyEngine(PolicyService policyService, MeterRegistry meterRegistry) {
        this.policyService = policyService;
        this.meterRegistry = meterRegistry;
        this.policyEvalTimer = Timer.builder("policy_eval_latency_ms")
            .publishPercentileHistogram()
            .description("Latency of policy evaluation")
            .register(meterRegistry);
    }

    @Override
    public boolean allow(Authentication authentication, String tenantId, String resource, String action) {
        long start = System.nanoTime();
        boolean decision = true;
        try {
            List<JsonNode> policies = policyService.loadEnabledPoliciesForTenant(tenantId);
            if (policies.isEmpty()) return true;

            for (JsonNode p : policies) {
                String mode = p.path("__mode").asText("enforce");
                String pr = p.path("resource").asText("");
                String pa = p.path("action").asText("");
                String effect = p.path("effect").asText("allow");
                if ((pr.isEmpty() || pr.equals(resource)) && (pa.isEmpty() || pa.equalsIgnoreCase(action))) {
                    if ("deny".equalsIgnoreCase(effect)) {
                        if ("dry-run".equalsIgnoreCase(mode)) {
                            // shadow deny
                        } else {
                            decision = false;
                            break;
                        }
                    }
                }
            }
            return decision;
        } finally {
            policyEvalTimer.record(Duration.ofNanos(System.nanoTime() - start));
            meterRegistry.counter("authz_decisions_total", "decision", decision ? "allow" : "deny").increment();
        }
    }
}


