package com.suuupra.identity.common.util;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class TenantContextFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
        try {
            HttpServletRequest req = (HttpServletRequest) request;
            String tenant = req.getHeader("X-Tenant");
            if (tenant == null || tenant.isBlank()) {
                // Fallbacks could include parsing JWT claims if needed
            }
            if (tenant != null && !tenant.isBlank()) {
                TenantContext.setTenant(tenant);
            }
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}
