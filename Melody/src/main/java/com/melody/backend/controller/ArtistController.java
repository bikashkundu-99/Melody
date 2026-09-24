package com.melody.backend.controller;

import com.melody.backend.entity.Artist;
import com.melody.backend.repository.ArtistRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/artists")
public class ArtistController {

    private final ArtistRepository artists;

    public ArtistController(ArtistRepository artists) {
        this.artists = artists;
    }

    @GetMapping
    public List<Artist> getArtists() {
        return artists.findAllByOrderByNameAsc();
    }

    @GetMapping("/lookup")
    public Artist getArtist(@RequestParam String name) {
        return artists.findByNameIgnoreCase(name.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Artist not found"));
    }
}
