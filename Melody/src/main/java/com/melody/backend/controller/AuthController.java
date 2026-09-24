package com.melody.backend.controller;

import com.melody.backend.dto.AuthResponse;
import com.melody.backend.dto.ForgotPasswordRequest;
import com.melody.backend.dto.LoginRequest;
import com.melody.backend.dto.RegisterRequest;
import com.melody.backend.service.AuthService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(
        origins = {
                "http://localhost:5500",
                "http://127.0.0.1:5500",
        }
)
public class AuthController {

    private final AuthService authService;

    public AuthController(
            AuthService authService
    ) {

        this.authService = authService;
    }

    // =====================================================
    // REGISTER
    // =====================================================

    @PostMapping("/register")
    public ResponseEntity<?> register(
            @Valid @RequestBody RegisterRequest request
    ) {

        try {

            AuthResponse response =
                    authService.register(request);

            return ResponseEntity.ok(response);

        } catch (RuntimeException e) {

            return ResponseEntity
                    .badRequest()
                    .body(
                            Map.of(
                                    "message",
                                    e.getMessage()
                            )
                    );
        }
    }

    // =====================================================
    // LOGIN
    // =====================================================

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest)
    {
        try {
            String ipAddress = httpRequest.getRemoteAddr();

            AuthResponse response =
                    authService.login(
                            request,
                            ipAddress
                    );

            return ResponseEntity.ok(response);

        } catch (RuntimeException e) {

            return ResponseEntity
                    .status(401)
                    .body(
                            Map.of(
                                    "message",
                                    e.getMessage()
                            )
                    );
        }
    }

    // =====================================================
    // FORGOT PASSWORD
    // =====================================================

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(
            @Valid
            @RequestBody
            ForgotPasswordRequest request
    ) {

        String message =
                authService.forgotPassword(
                        request
                );

        return ResponseEntity.ok(
                Map.of(
                        "message",
                        message
                )
        );
    }
}
