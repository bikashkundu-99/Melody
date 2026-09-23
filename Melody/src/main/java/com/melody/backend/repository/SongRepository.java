package com.melody.backend.repository;

import com.melody.backend.entity.Song;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SongRepository extends JpaRepository<Song, Long> {

    List<Song> findByIsActiveTrue();

    List<Song> findByArtistIgnoreCaseAndIsActiveTrueOrderByTitleAsc(String artist);

    List<Song> findByTitleContainingIgnoreCaseOrArtistContainingIgnoreCaseOrAlbumContainingIgnoreCase(
            String title,
            String artist,
            String album
    );
}
