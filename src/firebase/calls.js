import R from 'ramda'

import TimeFormat from '../helpers/timeFormat'
import {
  transformMessagesToStoreInDB,
} from '../helpers/transformations'

// To send and store message on fdb
export const toSendMessage = (
  firebaseDB,
  chatId,
  userId,
  messages,
  eventId,
  recipientsIds,
  meta,
  createNewChat,
) => {
  const lastMessageTimeStamp = TimeFormat.toUnixTimestamp(meta.lastMessageCreatedAt)
  const msgs = transformMessagesToStoreInDB(userId)(messages)

  const messagesUpdate = msgs.reduce((result, message) => {
    // message[0] - author id, message[1] - message data
    const newResult = R.assoc(`chat-messages/${chatId}/${message[0]}`, message[1], result || {})
    return newResult
  }, 0)

  const unreadMessagesUpdate = msgs.reduce((result, message) => {
    let newResult = result || {}

    // eslint-disable-next-line
    recipientsIds.forEach((recipientId) =>
      newResult = R.assoc(
        `unread-messages/${recipientId}/${message[0]}`,
        {
          chatId,
          eventId,
        },
        newResult
      )
    )

    return newResult
  }, 0)

  const lastMessageCreatedAtUpdate = recipientsIds.reduce((result, participantId) => {
    const newResult = R.compose(
      R.assoc(`user-chats/${participantId}/${chatId}/lastMessageCreatedAt`, lastMessageTimeStamp),
      R.assoc(`user-event-chats/${participantId}/${eventId}/${chatId}/lastMessageCreatedAt`, lastMessageTimeStamp),
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
    [`user-event-chats/${userId}/${eventId}/${chatId}/lastMessageCreatedAt`]: lastMessageTimeStamp,
    ...messagesUpdate,
    ...unreadMessagesUpdate,
    ...lastMessageCreatedAtUpdate,
    ...chatMetaUpdate,
  }

  firebaseDB.update(entireUpdate)
}

export const checkForChatExistence = (
  firebaseDB,
  theUserId,
  uid,
  eventId,
) => new Promise((resolve) => {
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
