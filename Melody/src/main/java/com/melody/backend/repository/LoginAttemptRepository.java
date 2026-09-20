package com.melody.backend.repository;

import com.melody.backend.entity.LoginAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LoginAttemptRepository
        extends JpaRepository<LoginAttempt, Long> {
}