// @flow

export const usersRef = (
  firebaseDB,
  userId,
) => firebaseDB.child(`users/${userId}`)

export const chatMessagefRef = (
  firebaseDB,
  chatId
) => firebaseDB.child(`chat-messages/${chatId}`)

export const chatMetadataRef = (
  firebaseDB,
  chatId
) => firebaseDB.child(`chat-metadata/${chatId}`)

export const userEventChatsRef = (
  firebaseDB,
  userId,
  eventId,
  chatId
) => firebaseDB.child(`user-event-chats/${userId}/${eventId}/${chatId}`)

export const userEventAllChatsRef = (
  firebaseDB,
  userId,
  eventId
) => firebaseDB.child(`user-event-chats/${userId}/${eventId}`)

export const userChatsRef = (
  firebaseDB,
  userId,
  chatId
) => firebaseDB.child(`user-chats/${userId}/${chatId}`)
