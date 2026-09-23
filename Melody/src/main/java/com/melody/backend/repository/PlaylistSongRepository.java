package com.melody.backend.repository;

import com.melody.backend.entity.PlaylistSong;
import com.melody.backend.entity.Song;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface PlaylistSongRepository extends JpaRepository<PlaylistSong, Long> {
    boolean existsByPlaylist_IdAndSong_Id(Long playlistId, Long songId);
    Optional<PlaylistSong> findByPlaylist_IdAndSong_Id(Long playlistId, Long songId);
    long countByPlaylist_Id(Long playlistId);
    List<PlaylistSong> findByPlaylist_IdOrderByAddedAtDesc(Long playlistId);

    @Query("select entry.song from PlaylistSong entry where entry.playlist.id = :playlistId order by entry.addedAt desc")
    List<Song> findSongsForPlaylist(@Param("playlistId") Long playlistId);
}
