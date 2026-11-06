package com.floodguard.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class AppConfig {
    /** Shared HTTP client (weather API + ML service) with short timeouts so a slow upstream never hangs a request. */
    @Bean
    RestClient restClient() {
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(3000);
        f.setReadTimeout(6000);
        return RestClient.builder().requestFactory(f).build();
    }
}
