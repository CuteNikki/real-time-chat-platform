// Shared pagination sizes. These live outside the 'use server' action modules
// because a "use server" file may only export async functions — client
// components import these plain constants directly instead.

// How many messages a chat loads up front, and how many each older page adds
// as the user scrolls back through history.
export const INITIAL_MESSAGE_LIMIT = 50;
export const OLDER_MESSAGE_LIMIT = 25;

// How many users the moderation dashboard shows per page.
export const MODERATION_USERS_PAGE_SIZE = 25;

// How many posts the feed loads at once (across both the "For You" and
// "Friends" tabs).
export const FEED_LIMIT = 100;
