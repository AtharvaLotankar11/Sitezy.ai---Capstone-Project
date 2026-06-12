import io from "socket.io-client";

let socket = null;

export const connectSocket = (token) => {
    if (socket) {
        if (socket.auth?.token === token) return socket;
        socket.disconnect();
    }

    socket = io("http://localhost:5000", {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    socket.on("connect", () => console.log("🔌 Socket connected:", socket.id));
    socket.on("disconnect", () => console.log("🔌 Socket disconnected"));
    socket.on("connect_error", (err) => console.error("Socket error:", err.message));

    return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
