// @flow
import * as R from 'ramda'

import { toUnixTimestamp } from '../helpers/time-convertors'
import {
  transformMessagesToStoreInDB,
} from '../helpers/transformations'
import type { Message } from '../common/flow'

// To send and store message on fdb
export const toSendMessage = (
  firebaseDB: Object,
  chatId: string,
  userId: string,
  messages: Array<Message>,
  eventId: string,
  recipientsIds: Array<string>,
  meta: Object,
  createNewChat: ?boolean,
) => {
  const lastMessageTimeStamp = toUnixTimestamp(meta.lastMessageCreatedAt)
  const msgs = transformMessagesToStoreInDB(userId)(messages)

  const messagesUpdate = msgs.reduce((result, message) => {
    // message[0] - author id, message[1] - message data
    const newResult = R.assoc(`chat-messages/${chatId}/${message[0]}`, message[1], result || {})
    return newResult
  }, 0)

  const unreadMessagesUpdate = msgs.reduce((result, message) => {
    let newResult = result || {}

    // eslint-disable-next-line
    recipientsIds.forEach((recipientId) => {
      if (recipientId !== userId) {
        newResult = R.assoc(`unread-messages/${recipientId}/${message[0]}`, {
          chatId,
          eventId,
        }, newResult)
      }
    })
    return newResult
  }, 0)

  const lastMessageCreatedAtUpdate = recipientsIds.reduce((result, participantId) => {
    const newResult = R.compose(
      R.assoc(`user-chats/${participantId}/${chatId}/lastMessageCreatedAt`, lastMessageTimeStamp),
      /* //
      R.assoc(`user-event-chats/${participantId}/${eventId}/${chatId}/lastMessageCreatedAt`,
      lastMessageTimeStamp), //
      */
    )(result || {})
    return newResult
  }, 0)

  // When creating new chat also include such properties as users(participants) and eventId
  const chatMetaUpdate = createNewChat
    ? {
      [`chat-metadata/${chatId}`]: meta,
    }
    : {
      [`chat-metadata/${chatId}/lastMessageAuthorId`]: meta.lastMessageAuthorId,
      [`chat-metadata/${chatId}/lastMessageCreatedAt`]: meta.lastMessageCreatedAt,
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
  firebaseDB: Object,
  chatId: string,
  userId: string,
  eventId: string,
  recipientsIds: Array<string>,
  meta: Object,
) => {
  const lastMessageTimeStamp = toUnixTimestamp(meta.lastMessageCreatedAt)

  const lastMessageCreatedAtUpdate = recipientsIds.reduce((result, participantId) => {
    const newResult = R.compose(
      R.assoc(`user-chats/${participantId}/${chatId}/lastMessageCreatedAt`, lastMessageTimeStamp),
    )(result)
    return newResult
  }, {})

  // When creating new chat also include such properties as users(participants) and eventId
  // const chatMetaUpdate = {
  //   [`chat-metadata/${chatId}`]: meta,
  // }

  const entireUpdate = {
    // TODO THIS FOR ALL RECIPIENTS >>>>
    [`user-chats/${userId}/${chatId}/lastMessageCreatedAt`]: lastMessageTimeStamp,
    [`chat-metadata/${chatId}`]: meta,
    ...lastMessageCreatedAtUpdate,
  }

  firebaseDB.update(entireUpdate)
}

export const addUserToChat = (
  firebaseDB: any,
  uid: string,
  chatId: string,
) => {
  const upp = new Promise((resolve) => {
    firebaseDB.child(`chat-metadata/${chatId}`)
      .on('value', (snap) => {
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
  firebaseDB: Object,
  theUserId: string,
  uid: string,
  eventId: string,
): Object => new Promise((resolve) => {
  firebaseDB.child('chat-metadata')
    .orderByChild(`users/${theUserId}`)
    .startAt(true)
    .on('value', (snap) => {
      const chats = R.toPairs(snap.val())

      const filtredChats = chats.filter((chat) => {
        const chatMetas = chat[1]
        const chatParticipants = R.keys(chatMetas.users)
        const ind = chatParticipants.indexOf(uid)

        return ind !== -1 && // chat exists
            chatParticipants.length === 2 && // chat is private
            eventId === chatMetas.eventId // chat is in the event scope
      })

      firebaseDB.child('chat-metadata').off()
      resolve(filtredChats)
    })
})

export const getGroupChatsByEvent = (
  firebaseDB: Object,
  eventId: string,
): Promise<Object> => new Promise((resolve) => {
  firebaseDB.child('chat-metadata')
    .orderByChild('eventId')
    .equalTo(eventId)
    .on('value', (snap) => {
      const chats = snap.val()
      firebaseDB.child('chat-metadata').off()
      resolve(chats)
    })
})
