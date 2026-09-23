package com.melody.backend.dto;

import com.melody.backend.entity.Song;
import java.util.List;

public record PlaylistDetail(PlaylistSummary playlist, List<Song> songs) { }
