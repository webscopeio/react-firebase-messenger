import { toPairs, keys } from 'rambda'
import { type DatabaseReference, off, update, orderByChild, startAt, onValue, query, equalTo } from 'firebase/database'
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
  firebaseDB: DatabaseReference
} & OnSendMessage) => {
  const entireUpdate = createOnSendMessageUpdate(rest)
  update(firebaseDB, entireUpdate)
}

export const createEmptyChat = (
  firebaseDB: DatabaseReference,
  chatId: string,
  userId: string,
  eventId: string,
  recipientsIds: Array<string>,
  meta: ChatMetadata,
) => {
  const entireUpdate = createEmptyChatUpdate({ chatId, userId, eventId, recipientsIds, meta })
  update(firebaseDB, entireUpdate)
}

export const addUserToChat = (firebaseDB: DatabaseReference, uid: string, chatId: string) => {
  const upp: Promise<ChatMetadata> = new Promise((resolve) => {
    const childRef = chatMetadataRef(firebaseDB, chatId)
    return onValue(childRef, (snap) => resolve(snap.val()))
  })

  upp.then((chatData) => {
    const entireUpdate = {
      [`chat-metadata/${chatId}/users/${uid}`]: true,
      [`user-chats/${uid}/${chatId}/lastMessageCreatedAt`]: toUnixTimestamp(chatData.lastMessageCreatedAt),
    }

    update(firebaseDB, entireUpdate)
  })
}

export const checkForChatExistence = (firebaseDB: DatabaseReference, theUserId: string, uid: string, eventId: string) =>
  new Promise((resolve) => {
    const childRef = allChatMetadataRef(firebaseDB)
    onValue(query(childRef, orderByChild(`users/${theUserId}`), startAt(true)), (snap) => {
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

      off(childRef)
      resolve(filtredChats)
    })
  })

export const getGroupChatsByEvent = (firebaseDB: DatabaseReference, eventId: string): Promise<Object> =>
  new Promise((resolve) => {
    const childRef = allChatMetadataRef(firebaseDB)
    const queryRef = query(childRef, orderByChild('eventId'), equalTo(eventId))
    onValue(queryRef, (snap) => {
      const chats = snap.val()
      off(childRef)
      resolve(chats)
    })
  })

export const getChatById = (firebaseDB: DatabaseReference, chatId: string): Promise<ChatMetadata> =>
  new Promise((resolve) => {
    const childRef = chatMetadataRef(firebaseDB, chatId)
    onValue(childRef, (snap) => {
      const chat = snap.val()
      // not sure if we need to off `childRef` here
      off(childRef)
      resolve(chat)
    })
  })
