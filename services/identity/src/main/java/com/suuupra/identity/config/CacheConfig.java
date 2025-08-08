package com.suuupra.identity.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.actuate.metrics.cache.CacheMetricsRegistrar;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.List;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager(CacheMetricsRegistrar cacheMetricsRegistrar) {
        SimpleCacheManager manager = new SimpleCacheManager();
        Caffeine<Object, Object> spec = Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(Duration.ofMinutes(5))
            .recordStats();
        CaffeineCache permChecks = new CaffeineCache("permChecks", spec.build());
        cacheMetricsRegistrar.bindCacheToRegistry(permChecks);
        manager.setCaches(List.of(permChecks));
        return manager;
    }

    @Bean
    public CacheMetricsRegistrar cacheMetricsRegistrar(MeterRegistry registry) {
        return new CacheMetricsRegistrar(registry);
    }
}


