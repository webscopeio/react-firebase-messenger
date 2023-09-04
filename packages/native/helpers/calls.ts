import { assoc, compose, toPairs, keys } from 'rambda'
import { FirebaseDatabaseTypes } from '@react-native-firebase/database'
import { allChatMetadataRef, chatMetadataRef } from './references'
import {
  type ChatMessage,
  type ChatMetadata,
  type CollectionObject,
  type Message,
  type UnreadMessage,
  toUnixTimestamp,
  transformMessagesToStoreInDB,
} from '@webscopeio/react-firebase-messenger'

// To send and store message on fdb
export const toSendMessage = ({
  firebaseDB,
  chatId,
  userId,
  messages,
  eventId,
  recipientsIds,
  meta,
  createNewChat,
}: {
  firebaseDB: FirebaseDatabaseTypes.Reference
  chatId: string
  userId: string
  messages: Array<Message>
  eventId: string
  recipientsIds: Array<string>
  meta: Pick<ChatMetadata, 'lastMessageAuthorId' | 'lastMessageCreatedAt' | 'lastMessageText'>
  createNewChat?: boolean
}) => {
  const lastMessageTimeStamp = toUnixTimestamp(meta.lastMessageCreatedAt)
  const msgs = transformMessagesToStoreInDB(userId)(messages)

  const messagesUpdate = msgs.reduce<CollectionObject<ChatMessage>>((result, message) => {
    // message[0] - author id, message[1] - message data
    const newResult = assoc(`chat-messages/${chatId}/${message[0]}`, message[1], result || {})
    return newResult
  }, {})

  const unreadMessagesUpdate = msgs.reduce<CollectionObject<UnreadMessage>>((result, message) => {
    let newResult = result || {}

    recipientsIds.forEach((recipientId) => {
      if (recipientId !== userId) {
        newResult = assoc(
          `unread-messages/${recipientId}/${message[0]}`,
          {
            chatId,
            eventId,
          },
          newResult,
        )
      }
    })
    return newResult
  }, {})

  const lastMessageCreatedAtUpdate = recipientsIds.reduce<CollectionObject<string>>((result, participantId) => {
    const newResult = compose(
      assoc(`user-chats/${participantId}/${chatId}/lastMessageCreatedAt`, lastMessageTimeStamp),
      /* //
      assoc(`user-event-chats/${participantId}/${eventId}/${chatId}/lastMessageCreatedAt`,
      lastMessageTimeStamp), //
      */
    )(result || {})
    return newResult
  }, {})

  // When creating new chat also include such properties as users(participants) and eventId
  const chatMetaUpdate: CollectionObject<string | typeof meta> = createNewChat
    ? {
        [`chat-metadata/${chatId}`]: meta,
      }
    : {
        [`chat-metadata/${chatId}/lastMessageAuthorId`]: meta.lastMessageAuthorId,
        [`chat-metadata/${chatId}/lastMessageCreatedAt`]: `${meta.lastMessageCreatedAt.toISOString()}`,
        [`chat-metadata/${chatId}/lastMessageText`]: meta.lastMessageText,
      }

  const entireUpdate = {
    [`user-chats/${userId}/${chatId}/lastMessageCreatedAt`]: lastMessageTimeStamp,
    /* //
    [`user-event-chats/${userId}/${eventId}/${chatId}/lastMessageCreatedAt`]: lastMessageTimeStamp,
    */
    ...messagesUpdate,
    ...unreadMessagesUpdate,
    ...lastMessageCreatedAtUpdate,
    ...chatMetaUpdate,
  }
  firebaseDB.update(entireUpdate)
}

export const createEmptyChat = (
  firebaseDB: FirebaseDatabaseTypes.Reference,
  chatId: string,
  userId: string,
  eventId: string,
  recipientsIds: Array<string>,
  meta: ChatMetadata,
) => {
  const lastMessageTimeStamp = toUnixTimestamp(meta.lastMessageCreatedAt)

  const lastMessageCreatedAtUpdate = recipientsIds.reduce((result, participantId) => {
    const newResult = compose(
      assoc(`user-chats/${participantId}/${chatId}/lastMessageCreatedAt`, lastMessageTimeStamp),
    )(result)
    return newResult
  }, {})

  const entireUpdate = {
    // TODO THIS FOR ALL RECIPIENTS >>>>
    [`user-chats/${userId}/${chatId}/lastMessageCreatedAt`]: lastMessageTimeStamp,
    [`chat-metadata/${chatId}`]: meta,
    ...lastMessageCreatedAtUpdate,
  }

  firebaseDB.update(entireUpdate)
}

export const addUserToChat = (firebaseDB: FirebaseDatabaseTypes.Reference, uid: string, chatId: string) => {
  const upp: Promise<ChatMetadata> = new Promise((resolve) => {
    chatMetadataRef(firebaseDB, chatId).on('value', (snap) => {
      resolve(snap.val())
    })
  })

  upp.then((chatData) => {
    const entireUpdate = {
      [`chat-metadata/${chatId}/users/${uid}`]: true,
      [`user-chats/${uid}/${chatId}/lastMessageCreatedAt`]: toUnixTimestamp(chatData.lastMessageCreatedAt),
    }

    firebaseDB.update(entireUpdate)
  })
}

export const checkForChatExistence = (
  firebaseDB: FirebaseDatabaseTypes.Reference,
  theUserId: string,
  uid: string,
  eventId: string,
) =>
  new Promise((resolve) => {
    allChatMetadataRef(firebaseDB)
      .orderByChild(`users/${theUserId}`)
      .startAt(true)
      .on('value', (snap) => {
        const chats = toPairs(snap.val())

        const filtredChats = chats.filter((chat) => {
          const chatMetas = chat[1]
          const chatParticipants = keys(chatMetas.users)
          const ind = chatParticipants.indexOf(uid)

          return (
            ind !== -1 && // chat exists
            chatParticipants.length === 2 && // chat is private
            eventId === chatMetas.eventId
          ) // chat is in the event scope
        })

        allChatMetadataRef(firebaseDB).off()
        resolve(filtredChats)
      })
  })

export const getGroupChatsByEvent = (firebaseDB: FirebaseDatabaseTypes.Reference, eventId: string): Promise<Object> =>
  new Promise((resolve) => {
    allChatMetadataRef(firebaseDB)
      .orderByChild('eventId')
      .equalTo(eventId)
      .on('value', (snap) => {
        const chats = snap.val()
        allChatMetadataRef(firebaseDB).off()
        resolve(chats)
      })
  })

export const getChatById = (firebaseDB: FirebaseDatabaseTypes.Reference, chatId: string): Promise<ChatMetadata> =>
  new Promise((resolve) => {
    chatMetadataRef(firebaseDB, chatId).on('value', (snap) => {
      const chat = snap.val() as ChatMetadata | null
      if (chat) {
        // only return the promise once the snap val is non null
        chatMetadataRef(firebaseDB, chatId).off()
        resolve(chat)
      }
    })
  })
