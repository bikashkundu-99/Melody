package com.melody.backend.repository;

import com.melody.backend.entity.RecentlyPlayed;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import java.util.List;
import java.time.LocalDateTime;

public interface RecentlyPlayedRepository extends JpaRepository<RecentlyPlayed, Long> {
    @EntityGraph(attributePaths = "song")
    List<RecentlyPlayed> findByUser_IdOrderByPlayedAtDesc(Long userId);

    @EntityGraph(attributePaths = "song")
    List<RecentlyPlayed> findByUser_IdAndPlayedAtGreaterThanEqualOrderByPlayedAtDesc(Long userId, LocalDateTime since);
}
