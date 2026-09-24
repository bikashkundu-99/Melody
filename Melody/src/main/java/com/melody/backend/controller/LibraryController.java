package com.melody.backend.controller;

import com.melody.backend.entity.LikedSong;
import com.melody.backend.entity.RecentlyPlayed;
import com.melody.backend.entity.Song;
import com.melody.backend.entity.User;
import com.melody.backend.dto.ListeningHistoryEntry;
import com.melody.backend.repository.LikedSongRepository;
import com.melody.backend.repository.RecentlyPlayedRepository;
import com.melody.backend.repository.SongRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/library")
public class LibraryController {
    private final LikedSongRepository likedSongs;
    private final RecentlyPlayedRepository recentlyPlayed;
    private final SongRepository songs;

    public LibraryController(LikedSongRepository likedSongs,
                             RecentlyPlayedRepository recentlyPlayed,
                             SongRepository songs) {
        this.likedSongs = likedSongs;
        this.recentlyPlayed = recentlyPlayed;
        this.songs = songs;
    }

    @GetMapping("/liked")
    public List<Song> getLikedSongs(@AuthenticationPrincipal User user) {
        return likedSongs.findSongsForUser(user.getId());
    }

    @PostMapping("/liked/{songId}")
    @Transactional
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void likeSong(@AuthenticationPrincipal User user, @PathVariable Long songId) {
        if (likedSongs.existsByUser_IdAndSong_Id(user.getId(), songId)) return;
        Song song = songs.findById(songId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found"));
        LikedSong liked = new LikedSong();
        liked.setUser(user);
        liked.setSong(song);
        likedSongs.save(liked);
    }

    @DeleteMapping("/liked/{songId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unlikeSong(@AuthenticationPrincipal User user, @PathVariable Long songId) {
        likedSongs.findByUser_IdAndSong_Id(user.getId(), songId).ifPresent(likedSongs::delete);
    }

    @GetMapping("/recent")
    public List<Song> getRecentlyPlayed(@AuthenticationPrincipal User user) {
        return recentlyPlayed.findByUser_IdOrderByPlayedAtDesc(user.getId())
                .stream().map(RecentlyPlayed::getSong).toList();
    }

    @GetMapping("/history")
    public List<ListeningHistoryEntry> getListeningHistory(@AuthenticationPrincipal User user) {
        LocalDateTime threeMonthsAgo = LocalDateTime.now().minusMonths(3);
        return recentlyPlayed.findByUser_IdAndPlayedAtGreaterThanEqualOrderByPlayedAtDesc(user.getId(), threeMonthsAgo)
                .stream().map(ListeningHistoryEntry::from).toList();
    }

    @PostMapping("/recent/{songId}")
    @Transactional
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recordPlay(@AuthenticationPrincipal User user, @PathVariable Long songId) {
        Song song = songs.findById(songId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found"));
        RecentlyPlayed play = new RecentlyPlayed();
        play.setUser(user);
        play.setSong(song);
        recentlyPlayed.save(play);
    }
}
