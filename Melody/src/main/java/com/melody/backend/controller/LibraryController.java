package com.melody.backend.controller;

import com.melody.backend.entity.LikedSong;
import com.melody.backend.entity.RecentlyPlayed;
import com.melody.backend.entity.Song;
import com.melody.backend.entity.User;
import com.melody.backend.dto.ListeningHistoryEntry;
import org.springframework.http.ResponseEntity;
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
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        return recentlyPlayed.findByUser_IdAndPlayedAtGreaterThanEqualOrderByPlayedAtDesc(user.getId(), thirtyDaysAgo)
                .stream().map(ListeningHistoryEntry::from).toList();
    }

    @GetMapping("/playback-state")
    public ResponseEntity<PlaybackStateResponse> getPlaybackState(@AuthenticationPrincipal User user) {
        return recentlyPlayed.findFirstByUser_IdOrderByPlayedAtDescIdDesc(user.getId())
                .map(entry -> ResponseEntity.ok(PlaybackStateResponse.from(entry)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping("/playback-state")
    @Transactional
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updatePlaybackState(@AuthenticationPrincipal User user,
                                    @RequestBody PlaybackPositionRequest request) {
        if (request.songId() == null || request.positionSeconds() == null
                || !Double.isFinite(request.positionSeconds()) || request.positionSeconds() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid song and playback position are required");
        }

        recentlyPlayed.findFirstByUser_IdOrderByPlayedAtDescIdDesc(user.getId())
                .filter(entry -> entry.getSong().getId().equals(request.songId()))
                .ifPresent(entry -> {
                    entry.setPlaybackPositionSeconds(request.positionSeconds());
                    recentlyPlayed.save(entry);
                });
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
        play.setPlaybackPositionSeconds(0.0);
        recentlyPlayed.save(play);
    }

    public record PlaybackPositionRequest(Long songId, Double positionSeconds) {
    }

    public record PlaybackStateResponse(
            Long songId,
            String title,
            String artist,
            String album,
            String audioUrl,
            String thumbnailUrl,
            Integer durationSeconds,
            Double positionSeconds
    ) {
        private static PlaybackStateResponse from(RecentlyPlayed entry) {
            Song song = entry.getSong();
            return new PlaybackStateResponse(
                    song.getId(), song.getTitle(), song.getArtist(), song.getAlbum(),
                    song.getAudioUrl(), song.getThumbnailUrl(), song.getDurationSeconds(),
                    entry.getPlaybackPositionSeconds()
            );
        }
    }
}
