import { FirebaseDatabaseTypes } from '@react-native-firebase/database'

// All of these functions returns `FirebaseDatabaseTypes.Reference` object

/**
 * `users/${userId}`
 */
export const usersRef = (firebaseDB: FirebaseDatabaseTypes.Reference, userId: string) =>
  firebaseDB.child(`users/${userId}`)

/**
 * `chat-messages/${chatId}`
 */
export const chatMessagesRef = (firebaseDB: FirebaseDatabaseTypes.Reference, chatId: string) =>
  firebaseDB.child(`chat-messages/${chatId}`)

/**
 * `chat-metadata/${chatId}`
 */
export const chatMetadataRef = (firebaseDB: FirebaseDatabaseTypes.Reference, chatId: string) =>
  firebaseDB.child(`chat-metadata/${chatId}`)

/**
 * `chat-metadata`
 */
export const allChatMetadataRef = (firebaseDB: FirebaseDatabaseTypes.Reference) => firebaseDB.child('chat-metadata')

/**
 * `user-event-chats/${userId}/${eventId}/${chatId}`
 */
export const userEventChatsRef = (
  firebaseDB: FirebaseDatabaseTypes.Reference,
  userId: string,
  eventId: string,
  chatId: string,
) => firebaseDB.child(`user-event-chats/${userId}/${eventId}/${chatId}`)

/**
 * `user-event-chats/${userId}/${eventId}`
 */
export const userEventAllChatsRef = (firebaseDB: FirebaseDatabaseTypes.Reference, userId: string, eventId: string) =>
  firebaseDB.child(`user-event-chats/${userId}/${eventId}`)

/**
 * `user-chats/${userId}/${chatId}`
 */
export const userChatsRef = (firebaseDB: FirebaseDatabaseTypes.Reference, userId: string, chatId: string) =>
  firebaseDB.child(`user-chats/${userId}/${chatId}`)

/**
 * `user-chats/${userId}`
 */
export const userChatsAllRef = (firebaseDB: FirebaseDatabaseTypes.Reference, userId: string) =>
  firebaseDB.child(`user-chats/${userId}`)
