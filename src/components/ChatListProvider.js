// @flow
import * as React from 'react'
import R from 'ramda'

import {
  chatMetadataRef,
  userEventAllChatsRef,
  usersRef,
} from '../firebase/references'
import { toFlatList } from '../helpers/transformations'
import type { UserChatsEntity } from '../common/flow'

// TODO
type State = {|
  userChats: { [chatId: string]: UserChatsEntity },
  chatsData: Array<UserChatsEntity>,
  loading: boolean,
|}

type Props = {|
  firebaseDBRef: Object,
  component: Object,
|}

class ChatListProvider extends React.Component<Props, State> {
  state = {
    /* eslint-disable react/no-unused-state */
    chatsData: [],
    loading: true,
    userChats: {},
  }

  chatListDataFetch = ({
    eventId,
    uid,
  }) => {
    const { firebaseDBRef } = this.props

    userEventAllChatsRef(firebaseDBRef, uid, eventId)
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

        Promise.all(chatsIds.map(chatId => new Promise(res => chatMetadataRef(firebaseDBRef, chatId)
          .on('value', (chatMetaSnapshot) => {
            let chatMetas = R.compose(
              R.evolve({
                users: R.dissoc(uid), // dissoc THE user
              }),
              R.assoc('participants', [])
            )(chatMetaSnapshot.val())

            chatMetas.unseenMessages = chatsMetaValues[chatId].unreadCount

            Promise.all(
              R.keys(chatMetas.users).map(participantId =>
                new Promise(resolve => usersRef(firebaseDBRef, participantId)
                  .on('value', (userSnapshot) => {
                    const userInfo = userSnapshot.val()
                    const userData = { ...userInfo, uid: participantId }

                    chatMetas = R.compose(
                      R.evolve({
                        participants: R.append(userData),
                      }),
                    )(chatMetas)

                    usersRef(firebaseDBRef, participantId).off()

                    resolve()
                  }))
              )
            ).then(() => res({
              [chatId]: chatMetas,
            }))
          })
        ))).then((data) => {
          const chats = data.reduce((acc, cur) => ({ ...acc, ...cur }), {})

          this.setState({
            chatsData: toFlatList(chats),
            loading: false,
            userChats: chats,
          })
        })
      })
  }

  unsubscribeChatsData = ({
    eventId,
    uid,
  }) => {
    const { firebaseDBRef } = this.props

    userEventAllChatsRef(firebaseDBRef, uid, eventId).off()
    firebaseDBRef.child('chat-metadata').off()
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