import * as R from "ramda";
import {
  type DatabaseReference,
  child,
  off,
  update,
  orderByChild,
  startAt,
  onValue,
  query,
  equalTo,
} from "firebase/database";
import { toUnixTimestamp } from "../helpers/time-convertors";
import { transformMessagesToStoreInDB } from "../helpers/transformations";
import type {
  ChatMessage,
  ChatMetadata,
  CollectionObject,
  Message,
  UnreadMessage,
} from "../common/database";
import { chatMetadataRef } from "./references";

// To send and store message on fdb
export const toSendMessage = ({
  firebaseDB,
  chatId,
  userId,
  messages,
  eventId,
  recipientsIds,
  meta,
  createNewChat,
}: {
  firebaseDB: DatabaseReference;
  chatId: string;
  userId: string;
  messages: Array<Message>;
  eventId: string;
  recipientsIds: Array<string>;
  meta: Pick<
    ChatMetadata,
    "lastMessageAuthorId" | "lastMessageCreatedAt" | "lastMessageText"
  >;
  createNewChat?: boolean;
}) => {
  const lastMessageTimeStamp = toUnixTimestamp(meta.lastMessageCreatedAt);
  const msgs = transformMessagesToStoreInDB(userId)(messages);

  const messagesUpdate = msgs.reduce<CollectionObject<ChatMessage>>(
    (result, message) => {
      // message[0] - author id, message[1] - message data
      const newResult = R.assoc(
        `chat-messages/${chatId}/${message[0]}`,
        message[1],
        result || {}
      );
      return newResult;
    },
    {}
  );

  const unreadMessagesUpdate = msgs.reduce<CollectionObject<UnreadMessage>>(
    (result, message) => {
      let newResult = result || {};

      recipientsIds.forEach((recipientId) => {
        if (recipientId !== userId) {
          newResult = R.assoc(
            `unread-messages/${recipientId}/${message[0]}`,
            {
              chatId,
              eventId,
            },
            newResult
          );
        }
      });
      return newResult;
    },
    {}
  );

  const lastMessageCreatedAtUpdate = recipientsIds.reduce<
    CollectionObject<string>
  >((result, participantId) => {
    const newResult = R.compose(
      R.assoc(
        `user-chats/${participantId}/${chatId}/lastMessageCreatedAt`,
        lastMessageTimeStamp
      )
      /* //
      R.assoc(`user-event-chats/${participantId}/${eventId}/${chatId}/lastMessageCreatedAt`,
      lastMessageTimeStamp), //
      */
    )(result || {});
    return newResult;
  }, {});

  // When creating new chat also include such properties as users(participants) and eventId
  const chatMetaUpdate: CollectionObject<string | typeof meta> = createNewChat
    ? {
        [`chat-metadata/${chatId}`]: meta,
      }
    : {
        [`chat-metadata/${chatId}/lastMessageAuthorId`]:
          meta.lastMessageAuthorId,
        [`chat-metadata/${chatId}/lastMessageCreatedAt`]: `${meta.lastMessageCreatedAt.toISOString()}`,
        [`chat-metadata/${chatId}/lastMessageText`]: meta.lastMessageText,
      };

  const entireUpdate = {
    [`user-chats/${userId}/${chatId}/lastMessageCreatedAt`]:
      lastMessageTimeStamp,
    /* //
    [`user-event-chats/${userId}/${eventId}/${chatId}/lastMessageCreatedAt`]: lastMessageTimeStamp,
    */
    ...messagesUpdate,
    ...unreadMessagesUpdate,
    ...lastMessageCreatedAtUpdate,
    ...chatMetaUpdate,
  };
  update(firebaseDB, entireUpdate);
};

export const createEmptyChat = (
  firebaseDB: DatabaseReference,
  chatId: string,
  userId: string,
  eventId: string,
  recipientsIds: Array<string>,
  meta: ChatMetadata
) => {
  const lastMessageTimeStamp = toUnixTimestamp(meta.lastMessageCreatedAt);

  const lastMessageCreatedAtUpdate = recipientsIds.reduce(
    (result, participantId) => {
      const newResult = R.compose(
        R.assoc(
          `user-chats/${participantId}/${chatId}/lastMessageCreatedAt`,
          lastMessageTimeStamp
        )
      )(result);
      return newResult;
    },
    {}
  );

  const entireUpdate = {
    // TODO THIS FOR ALL RECIPIENTS >>>>
    [`user-chats/${userId}/${chatId}/lastMessageCreatedAt`]:
      lastMessageTimeStamp,
    [`chat-metadata/${chatId}`]: meta,
    ...lastMessageCreatedAtUpdate,
  };

  update(firebaseDB, entireUpdate);
};

export const addUserToChat = (
  firebaseDB: DatabaseReference,
  uid: string,
  chatId: string
) => {
  const upp: Promise<ChatMetadata> = new Promise((resolve) => {
    const childRef = chatMetadataRef(firebaseDB, chatId);
    return onValue(childRef, (snap) => resolve(snap.val()), { onlyOnce: true });
  });

  upp.then((chatData) => {
    const entireUpdate = {
      [`chat-metadata/${chatId}/users/${uid}`]: true,
      [`user-chats/${uid}/${chatId}/lastMessageCreatedAt`]: toUnixTimestamp(
        chatData.lastMessageCreatedAt
      ),
    };

    update(firebaseDB, entireUpdate);
  });
};

export const checkForChatExistence = (
  firebaseDB: DatabaseReference,
  theUserId: string,
  uid: string,
  eventId: string
) =>
  new Promise((resolve) => {
    const childRef = child(firebaseDB, "chat-metadata");
    onValue(
      query(childRef, orderByChild(`users/${theUserId}`), startAt(true)),
      (snap) => {
        const chats = R.toPairs(snap.val());

        const filtredChats = chats.filter((chat) => {
          const chatMetas = chat[1];
          const chatParticipants = R.keys(chatMetas.users);
          const ind = chatParticipants.indexOf(uid);

          return (
            ind !== -1 && // chat exists
            chatParticipants.length === 2 && // chat is private
            eventId === chatMetas.eventId
          ); // chat is in the event scope
        });

        off(childRef);
        resolve(filtredChats);
      }
    );
  });

export const getGroupChatsByEvent = (
  firebaseDB: DatabaseReference,
  eventId: string
): Promise<Object> =>
  new Promise((resolve) => {
    const childRef = child(firebaseDB, "chat-metadata");
    const queryRef = query(childRef, orderByChild("eventId"), equalTo(eventId));
    onValue(queryRef, (snap) => {
      const chats = snap.val();
      off(childRef);
      resolve(chats);
    });
  });

export const getChatById = (
  firebaseDB: DatabaseReference,
  chatId: string
): Promise<ChatMetadata> =>
  new Promise((resolve) => {
    const childRef = chatMetadataRef(firebaseDB, chatId);
    onValue(childRef, (snap) => {
      const chat = snap.val();
      // not sure if we need to off `childRef` here
      off(childRef);
      resolve(chat);
    });
  });
