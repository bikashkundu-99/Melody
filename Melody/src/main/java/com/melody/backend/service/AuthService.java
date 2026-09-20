package com.melody.backend.service;

import com.melody.backend.dto.AuthResponse;
import com.melody.backend.dto.ForgotPasswordRequest;
import com.melody.backend.dto.LoginRequest;
import com.melody.backend.dto.RegisterRequest;
import com.melody.backend.entity.LoginAttempt;
import com.melody.backend.entity.PasswordResetToken;
import com.melody.backend.entity.User;
import com.melody.backend.repository.LoginAttemptRepository;
import com.melody.backend.repository.PasswordResetTokenRepository;
import com.melody.backend.repository.UserRepository;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;

@Service
public class AuthService {

    private final UserRepository userRepository;

    private final PasswordResetTokenRepository
            passwordResetTokenRepository;

    private final LoginAttemptRepository
            loginAttemptRepository;

    private final JwtService jwtService;

    private final BCryptPasswordEncoder passwordEncoder;

    private final SecureRandom secureRandom =
            new SecureRandom();

    public AuthService(
            UserRepository userRepository,
            PasswordResetTokenRepository passwordResetTokenRepository,
            LoginAttemptRepository loginAttemptRepository,
            JwtService jwtService
    ) {

        this.userRepository = userRepository;

        this.passwordResetTokenRepository =
                passwordResetTokenRepository;

        this.loginAttemptRepository =
                loginAttemptRepository;

        this.jwtService = jwtService;

        this.passwordEncoder =
                new BCryptPasswordEncoder();
    }

    // =====================================================
    // REGISTER
    // =====================================================

    public AuthResponse register(
            RegisterRequest request
    ) {

        String name =
                request.getName().trim();

        String email =
                request.getEmail()
                        .trim()
                        .toLowerCase();

        String password =
                request.getPassword();

        if (userRepository.existsByEmailIgnoreCase(email)) {

            throw new RuntimeException(
                    "An account with this email already exists."
            );
        }

        User user = new User();

        user.setName(name);

        user.setEmail(email);

        user.setPasswordHash(
                passwordEncoder.encode(password)
        );

        user.setRole("USER");

        user.setIsActive(true);

        User savedUser =
                userRepository.save(user);

        return new AuthResponse(
                null,
                savedUser.getId(),
                savedUser.getName(),
                savedUser.getEmail(),
                "Account created successfully."
        );
    }

    // =====================================================
    // LOGIN
    // =====================================================

    public AuthResponse login(
            LoginRequest request,
            String ipAddress
    ) {

        String email =
                request.getEmail()
                        .trim()
                        .toLowerCase();

        String password =
                request.getPassword();

        User user =
                userRepository
                        .findByEmailIgnoreCase(email)
                        .orElse(null);

        // User doesn't exist
        if (user == null) {

            saveLoginAttempt(
                    email,
                    ipAddress,
                    false
            );

            throw new RuntimeException(
                    "Invalid email or password."
            );
        }

        // Account disabled
        if (!Boolean.TRUE.equals(
                user.getIsActive()
        )) {

            saveLoginAttempt(
                    email,
                    ipAddress,
                    false
            );

            throw new RuntimeException(
                    "Your account is inactive."
            );
        }

        // Password doesn't match
        if (!passwordEncoder.matches(
                password,
                user.getPasswordHash()
        )) {

            saveLoginAttempt(
                    email,
                    ipAddress,
                    false
            );

            throw new RuntimeException(
                    "Invalid email or password."
            );
        }

        // Successful login
        saveLoginAttempt(
                email,
                ipAddress,
                true
        );

        String token =
                jwtService.generateToken(user);

        return new AuthResponse(
                token,
                user.getId(),
                user.getName(),
                user.getEmail(),
                "Login successful."
        );
    }

    // =====================================================
    // FORGOT PASSWORD
    // =====================================================

    public String forgotPassword(
            ForgotPasswordRequest request
    ) {

        String email =
                request.getEmail()
                        .trim()
                        .toLowerCase();

        User user =
                userRepository
                        .findByEmailIgnoreCase(email)
                        .orElse(null);

        /*
         * We intentionally return the same message
         * whether the email exists or not.
         */

        if (user == null) {

            return "If an account exists with this email, " +
                    "a password reset link has been sent.";
        }

        // Generate secure random token
        byte[] randomBytes =
                new byte[32];

        secureRandom.nextBytes(randomBytes);

        String rawToken =
                Base64.getUrlEncoder()
                        .withoutPadding()
                        .encodeToString(randomBytes);

        String tokenHash =
                sha256(rawToken);

        PasswordResetToken resetToken =
                new PasswordResetToken();

        resetToken.setUser(user);

        resetToken.setTokenHash(tokenHash);

        resetToken.setExpiresAt(
                LocalDateTime.now()
                        .plusMinutes(30)
        );

        resetToken.setUsed(false);

        passwordResetTokenRepository.save(
                resetToken
        );

        /*
         * Email integration will be added next.
         *
         * For local development we print the
         * reset URL in the backend console.
         */

        String resetUrl =
                "http://localhost:5500/reset-password.html?token="
                        + rawToken;

        System.out.println(
                "======================================"
        );

        System.out.println(
                "PASSWORD RESET URL:"
        );

        System.out.println(
                resetUrl
        );

        System.out.println(
                "======================================"
        );

        return "If an account exists with this email, " +
                "a password reset link has been sent.";
    }

    // =====================================================
    // SAVE LOGIN ATTEMPT
    // =====================================================

    private void saveLoginAttempt(
            String email,
            String ipAddress,
            boolean success
    ) {

        LoginAttempt attempt =
                new LoginAttempt();

        attempt.setEmail(email);

        attempt.setIpAddress(ipAddress);

        attempt.setSuccess(success);

        loginAttemptRepository.save(attempt);
    }

    // =====================================================
    // SHA-256
    // =====================================================

    private String sha256(
            String value
    ) {

        try {

            MessageDigest digest =
                    MessageDigest.getInstance("SHA-256");

            byte[] hash =
                    digest.digest(
                            value.getBytes(
                                    StandardCharsets.UTF_8
                            )
                    );

            StringBuilder hex =
                    new StringBuilder();

            for (byte b : hash) {

                hex.append(
                        String.format(
                                "%02x",
                                b
                        )
                );
            }

            return hex.toString();

        } catch (NoSuchAlgorithmException e) {

            throw new IllegalStateException(
                    "SHA-256 algorithm not available.",
                    e
            );
        }
    }
}