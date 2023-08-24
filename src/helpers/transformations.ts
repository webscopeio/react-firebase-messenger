import * as R from "ramda";
import type {
  ChatMessage,
  ChatUser,
  CollectionObject,
  Message,
  UserChatsEntity,
} from "../common/database";
import { toUnixTimestamp, unixToJSDate } from "./time-convertors";

// js date to utc ms timestamp
// remove _id from message object
// array to object with _id's keys
/**
 * From `Message`s to `ChatMessage`s.
 */
export const transformMessagesToStoreInDB = (userId: string) =>
  R.compose<
    Message[][],
    { [_id: string]: Message },
    { [_id: string]: ChatMessage },
    Array<[string, ChatMessage]>
  >(
    R.toPairs,
    R.map(
      // TODO: Get rid of the any
      R.compose<any, any, any, any, any>(
        R.evolve({
          createdAt: toUnixTimestamp,
        }),
        R.assoc("userId", userId),
        R.dissoc("_id"),
        R.dissoc("user")
      )
    ),
    R.indexBy(R.prop("_id"))
  );

// Create user object in GiftedChat requires shape
// Add `user` (Message.user) object to message
const createUserObject =
  (participants: CollectionObject<ChatUser>) =>
  (messageObject: ChatMessage): ChatMessage & { user: Message["user"] } => {
    const participant = participants[messageObject.userId];

    return R.assoc(
      "user",
      {
        _id: messageObject.userId,
        name:
          (participant &&
            (participant.businessName ||
              `${participant.nameFirst} ${participant.nameLast}`)) ||
          "?", // TODO THIS UNIVERSAL
        photoUrl: (participant && participant.photoUrl) || undefined,
      },
      messageObject
    );
  };

// handling list of messages which are got from firebase
export const loadMoreMessagesListTransform =
  (participants: CollectionObject<ChatUser>) =>
  (messages: CollectionObject<ChatMessage>) =>
    R.compose<
      CollectionObject<ChatMessage>[],
      ChatMessage[],
      Message[],
      Message[]
    >(
      R.sortBy(R.prop("createdAt")),
      R.map(
        // TODO: get rid of any
        R.compose<any, any, any, any>(
          R.dissoc("_id"),
          R.evolve({
            createdAt: unixToJSDate,
          }),
          createUserObject(participants)
        )
      ),
      R.values
    )(messages);

// handling one single message which is got from firebase
export const listnerSingleMessageTransform =
  (messageKey: string | null, participants: CollectionObject<ChatUser>) =>
  (msg: ChatMessage): Message =>
    R.compose<
      ChatMessage[],
      ChatMessage & { user: Message["user"] },
      ChatMessage & Message,
      Omit<ChatMessage & Message, "userId">,
      Message
    >(
      R.dissoc("userId"),
      R.evolve<any>({
        createdAt: unixToJSDate,
      }),
      R.assoc("_id", messageKey),
      createUserObject(participants)
    )(msg);

// Transform data into FlatList requires shape
export const toFlatList = (
  userChats: CollectionObject<Omit<UserChatsEntity, "chatId">>
): Array<UserChatsEntity> =>
  R.compose<
    CollectionObject<Omit<UserChatsEntity, "chatId">>[],
    any,
    Array<UserChatsEntity>,
    Array<UserChatsEntity>,
    Array<UserChatsEntity>
  >(R.reverse, R.sortBy(R.prop("lastMessageCreatedAt")), R.values, (item) => {
    // item is CollectionObject<UserChatsEntity>
    const chatsIds = R.keys(item); // ids of chats

    chatsIds.forEach((id) => {
      // item[id] is Omit<UserChatsEntity, 'chatId'>
      item[id] = R.compose<Omit<UserChatsEntity, "chatId">[], UserChatsEntity>(
        R.assoc("chatId", id)
      // @ts-ignore // TODO: fix this however it should not throw error even it does :(
      )(item[id]);
    });

    return item;
  })(userChats);

// eslint-disable-next-line no-underscore-dangle
export const getMessagesIds = R.map<Message, string>((message) => message._id);
