USE MelodyDB;
GO

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

-- Add a profile after placing its image under
-- src/main/resources/static/images/artists/:
-- INSERT INTO dbo.artists (name, bio, photo_url)
-- VALUES (N'The Weeknd', N'Artist biography', N'/images/artists/the-weeknd.jpg');
