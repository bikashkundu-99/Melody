USE MelodyDB;
GO

-- =====================================================
-- ARTISTS
-- Keep profile details separate from songs.artist so
-- existing song rows remain compatible.
-- =====================================================

IF OBJECT_ID('dbo.artists', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.artists
    (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(150) NOT NULL,
        bio NVARCHAR(MAX) NULL,
        photo_url NVARCHAR(1000) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_artists_name UNIQUE(name)
    );
END;
GO

-- =====================================================
-- USERS
-- =====================================================

IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN

    CREATE TABLE users
    (
        id BIGINT IDENTITY(1,1)
            PRIMARY KEY,

        name NVARCHAR(100)
            NOT NULL,

        email NVARCHAR(255)
            NOT NULL,

        password_hash NVARCHAR(255)
            NOT NULL,

        role NVARCHAR(20)
            NOT NULL
            DEFAULT 'USER',

        is_active BIT
            NOT NULL
            DEFAULT 1,

        created_at DATETIME2
            NOT NULL
            DEFAULT SYSUTCDATETIME(),

        updated_at DATETIME2
            NOT NULL
            DEFAULT SYSUTCDATETIME(),

        CONSTRAINT UQ_users_email
            UNIQUE(email),

        CONSTRAINT CK_users_role
            CHECK(role IN ('USER', 'ADMIN'))
    );

END;
GO


-- =====================================================
-- PASSWORD RESET TOKENS
-- =====================================================

IF OBJECT_ID(
    'dbo.password_reset_tokens',
    'U'
) IS NULL
BEGIN

    CREATE TABLE password_reset_tokens
    (
        id BIGINT IDENTITY(1,1)
            PRIMARY KEY,

        user_id BIGINT
            NOT NULL,

        token_hash NVARCHAR(255)
            NOT NULL,

        expires_at DATETIME2
            NOT NULL,

        used BIT
            NOT NULL
            DEFAULT 0,

        created_at DATETIME2
            NOT NULL
            DEFAULT SYSUTCDATETIME(),

        CONSTRAINT FK_password_reset_user
            FOREIGN KEY(user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
    );

END;
GO


-- =====================================================
-- PASSWORD RESET TOKEN INDEX
-- =====================================================

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_password_reset_token_hash'
)
BEGIN

    CREATE INDEX IX_password_reset_token_hash
    ON password_reset_tokens(token_hash);

END;
GO


-- =====================================================
-- LOGIN ATTEMPTS
-- =====================================================

IF OBJECT_ID(
    'dbo.login_attempts',
    'U'
) IS NULL
BEGIN

    CREATE TABLE login_attempts
    (
        id BIGINT IDENTITY(1,1)
            PRIMARY KEY,

        email NVARCHAR(255)
            NOT NULL,

        ip_address NVARCHAR(45)
            NULL,

        success BIT
            NOT NULL,

        attempted_at DATETIME2
            NOT NULL
            DEFAULT SYSUTCDATETIME()
    );

END;
GO


-- =====================================================
-- LOGIN ATTEMPT INDEXES
-- =====================================================

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_login_attempts_email'
)
BEGIN

    CREATE INDEX IX_login_attempts_email
    ON login_attempts(email);

END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_login_attempts_attempted_at'
)
BEGIN

    CREATE INDEX IX_login_attempts_attempted_at
    ON login_attempts(attempted_at);

END;
GO

-- =====================================================
-- LIKED SONGS
-- =====================================================

IF OBJECT_ID('dbo.liked_songs', 'U') IS NULL
BEGIN
    CREATE TABLE liked_songs
    (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        song_id BIGINT NOT NULL,
        liked_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_liked_songs_user_song UNIQUE(user_id, song_id),
        CONSTRAINT FK_liked_songs_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_liked_songs_song FOREIGN KEY(song_id) REFERENCES songs(id) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_liked_songs_user_liked_at')
BEGIN
    CREATE INDEX IX_liked_songs_user_liked_at ON liked_songs(user_id, liked_at DESC);
END;
GO

-- =====================================================
-- PLAYLISTS AND PLAYLIST SONGS
-- =====================================================

IF OBJECT_ID('dbo.playlists', 'U') IS NULL
BEGIN
    CREATE TABLE playlists
    (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        name NVARCHAR(100) NOT NULL,
        description NVARCHAR(200) NULL,
        privacy NVARCHAR(20) NOT NULL DEFAULT 'Private',
        collaborate BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_playlists_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_playlists_user_created_at')
BEGIN
    CREATE INDEX IX_playlists_user_created_at ON playlists(user_id, created_at DESC);
END;
GO

IF OBJECT_ID('dbo.playlist_songs', 'U') IS NULL
BEGIN
    CREATE TABLE playlist_songs
    (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        playlist_id BIGINT NOT NULL,
        song_id BIGINT NOT NULL,
        added_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_playlist_songs_playlist_song UNIQUE(playlist_id, song_id),
        CONSTRAINT FK_playlist_songs_playlist FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        CONSTRAINT FK_playlist_songs_song FOREIGN KEY(song_id) REFERENCES songs(id) ON DELETE CASCADE
    );
END;
GO

-- =====================================================
-- RECENTLY PLAYED HISTORY
-- =====================================================

IF OBJECT_ID('dbo.recently_played', 'U') IS NULL
BEGIN
    CREATE TABLE recently_played
    (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        song_id BIGINT NOT NULL,
        played_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_recently_played_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_recently_played_song FOREIGN KEY(song_id) REFERENCES songs(id) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_recently_played_user_played_at')
BEGIN
    CREATE INDEX IX_recently_played_user_played_at ON recently_played(user_id, played_at DESC);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_playlist_songs_playlist')
BEGIN
    CREATE INDEX IX_playlist_songs_playlist ON playlist_songs(playlist_id, added_at DESC);
END;
GO
