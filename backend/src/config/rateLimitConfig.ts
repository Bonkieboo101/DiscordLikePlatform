// Rates for socket events, configurable via environment variables
export const SEND_MESSAGE_LIMIT = Number(process.env.SOCKET_RATE_LIMIT_SEND_MESSAGES ?? 5);
export const SEND_WINDOW_MS = Number(process.env.SOCKET_RATE_LIMIT_SEND_WINDOW_MS ?? 10000);
export const EDIT_MESSAGE_LIMIT = Number(process.env.SOCKET_RATE_LIMIT_EDIT_MESSAGES ?? 10);
export const EDIT_WINDOW_MS = Number(process.env.SOCKET_RATE_LIMIT_EDIT_WINDOW_MS ?? 10000);
