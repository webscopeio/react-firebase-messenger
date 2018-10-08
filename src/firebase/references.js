// @flow

export const usersRef = (
  firebaseDB: Object,
  userId: string,
) => firebaseDB.child(`users/${userId}`)

export const chatMessagefRef = (
  firebaseDB: Object,
  chatId: string
) => firebaseDB.child(`chat-messages/${chatId}`)

export const chatMetadataRef = (
  firebaseDB: Object,
  chatId: string,
) => firebaseDB.child(`chat-metadata/${chatId}`)

export const userEventChatsRef = (
  firebaseDB: Object,
  userId: string,
  eventId: string,
  chatId: string,
) => firebaseDB.child(`user-event-chats/${userId}/${eventId}/${chatId}`)

export const userEventAllChatsRef = (
  firebaseDB: Object,
  userId: string,
  eventId: string,
) => firebaseDB.child(`user-event-chats/${userId}/${eventId}`)

export const userChatsRef = (
  firebaseDB: Object,
  userId: string,
  chatId: string,
) => firebaseDB.child(`user-chats/${userId}/${chatId}`)

export const userChatsAllRef = (
  firebaseDB: Object,
  userId: string,
) => firebaseDB.child(`user-chats/${userId}`)
