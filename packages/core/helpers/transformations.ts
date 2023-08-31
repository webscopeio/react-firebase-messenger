import R from 'ramda'

import { ChatMessage, ChatUser, CollectionObject, Message, UserChatsEntity } from '../models/database'
import { toUnixTimestamp, unixToJSDate } from './time-convertors'

// js date to utc ms timestamp
// remove _id from message object
// array to object with _id's keys
/**
 * From `Message`s to `ChatMessage`s.
 */
export const transformMessagesToStoreInDB = (userId: string) =>
  R.compose<Message[][], CollectionObject<Message>, CollectionObject<ChatMessage>, Array<[string, ChatMessage]>>(
    R.toPairs,
    R.map(
      // TODO: Get rid of the any
      R.compose<any, any, any, any, any>(
        R.evolve({
          createdAt: toUnixTimestamp,
        }),
        R.assoc('userId', userId),
        R.dissoc('_id'),
        R.dissoc('user'),
      ),
    ),
    R.indexBy(R.prop('_id')),
  )

// Create user object in GiftedChat requires shape
const createUserObject = (participants: CollectionObject<ChatUser>) => (messageObject: ChatMessage) => {
  const participant = participants[messageObject.userId]

  return R.assoc(
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
  R.compose<CollectionObject<ChatMessage>[], ChatMessage[], Message[], Message[]>(
    // R.reverse,
    R.sortBy(R.prop('createdAt')),
    R.map(
      R.compose<any, any, any, any>(
        R.dissoc('userId'),
        R.evolve({
          createdAt: unixToJSDate,
        }),
        createUserObject(participants),
      ),
    ),
    R.values,
  )

// handling one single message which is got from firebase
export const listnerSingleMessageTransform = (
  messageSnippetKey: string | null,
  participants: CollectionObject<ChatUser>,
) =>
  R.compose<
    ChatMessage[],
    ChatMessage & { user: Message['user'] },
    ChatMessage & Message,
    Omit<ChatMessage & Message, 'userId'>,
    Message
  >(
    R.dissoc('userId'),
    R.evolve<any>({
      createdAt: unixToJSDate,
    }),
    R.assoc('_id', messageSnippetKey),
    createUserObject(participants),
  )

// Transform data into FlatList requires shape
export const toFlatList = (userChats: CollectionObject<Omit<UserChatsEntity, 'chatId'>>) =>
  R.compose<
    CollectionObject<Omit<UserChatsEntity, 'chatId'>>[],
    any,
    Array<UserChatsEntity>,
    Array<UserChatsEntity>,
    Array<UserChatsEntity>
  >(R.reverse, R.sortBy(R.prop('lastMessageCreatedAt')), R.values, (item) => {
    const keys = R.keys(item)
    keys.forEach(
      // @ts-ignore // TODO: fix this however it should not throw error even it does :(
      (key) => (item[key] = R.compose(R.assoc('chatId', key))(item[key])),
    )

    return item
  })(userChats)

// eslint-disable-next-line no-underscore-dangle
export const getMessagesIds = R.map<Message, string>((message) => message._id)
