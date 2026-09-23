package com.melody.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "liked_songs", uniqueConstraints =
        @UniqueConstraint(name = "UQ_liked_songs_user_song", columnNames = {"user_id", "song_id"}))
public class LikedSong {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_id", nullable = false)
    private Song song;

    @Column(name = "liked_at", nullable = false)
    private LocalDateTime likedAt;

    @PrePersist
    void onCreate() { if (likedAt == null) likedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Song getSong() { return song; }
    public void setSong(Song song) { this.song = song; }
    public LocalDateTime getLikedAt() { return likedAt; }
}
