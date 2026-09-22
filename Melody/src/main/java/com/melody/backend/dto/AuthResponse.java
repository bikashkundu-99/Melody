package com.melody.backend.dto;

import java.time.LocalDateTime;

public class AuthResponse {

    private String token;
    private Long userId;
    private String name;
    private String email;
    private String message;
    private LocalDateTime createdAt;

    public AuthResponse() {
    }

    public AuthResponse(
            String token,
            Long userId,
            String name,
            String email,
            LocalDateTime createdAt,
            String message
    ) {
        this.token = token;
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.createdAt = createdAt;
        this.message = message;
    }

    public String getToken() {
        return token;
    }

    public Long getUserId() {
        return userId;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

    public String getMessage() {
        return message;
    }
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}