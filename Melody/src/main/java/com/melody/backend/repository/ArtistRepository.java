package com.melody.backend.repository;

import com.melody.backend.entity.Artist;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ArtistRepository extends JpaRepository<Artist, Long> {
    List<Artist> findAllByOrderByNameAsc();
    Optional<Artist> findByNameIgnoreCase(String name);
}
