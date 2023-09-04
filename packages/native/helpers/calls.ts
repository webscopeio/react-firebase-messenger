import { toPairs, keys } from 'rambda'
import { FirebaseDatabaseTypes } from '@react-native-firebase/database'
import { allChatMetadataRef, chatMetadataRef } from './references'
import {
  type ChatMetadata,
  type OnSendMessage,
  toUnixTimestamp,
  createOnSendMessageUpdate,
  createEmptyChatUpdate,
} from '@webscopeio/react-firebase-messenger'

// To send and store message on fdb
export const toSendMessage = ({
  firebaseDB,
  ...rest
}: {
  firebaseDB: FirebaseDatabaseTypes.Reference
} & OnSendMessage) => {
  const entireUpdate = createOnSendMessageUpdate(rest)
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
  const entireUpdate = createEmptyChatUpdate({ chatId, userId, eventId, recipientsIds, meta })
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
