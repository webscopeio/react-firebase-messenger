import React from 'react'
import { compose, keys, evolve, append, assoc, dissoc } from 'rambda'
import { chatMetadataRef, usersRef, userChatsAllRef } from '../helpers/references'
import { FirebaseDatabaseTypes } from '@react-native-firebase/database'
import {
  type ChatMetadata,
  type CollectionObject,
  type UserChatsEntity,
  toFlatList,
} from '@webscopeio/react-firebase-messenger'

type State = {
  userChats: { [chatId: string]: UserChatsEntity }
  chatsData: Array<UserChatsEntity>
  loading: boolean
  error: false | Object
}

type Props = {
  firebaseDBRef: FirebaseDatabaseTypes.Reference
  component: React.ComponentType<any>
}

class ChatListProvider extends React.Component<Props, State> {
  state = {
    chatsData: [],
    error: false,
    loading: true,
    userChats: {},
  }

  chatListenerRef: FirebaseDatabaseTypes.Reference | null = null
  chatMetadatasListenerRef: FirebaseDatabaseTypes.Reference[] = []
  chatListDataFetch = ({
    // eventId,
    uid,
  }: {
    // eventId: string,
    uid: string
  }) => {
    const { firebaseDBRef } = this.props
    if (uid) {
      this.chatListenerRef = userChatsAllRef(firebaseDBRef, uid)
      // .limitToLast(5) // TODO pagination

      this.chatListenerRef.orderByChild('lastMessageCreatedAt').on(
        'value',
        (chatsSnapshot) => {
          // TODO resolve any
          const chatsMetaValues: CollectionObject<any> = chatsSnapshot.val()

          if (!chatsMetaValues || !Object.keys(chatsMetaValues).length) {
            return this.setState({
              loading: false,
            })
          }

          const chatsIds = Object.keys(chatsMetaValues || {})
          const allChatsParticipants: CollectionObject<true> = {}

          Promise.all(
            chatsIds.map(
              (chatId) =>
                new Promise((res) => {
                  const chatMetaRef = chatMetadataRef(firebaseDBRef, chatId)
                  const chatMetaListener = chatMetadataRef(firebaseDBRef, chatId).on('value', (chatMetaSnapshot) => {
                    // TODO resolve any
                    let chatMetas = compose<
                      Omit<UserChatsEntity & { users: ChatMetadata['users'] }, 'participants'>[],
                      UserChatsEntity & { users: ChatMetadata['users'] },
                      UserChatsEntity & { users: ChatMetadata['users'] }
                    >(
                      evolve<any>({
                        users: dissoc(uid), // dissoc THE user
                      }),
                      assoc('participants', []),
                    )(chatMetaSnapshot.val())

                    // TODO how does it have `unreadCount` field
                    chatMetas.unseenMessages = chatsMetaValues[chatId].unreadCount

                    Promise.all(
                      keys(chatMetas.users).map(
                        (id) =>
                          new Promise((resolve) => {
                            // It is save to cast `id` to string
                            const participantId: string = id as string
                            return usersRef(firebaseDBRef, participantId).on('value', (userSnapshot) => {
                              const userInfo = userSnapshot.val()
                              const userData = {
                                ...userInfo,
                                uid: participantId,
                              }

                              chatMetas = compose(
                                evolve({
                                  participants: append(userData),
                                }),
                              )(chatMetas) as UserChatsEntity & { users: ChatMetadata['users'] }

                              allChatsParticipants[participantId] = true
                              // resolve participantId just to fulfill the promise
                              resolve(participantId)
                            })
                          }),
                      ),
                    ).then(() =>
                      res({
                        [chatId]: chatMetas,
                      }),
                    )
                  })

                  this.chatMetadatasListenerRef.push(chatMetaRef)
                  return chatMetaListener
                }),
            ),
          )
            // data type inherited from line 106 : Array<CollectionObject<UserChatsEntity>>
            .then((data) => {
              Object.keys(allChatsParticipants).map((participantId) => usersRef(firebaseDBRef, participantId).off())
              // TODO what type is data?
              const chats = (data as Array<CollectionObject<UserChatsEntity>>).reduce<
                CollectionObject<UserChatsEntity>
              >((acc, cur) => ({ ...acc, ...cur }), {})
              this.setState({
                chatsData: toFlatList(chats),
                loading: false,
                userChats: chats,
              })
            })
            .catch((error) =>
              this.setState({
                loading: false,
                error,
              }),
            )
        },
        (error) => {
          this.setState({
            loading: false,
            error,
          })
        },
      )
    }
  }

  unsubscribeChatsData = () => {
    if (this.chatListenerRef) {
      this.chatListenerRef.off()
    }

    this.chatMetadatasListenerRef.forEach((metadataRef) => {
      if (metadataRef) {
        metadataRef.off()
      }
    })
  }

  render() {
    const { component: ChatList, ...rest } = this.props

    return (
      <ChatList
        chatListDataFetch={this.chatListDataFetch}
        chatListProps={this.state}
        unsubscribeChatsData={this.unsubscribeChatsData}
        {...rest}
      />
    )
  }
}

export default ChatListProvider
