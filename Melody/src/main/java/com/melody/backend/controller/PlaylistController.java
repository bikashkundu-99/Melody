package com.melody.backend.controller;

import com.melody.backend.dto.CreatePlaylistRequest;
import com.melody.backend.dto.PlaylistDetail;
import com.melody.backend.dto.PlaylistSummary;
import com.melody.backend.entity.Playlist;
import com.melody.backend.entity.PlaylistSong;
import com.melody.backend.entity.Song;
import com.melody.backend.entity.User;
import com.melody.backend.repository.PlaylistRepository;
import com.melody.backend.repository.PlaylistSongRepository;
import com.melody.backend.repository.SongRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@RestController
@RequestMapping("/api/playlists")
public class PlaylistController {
    private final PlaylistRepository playlists;
    private final PlaylistSongRepository playlistSongs;
    private final SongRepository songs;

    public PlaylistController(PlaylistRepository playlists,
                              PlaylistSongRepository playlistSongs,
                              SongRepository songs) {
        this.playlists = playlists;
        this.playlistSongs = playlistSongs;
        this.songs = songs;
    }

    @GetMapping
    public List<PlaylistSummary> getPlaylists(@AuthenticationPrincipal User user) {
        return playlists.findByUser_IdOrderByCreatedAtDesc(user.getId())
                .stream().map(this::summary).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PlaylistSummary createPlaylist(@AuthenticationPrincipal User user,
                                          @Valid @RequestBody CreatePlaylistRequest request) {
        if (request.name() == null || request.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Playlist name is required");
        }
        Playlist playlist = new Playlist();
        playlist.setUser(user);
        playlist.setName(request.name().trim());
        playlist.setDescription(request.description() == null ? "" : request.description().trim());
        playlist.setPrivacy("Public".equalsIgnoreCase(request.privacy()) ? "Public" : "Private");
        playlist.setCollaborate(Boolean.TRUE.equals(request.collaborate()));
        return summary(playlists.save(playlist));
    }

    @GetMapping("/{playlistId}")
    public PlaylistDetail getPlaylist(@AuthenticationPrincipal User user, @PathVariable Long playlistId) {
        Playlist playlist = ownedPlaylist(user, playlistId);
        return new PlaylistDetail(summary(playlist), playlistSongs.findSongsForPlaylist(playlistId));
    }

    @PostMapping("/{playlistId}/songs/{songId}")
    @Transactional
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void addSong(@AuthenticationPrincipal User user,
                        @PathVariable Long playlistId,
                        @PathVariable Long songId) {
        Playlist playlist = ownedPlaylist(user, playlistId);
        if (playlistSongs.existsByPlaylist_IdAndSong_Id(playlistId, songId)) return;
        Song song = songs.findById(songId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found"));
        PlaylistSong entry = new PlaylistSong();
        entry.setPlaylist(playlist);
        entry.setSong(song);
        playlistSongs.save(entry);
    }

    @DeleteMapping("/{playlistId}/songs/{songId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeSong(@AuthenticationPrincipal User user,
                           @PathVariable Long playlistId,
                           @PathVariable Long songId) {
        ownedPlaylist(user, playlistId);
        playlistSongs.findByPlaylist_IdAndSong_Id(playlistId, songId).ifPresent(playlistSongs::delete);
    }

    private Playlist ownedPlaylist(User user, Long id) {
        return playlists.findByIdAndUser_Id(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found"));
    }

    private PlaylistSummary summary(Playlist playlist) {
        return new PlaylistSummary(playlist.getId(), playlist.getName(), playlist.getDescription(),
                playlist.getPrivacy(), playlist.getCollaborate(), playlistSongs.countByPlaylist_Id(playlist.getId()),
                playlist.getCreatedAt());
    }
}
