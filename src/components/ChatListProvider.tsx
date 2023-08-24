import * as React from "react";
import * as R from "ramda";
import {
  onValue,
  type DatabaseReference,
  off,
  orderByChild,
  query,
} from "firebase/database";
import {
  chatMetadataRef,
  usersRef,
  userChatsAllRef,
} from "../firebase/references";
import { toFlatList } from "../helpers/transformations";
import type {
  ChatMetadata,
  CollectionObject,
  UserChatsEntity,
} from "../common/flow";

type State = {
  userChats: { [chatId: string]: UserChatsEntity };
  chatsData: Array<UserChatsEntity>;
  loading: boolean;
  error: false | Object;
};

type Props = {
  firebaseDBRef: DatabaseReference;
  component: React.ComponentType<any>;
};

class ChatListProvider extends React.Component<Props, State> {
  state = {
    chatsData: [],
    error: false,
    loading: true,
    userChats: {},
  };

  chatListenerRef: DatabaseReference | null = null;
  chatMetadatasListenerRef: DatabaseReference[] = [];
  chatListDataFetch = ({
    // eventId,
    uid,
  }: {
    // eventId: string,
    uid: string;
  }) => {
    const { firebaseDBRef } = this.props;
    if (uid) {
      this.chatListenerRef = userChatsAllRef(firebaseDBRef, uid);
      // .limitToLast(5) // TODO pagination

      const orderByChildRef = orderByChild("lastMessageCreatedAt");
      const queryRef = query(this.chatListenerRef, orderByChildRef);
      onValue(
        queryRef,
        (chatsSnapshot) => {
          // TODO resolve any
          const chatsMetaValues: CollectionObject<any> = chatsSnapshot.val();

          if (!chatsMetaValues || !Object.keys(chatsMetaValues).length) {
            return this.setState({
              loading: false,
            });
          }

          const chatsIds = Object.keys(chatsMetaValues || {});
          const allChatsParticipants: CollectionObject<true> = {};

          Promise.all(
            chatsIds.map(
              (chatId) =>
                new Promise((res) => {
                  const chatMetaRef = chatMetadataRef(firebaseDBRef, chatId);
                  const chatMetaListener = onValue(
                    chatMetaRef,
                    (chatMetaSnapshot) => {
                      // TODO resolve any
                      let chatMetas = R.compose<
                        Omit<
                          UserChatsEntity & { users: ChatMetadata["users"] },
                          "participants"
                        >[],
                        UserChatsEntity & { users: ChatMetadata["users"] },
                        UserChatsEntity & { users: ChatMetadata["users"] }
                      >(
                        R.evolve<any>({
                          users: R.dissoc(uid), // dissoc THE user
                        }),
                        R.assoc("participants", [])
                      )(chatMetaSnapshot.val());

                      // TODO how does it have `unreadCount` field
                      chatMetas.unseenMessages =
                        chatsMetaValues[chatId].unreadCount;

                      Promise.all(
                        R.keys(chatMetas.users).map(
                          (id) =>
                            new Promise((resolve) => {
                              // It is save to cast `id` to string
                              const participantId: string = id as string;
                              const user = usersRef(
                                firebaseDBRef,
                                participantId
                              );
                              return onValue(user, (userSnapshot) => {
                                const userInfo = userSnapshot.val();
                                const userData = {
                                  ...userInfo,
                                  uid: participantId,
                                };

                                chatMetas = R.compose(
                                  R.evolve({
                                    participants: R.append(userData),
                                  })
                                )(chatMetas);

                                allChatsParticipants[participantId] = true;
                                // resolve participantId just to fulfill the promise
                                resolve(participantId);
                              });
                            })
                        )
                      ).then(() =>
                        res({
                          [chatId]: chatMetas,
                        })
                      );
                    }
                  );

                  this.chatMetadatasListenerRef.push(chatMetaRef);
                  return chatMetaListener;
                })
            )
          )
            // data type inherited from line 106 : Array<CollectionObject<UserChatsEntity>>
            .then((data) => {
              Object.keys(allChatsParticipants).map((participantId) =>
                off(usersRef(firebaseDBRef, participantId))
              );
              // TODO what type is data?
              const chats = (
                data as Array<CollectionObject<UserChatsEntity>>
              ).reduce<CollectionObject<UserChatsEntity>>(
                (acc, cur) => ({ ...acc, ...cur }),
                {}
              );
              this.setState({
                chatsData: toFlatList(chats),
                loading: false,
                userChats: chats,
              });
            })
            .catch((error) =>
              this.setState({
                loading: false,
                error,
              })
            );
        },
        (error) => {
          this.setState({
            loading: false,
            error,
          });
        }
      );
    }
  };

  unsubscribeChatsData = () => {
    if (this.chatListenerRef) {
      off(this.chatListenerRef);
    }

    this.chatMetadatasListenerRef.forEach((metadataRef) => {
      if (metadataRef) {
        off(metadataRef);
      }
    });
  };

  render() {
    const { component: ChatList, ...rest } = this.props;

    return (
      <ChatList
        chatListDataFetch={this.chatListDataFetch}
        chatListProps={this.state}
        unsubscribeChatsData={this.unsubscribeChatsData}
        {...rest}
      />
    );
  }
}

export default ChatListProvider;
