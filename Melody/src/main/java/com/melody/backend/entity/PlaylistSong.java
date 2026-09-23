package com.melody.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "playlist_songs", uniqueConstraints =
        @UniqueConstraint(name = "UQ_playlist_songs_playlist_song", columnNames = {"playlist_id", "song_id"}))
public class PlaylistSong {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "playlist_id", nullable = false)
    private Playlist playlist;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_id", nullable = false)
    private Song song;

    @Column(name = "added_at", nullable = false)
    private LocalDateTime addedAt;

    @PrePersist
    void onCreate() { if (addedAt == null) addedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public Playlist getPlaylist() { return playlist; }
    public void setPlaylist(Playlist playlist) { this.playlist = playlist; }
    public Song getSong() { return song; }
    public void setSong(Song song) { this.song = song; }
    public LocalDateTime getAddedAt() { return addedAt; }
}
