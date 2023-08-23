import { DatabaseReference, child } from 'firebase/database'

// All of these functions returns `DatabaseReference` object

/**
 * `users/${userId}`
 */
export const usersRef = (
  firebaseDB: DatabaseReference,
  userId: string,
) => child(firebaseDB, `users/${userId}`)

/**
 * `chat-messages/${chatId}`
 */
export const chatMessagesRef = (
  firebaseDB: DatabaseReference,
  chatId: string
) => child(firebaseDB, `chat-messages/${chatId}`)

/**
 * `chat-metadata/${chatId}`
 */
export const chatMetadataRef = (
  firebaseDB: DatabaseReference,
  chatId: string,
) => child(firebaseDB, `chat-metadata/${chatId}`)

/**
 * `user-event-chats/${userId}/${eventId}/${chatId}`
 */
export const userEventChatsRef = (
  firebaseDB: DatabaseReference,
  userId: string,
  eventId: string,
  chatId: string,
) => child(firebaseDB, `user-event-chats/${userId}/${eventId}/${chatId}`)

/**
 * `user-event-chats/${userId}/${eventId}`
 */
export const userEventAllChatsRef = (
  firebaseDB: DatabaseReference,
  userId: string,
  eventId: string,
) => child(firebaseDB, `user-event-chats/${userId}/${eventId}`)

/**
 * `user-chats/${userId}/${chatId}`
 */
export const userChatsRef = (
  firebaseDB: DatabaseReference,
  userId: string,
  chatId: string,
) => child(firebaseDB, `user-chats/${userId}/${chatId}`)

/**
 * `user-chats/${userId}`
 */
export const userChatsAllRef = (
  firebaseDB: DatabaseReference,
  userId: string,
) => child(firebaseDB, `user-chats/${userId}`)
