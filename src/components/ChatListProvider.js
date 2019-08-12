// @flow
import * as React from 'react'
import * as R from 'ramda'

import {
  chatMetadataRef,
  usersRef,
  userChatsAllRef,
} from '../firebase/references'
import { toFlatList } from '../helpers/transformations'
import type { UserChatsEntity } from '../common/flow'

type State = {|
  userChats: { [chatId: string]: UserChatsEntity },
  chatsData: Array<UserChatsEntity>,
  loading: boolean,
  error: false | Object,
|}

type Props = {|
  firebaseDBRef: Object,
  component: Object,
|}

class ChatListProvider extends React.Component<Props, State> {
  state = {
    /* eslint-disable react/no-unused-state */
    chatsData: [],
    error: false,
    loading: true,
    userChats: {},
  }

  chatListenerRef = null
  chatMetadatasListenerRef = []
  chatListDataFetch = ({
    // eventId,
    uid,
  }: {
    // eventId: string,
    uid: string,
  }) => {
    const { firebaseDBRef } = this.props
    if (uid) {
      this.chatListenerRef = userChatsAllRef(firebaseDBRef, uid)
        .orderByChild('lastMessageCreatedAt')
        // .limitToLast(5) // TODO pagination
        /* eslint-disable consistent-return */
        .on('value', (chatsSnapshot) => {
          const chatsMetaValues = chatsSnapshot.val()

          if (
            !chatsMetaValues ||
            !Object.keys(chatsMetaValues).length
          ) {
            return this.setState({
              loading: false,
            })
          }

          const chatsIds = Object.keys(chatsMetaValues || {})
          const allChatsParticipants = {}

          Promise.all(chatsIds.map(chatId => new Promise((res) => {
            const chatMetaRef = chatMetadataRef(firebaseDBRef, chatId)
              .on('value', (chatMetaSnapshot) => {
                let chatMetas = R.compose(
                  R.evolve({
                    users: R.dissoc(uid), // dissoc THE user
                  }),
                  R.assoc('participants', []),
                )(chatMetaSnapshot.val())

                chatMetas.unseenMessages = chatsMetaValues[chatId].unreadCount

                Promise.all(
                  R.keys(chatMetas.users)
                    .map(participantId =>
                      new Promise(resolve => usersRef(firebaseDBRef, participantId)
                        .on('value', (userSnapshot) => {
                          const userInfo = userSnapshot.val()
                          const userData = {
                            ...userInfo,
                            uid: participantId,
                          }

                          chatMetas = R.compose(
                            R.evolve({
                              participants: R.append(userData),
                            }),
                          )(chatMetas)

                          allChatsParticipants[participantId] = true

                          resolve()
                        })),
                    ),
                )
                  .then(() => res({
                    [chatId]: chatMetas,
                  }))
              })
            this.chatMetadatasListenerRef.push(chatMetaRef)
            return chatMetaRef
          }
          )))
            .then((data) => {
              Object.keys(allChatsParticipants)
                .map(participantId => (
                  usersRef(firebaseDBRef, participantId)
                    .off()
                ))

              const chats = data.reduce((acc, cur) => ({ ...acc, ...cur }), {})
              this.setState({
                chatsData: toFlatList(chats),
                loading: false,
                userChats: chats,
              })
            })
            .catch(error => (
              this.setState({
                loading: false,
                error,
              })
            ))
        }, (error) => {
          this.setState({
            loading: false,
            error,
          })
        })
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
