MELODY

Music Streaming Web Application — GitHub README

1. Project Overview
Melody is a full-stack music streaming web application with a modern Spotify/YouTube Music-inspired experience. It includes authentication, music discovery, search, playback, liked songs, playlists, recently played music, lyrics, and an expandable music player.

The application uses a Java Spring Boot backend, HTML/CSS/JavaScript frontend, and Microsoft SQL Server for persistent data.

2. Key Features
• User registration and login
• Forgot-password and password-reset workflow
• JWT-based authentication and authorization
• Music search by title, artist, and album
• Recently played songs
• Liked songs
• Playlist creation and management
• Music playback controls
• Bottom player and expanded player
• Lyrics display and timestamp-based synchronization
• Click a lyric line to seek playback to that timestamp
• Speech recognition for voice-based music search
• Song recommendations
• Your Library
• REST APIs for frontend-backend communication
• SQL Server persistence with Spring Data JPA
3. Technology Stack
Technology

Purpose

Java

Backend development

Spring Boot 3.5.5

Backend framework

Spring Web

REST APIs

Spring Data JPA / Hibernate

ORM and database access

Spring Security

Authentication and authorization

JWT

Stateless authentication

Microsoft SQL Server

Relational database

Maven

Build and dependency management

HTML5

Frontend structure

CSS3

Frontend styling

JavaScript

Frontend logic and API integration

4. Architecture
• Frontend Layer — HTML, CSS, and JavaScript provide the user interface.
• Controller/API Layer — Spring Boot REST controllers expose application endpoints.
• Service Layer — Business logic is implemented in Spring services.
• Repository Layer — Spring Data JPA repositories communicate with SQL Server.
• Database Layer — SQL Server stores application data.
• Security Layer — Spring Security and JWT protect authenticated endpoints.
5. Project Structure
Melody/
├── src/
│   ├── main/
│   │   ├── java/com/melody/backend/
│   │   │   ├── MelodyApplication.java
│   │   │   ├── controller/
│   │   │   ├── service/
│   │   │   ├── repository/
│   │   │   ├── entity/
│   │   │   ├── dto/
│   │   │   ├── security/
│   │   │   └── config/
│   │   └── resources/
│   │       ├── application.properties
│   │       └── static/
│   │           ├── css/
│   │           ├── js/
│   │           └── images/
│   └── test/
├── pom.xml
└── README.md

6. Backend
Melody uses Spring Boot 3.5.5 with Maven. The main application class is com.melody.backend.MelodyApplication.

The backend exposes REST APIs used by the JavaScript frontend. Business logic is separated into controllers, services, repositories, entities, DTOs, and security components.

7. Database
Microsoft SQL Server is used as the primary relational database. JPA/Hibernate provides ORM support.

• Users
• Songs
• Artists
• Albums
• Playlists
• Playlist songs
• Liked songs
• Recently played songs
• Lyrics and lyric timestamps
8. Authentication & Security
• Spring Security handles authentication and authorization.
• JWT tokens are used for authenticated API requests.
• Passwords should be stored using secure hashing, never plain text.
• Protected APIs require valid authentication.
• Database credentials, JWT secrets, API keys, and tokens must not be committed to GitHub.
9. Music Search
Melody supports search using song title, artist, and album information. The frontend sends search requests to the backend and displays matching results.

Voice search can use browser speech-recognition capabilities so users can speak a song, artist, or album name instead of typing it.

10. Lyrics Synchronization
Melody supports timestamped lyrics. Each lyric line can be associated with a playback timestamp. During playback, the application can identify and highlight the currently active lyric.

When a user clicks a lyric line, the player can seek to that timestamp, creating an experience similar to modern music streaming applications.

11. Running the Project
• Install Java and configure JAVA_HOME.
• Use Maven or the Maven wrapper through IntelliJ IDEA.
• Install Microsoft SQL Server and create/configure the Melody database.
• Configure the SQL Server connection in application.properties or environment variables.
• Configure JWT secrets securely.
• Build the project with Maven.
• Run MelodyApplication.java or start the Spring Boot application through Maven/IntelliJ IDEA.
• Open the Melody frontend in a browser.
12. Maven Commands
mvn clean install

mvn spring-boot:run

13. REST API
The backend follows REST principles. API areas include authentication, songs, search, playlists, liked songs, recently played songs, lyrics, and user library data.

The JavaScript frontend communicates with these APIs using HTTP requests and updates the interface using the returned JSON data.

14. Future Enhancements
• Advanced recommendation engine
• Personalized playlists
• Improved karaoke-style lyric synchronization
• Improved voice search
• Queue management
• Shuffle and repeat modes
• Audio quality selection
• Performance optimization and caching
• Docker containerization
• Cloud deployment
• Kubernetes deployment
• CI/CD pipeline

<img width="1351" height="646" alt="image" src="https://github.com/user-attachments/assets/2eb71a4f-4b8e-4520-87bb-bee4e1bfa5d9" />
<img width="1354" height="651" alt="image" src="https://github.com/user-attachments/assets/48254dd1-72f0-470c-9147-73812ea86668" />

<img width="1351" height="649" alt="image" src="https://github.com/user-attachments/assets/49f0b23f-04e2-4961-a379-b42b230593d9" />



