USE MelodyDB;
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