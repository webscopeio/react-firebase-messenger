import { compose, map, toPairs, assoc, dissoc, evolve, sortBy, prop, values, reverse, indexBy, keys } from 'rambda'

import { ChatMessage, ChatUser, CollectionObject, Message, UserChatsEntity } from '../models/database'
import { toUnixTimestamp, unixToJSDate } from './time-convertors'

// js date to utc ms timestamp
// remove _id from message object
// array to object with _id's keys
/**
 * From `Message`s to `ChatMessage`s.
 */
export const transformMessagesToStoreInDB = (userId: string) =>
  compose<Message[][], CollectionObject<Message>, CollectionObject<ChatMessage>, Array<[string, ChatMessage]>>(
    toPairs,
    // @ts-ignore evolved type is not correct with map
    map(
      compose(
        // @ts-ignore evolved type is not correct with map
        evolve({
          createdAt: toUnixTimestamp,
        }),
        assoc('userId', userId),
        dissoc('_id'),
        dissoc('user'),
      ),
    ),
    indexBy(prop('_id')),
  ) as (messages: Message[]) => Array<[string, ChatMessage]>

// Create user object in GiftedChat requires shape
const createUserObject = (participants: CollectionObject<ChatUser>) => (messageObject: ChatMessage) => {
  const participant = participants[messageObject.userId]

  return assoc(
    'user',
    {
      _id: messageObject.userId,
      name: (participant && (participant.businessName || `${participant.nameFirst} ${participant.nameLast}`)) || '?', // TODO THIS UNIVERSAL
      photoUrl: (participant && participant.photoUrl) || undefined,
    },
    messageObject,
  )
}

// handling list of messages which are got from firebase
export const loadMoreMessagesListTransform = (participants: CollectionObject<ChatUser>) =>
  compose<CollectionObject<ChatMessage>[], ChatMessage[], Message[], Message[]>(
    // reverse,
    sortBy(prop('createdAt')),
    map(
      compose<any, any, any, any>(
        dissoc('userId'),
        evolve({
          createdAt: unixToJSDate,
        }),
        createUserObject(participants),
      ),
    ),
    values,
  )

// handling one single message which is got from firebase
export const listnerSingleMessageTransform = (
  messageSnippetKey: string | null,
  participants: CollectionObject<ChatUser>,
) =>
  compose<
    ChatMessage[],
    ChatMessage & { user: Message['user'] },
    ChatMessage & Message,
    Omit<ChatMessage & Message, 'userId'>,
    Message
  >(
    dissoc('userId'),
    evolve<any>({
      createdAt: unixToJSDate,
    }),
    // @ts-ignore
    assoc('_id', messageSnippetKey),
    createUserObject(participants),
  ) as (...messages: ChatMessage[]) => Message

// Transform data into FlatList requires shape
export const toFlatList = (userChats: CollectionObject<Omit<UserChatsEntity, 'chatId'>>) =>
  compose<
    CollectionObject<Omit<UserChatsEntity, 'chatId'>>[],
    any,
    Array<UserChatsEntity>,
    Array<UserChatsEntity>,
    Array<UserChatsEntity>
  >(reverse, sortBy(prop('lastMessageCreatedAt')), values, (item) => {
    const lKeys = keys(item)
    lKeys.forEach(
      // @ts-ignore // TODO: fix this however it should not throw error even it does :(
      (key) => (item[key] = compose(assoc('chatId', key))(item[key])),
    )

    return item
  })(userChats)

// eslint-disable-next-line no-underscore-dangle
export const getMessagesIds = map<Message, string>((message) => message._id)
