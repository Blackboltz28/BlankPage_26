export const APP_NAME = "TaskMaster";

// The app calls /api/... on the same address it was loaded from:
// - `npm run dev`: Vite forwards /api to the server set in website/.env
// - on the website Pi: nginx forwards /api to the server Pi
export const API_URL = "";

// Shown on screen so you can tell which server you're talking to.
export const SERVER_LABEL = (import.meta.env.VITE_API_TARGET || "this website").replace(/^https?:\/\//, "");
