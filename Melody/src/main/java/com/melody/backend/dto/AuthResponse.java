package com.melody.backend.dto;

public class AuthResponse {

    private String token;
    private Long userId;
    private String name;
    private String email;
    private String message;

    public AuthResponse() {
    }

    public AuthResponse(
            String token,
            Long userId,
            String name,
            String email,
            String message
    ) {
        this.token = token;
        this.userId = userId;
        this.name = name;
        this.email = email;
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
}