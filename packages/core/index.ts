import type {
  ChatMetadata,
  ChatMessage,
  ChatUser,
  UserChats,
  UserChatsEntity,
  Message,
  CollectionObject,
  UnreadMessage,
  ChatParticipant,
} from './models/database'
import { toUnixTimestamp, unixToJSDate } from './helpers/time-convertors'
import {
  transformMessagesToStoreInDB,
  loadMoreMessagesListTransform,
  listnerSingleMessageTransform,
  toFlatList,
  getMessagesIds,
} from './helpers/transformations'
import type { OnSendMessage, CreateEmptyChat } from './models/common'
import { createOnSendMessageUpdate, createEmptyChatUpdate } from './helpers/object-creators'

export {
  type ChatMetadata,
  type ChatMessage,
  type ChatUser,
  type UserChats,
  type UserChatsEntity,
  type Message,
  type CollectionObject,
  type UnreadMessage,
  type ChatParticipant,
  type OnSendMessage,
  type CreateEmptyChat,
  toUnixTimestamp,
  unixToJSDate,
  transformMessagesToStoreInDB,
  loadMoreMessagesListTransform,
  listnerSingleMessageTransform,
  toFlatList,
  getMessagesIds,
  createOnSendMessageUpdate,
  createEmptyChatUpdate,
}
