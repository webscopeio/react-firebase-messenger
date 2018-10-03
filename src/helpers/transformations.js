import * as R from 'ramda'

import {
  toUnixTimestamp,
  unixToJSDate,
} from './time-convertors'

// js date to utc ms timestamp
// remove _id from message object
// array to object with _id's keys
export const transformMessagesToStoreInDB = userId => R.compose(
  R.toPairs,
  R.map(
    R.compose(
      R.evolve({
        createdAt: toUnixTimestamp,
      }),
      R.assoc('userId', userId),
      R.dissoc('_id'),
      R.dissoc('user'),
    )
  ),
  R.indexBy(R.prop('_id')),
)

// Create user object for GiftedChat
const createUserObject = participants => messageObject =>
  R.assoc('user', {
    _id: messageObject.userId,
    name: (participants[messageObject.userId]
      && participants[messageObject.userId].displayName)
      || '?', // TODO THE user name
    photoURL: (participants[messageObject.userId]
      && participants[messageObject.userId].photoURL)
      || undefined,
  }, messageObject) // TODO name, avatar

// handling list of messages which are got from firebase
export const loadMoreMessagesListTransform = participants => R.compose(
  // R.reverse,
  R.sortBy(R.prop('createdAt')),
  R.map(
    R.compose(
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
export const listnerSingleMessageTransform = (messageSnippet, participants) =>
  R.compose(
    R.dissoc('userId'),
    R.evolve({
      createdAt: unixToJSDate,
    }),
    R.assoc('_id', messageSnippet.key),
    createUserObject(participants),
  )

// Transform data into FlatList requires shape
export const toFlatList = userChats => R.compose(
  R.reverse,
  R.sortBy(R.prop('lastMessageCreatedAt')),
  R.values,
  (item) => {
    const keys = R.keys(item)
    /* eslint-disable no-return-assign */
    /* eslint-disable no-param-reassign */
    keys.forEach(key => item[key] = R.compose(
      R.assoc('chatId', key),
    )(item[key]))

    return item
  },
)(userChats)

/* eslint-disable no-underscore-dangle */
export const getMessagesIds = R.map(message => message._id)
