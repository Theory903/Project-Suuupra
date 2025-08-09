package com.suuupra.identity.mfa;

import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

@Component
public class MfaMetrics {
    private final MeterRegistry registry;
    public MfaMetrics(MeterRegistry registry) { this.registry = registry; }
    public void incEnroll() { registry.counter("mfa_enrollments_total").increment(); }
    public void incVerify(boolean ok) { registry.counter("mfa_verifications_total", "result", ok ? "success" : "fail").increment(); }
    public void incBackupGen(int n) { registry.counter("backup_codes_generated_total").increment(n); }
    public void incBackupUse(boolean ok) { registry.counter("backup_codes_consumed_total", "result", ok ? "success" : "fail").increment(); }
    public void incStepUpRequired() { registry.counter("stepup_required_total").increment(); }
    public void incStepUpSatisfied() { registry.counter("stepup_satisfied_total").increment(); }
}


