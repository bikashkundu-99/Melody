package com.melody.backend.controller;

import com.melody.backend.entity.Song;
import com.melody.backend.repository.SongRepository;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/songs")
@CrossOrigin
public class MusicController {

    private final SongRepository songRepository;

    public MusicController(SongRepository songRepository) {
        this.songRepository = songRepository;
    }

    @GetMapping
    public List<Song> getAllSongs() {
        return songRepository.findByIsActiveTrue();
    }

    @GetMapping("/search")
    public List<Song> searchSongs(@RequestParam String q) {

        if (q == null || q.trim().isEmpty()) {
            return songRepository.findByIsActiveTrue();
        }

        String searchText = q.trim();

        return songRepository
                .findByTitleContainingIgnoreCaseOrArtistContainingIgnoreCaseOrAlbumContainingIgnoreCase(
                        searchText,
                        searchText,
                        searchText
                );
    }

    @GetMapping("/artist")
    public List<Song> getSongsByArtist(@RequestParam String name) {
        if (name == null || name.isBlank()) return List.of();
        return songRepository.findByArtistContainingIgnoreCaseAndIsActiveTrueOrderByTitleAsc(name.trim());
    }

    @GetMapping("/{id}")
    public Song getSong(@PathVariable Long id) {

        return songRepository
                .findById(id)
                .orElseThrow(() ->
                        new RuntimeException("Song not found"));
    }
}
