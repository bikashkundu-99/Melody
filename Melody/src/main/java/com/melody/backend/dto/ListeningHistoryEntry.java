package com.melody.backend.dto;

import com.melody.backend.entity.RecentlyPlayed;
import java.time.LocalDateTime;

public record ListeningHistoryEntry(
        Long id,
        String title,
        String artist,
        String album,
        String thumbnailUrl,
        LocalDateTime playedAt
) {
    public static ListeningHistoryEntry from(RecentlyPlayed entry) {
        var song = entry.getSong();
        return new ListeningHistoryEntry(
                song.getId(),
                song.getTitle(),
                song.getArtist(),
                song.getAlbum(),
                song.getThumbnailUrl(),
                entry.getPlayedAt()
        );
    }
}
