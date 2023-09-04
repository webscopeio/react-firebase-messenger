import { assoc, compose } from 'rambda'
import type { CollectionObject, ChatMessage, UnreadMessage } from '../models/database'
import { toUnixTimestamp } from './time-convertors'
import { transformMessagesToStoreInDB } from './transformations'
import type { CreateEmptyChat, OnSendMessage } from '../models/common'

export const createOnSendMessageUpdate = ({
  chatId,
  userId,
  messages,
  eventId,
  recipientsIds,
  meta,
  createNewChat,
}: OnSendMessage) => {
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

  return entireUpdate
}

export const createEmptyChatUpdate = ({ chatId, userId, recipientsIds, meta }: CreateEmptyChat) => {
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

  return entireUpdate
}
