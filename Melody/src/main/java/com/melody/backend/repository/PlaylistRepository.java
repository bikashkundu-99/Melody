package com.melody.backend.repository;

import com.melody.backend.entity.Playlist;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PlaylistRepository extends JpaRepository<Playlist, Long> {
    List<Playlist> findByUser_IdOrderByCreatedAtDesc(Long userId);
    Optional<Playlist> findByIdAndUser_Id(Long id, Long userId);
}
