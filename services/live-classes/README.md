# Live Classes Service

This service provides real-time interactive live classes with WebRTC integration for video/audio communication and Socket.IO for signaling and chat.

## Features

- Real-time signaling and WebRTC integration
- Chat functionality
- Placeholder API endpoints for class scheduling and recording

## Getting Started

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Run the service:**
    ```bash
    npm start
    ```

    The service will run on port `3000` (or the port specified in the `PORT` environment variable).

## API Endpoints

-   `GET /`: Basic health check.
-   `POST /classes/schedule`: Placeholder for scheduling a new class.
-   `POST /classes/{classId}/record/start`: Placeholder for starting class recording.
-   `POST /classes/{classId}/record/stop`: Placeholder for stopping class recording.

## Socket.IO Events

-   `connection`: A new client connects.
-   `join-room`: A user joins a specific class room.
    -   Emits `user-connected` to others in the room.
-   `disconnect`: A user disconnects.
    -   Emits `user-disconnected` to others in the room.
-   `offer`, `answer`, `candidate`: WebRTC signaling events.
-   `chat-message`: A user sends a chat message.
    -   Emits `chat-message` to all in the room.