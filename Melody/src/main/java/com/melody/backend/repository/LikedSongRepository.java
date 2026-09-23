package com.melody.backend.repository;

import com.melody.backend.entity.LikedSong;
import com.melody.backend.entity.Song;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface LikedSongRepository extends JpaRepository<LikedSong, Long> {
    boolean existsByUser_IdAndSong_Id(Long userId, Long songId);
    Optional<LikedSong> findByUser_IdAndSong_Id(Long userId, Long songId);
    List<LikedSong> findByUser_IdOrderByLikedAtDesc(Long userId);

    @Query("select liked.song from LikedSong liked where liked.user.id = :userId order by liked.likedAt desc")
    List<Song> findSongsForUser(@Param("userId") Long userId);
}
