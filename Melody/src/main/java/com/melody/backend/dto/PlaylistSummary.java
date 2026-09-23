package com.melody.backend.dto;

import java.time.LocalDateTime;

public record PlaylistSummary(
        Long id,
        String name,
        String description,
        String privacy,
        Boolean collaborate,
        long songCount,
        LocalDateTime createdAt
) { }
