// @flow
import React from 'react'
import * as R from 'ramda'
import {
  chatMessagesRef,
  usersRef,
} from '../firebase/references'

import {
  checkForChatExistence,
  toSendMessage,
  getGroupChatsByEvent,
} from '../firebase/calls'

import {
  getMessagesIds,
  listnerSingleMessageTransform,
  loadMoreMessagesListTransform,
} from '../helpers/transformations'
import type { Message } from '../common/flow'

type Props = {
  firebaseDBRef: Object,
  component: Object,
}

type State = {
  initialLoad: boolean,
  isLoadingEarlier: boolean,
  hasMoreToLoad: boolean,
  messages: Array<Message>,
  messagesCount: number,
  tempChatIdStore: string,
}

const MESSAGE_PACKAGE_COUNT = 10
const chatDefaultState = {
  initialLoad: true,
  isLoadingEarlier: false,
  messages: [],
  messagesCount: 0,
  tempChatIdStore: '',
  hasMoreToLoad: true,
}

const emptyFunc = () => null

const ChatProviderWrapper = (firebaseDB: any, ComposedComponent: Object) => {
  class ChatProvider extends React.Component<Props, State> {
    state = chatDefaultState
    resetChat = (callback: Function) => this.setState(chatDefaultState, callback || emptyFunc)

    chatListner = ({
      participants,
      webMessageTransform,
    }) => (chatId: string, newChat?: boolean) => {
      const { initialLoad } = this.state

      // we want to fetch first N messages at once
      if (!newChat && initialLoad) {
        chatMessagesRef(firebaseDB, chatId)
          .orderByChild('createdAt')
          .limitToLast(MESSAGE_PACKAGE_COUNT)
          .on('value', (messagesSnap) => {
            /*
            * Here we fetch first batch of the messages at once and process them for the chat
            * component. After that we push them to state, mark initial load as done and unsubsribe
            * from value listener as we will listen only to child_added events after that. In order
            * to display lates send message.
            */
            const processedMessages = []

            messagesSnap.forEach((messageSnippet) => {
              const message = listnerSingleMessageTransform(
                messageSnippet,
                participants
              )(messageSnippet.val())

              processedMessages.push(message)
            })

            const updatedMesseges = R.concat(
              !webMessageTransform
                ? processedMessages.reverse()
                : processedMessages,
              this.state.messages
            )

            this.setState({
              messages: updatedMesseges,
              messagesCount: this.state.messagesCount + processedMessages.length,
              initialLoad: false,
            })

            chatMessagesRef(firebaseDB, chatId).off('value')
          })
      } else {
        chatMessagesRef(firebaseDB, chatId)
          .orderByChild('createdAt')
          .limitToLast(MESSAGE_PACKAGE_COUNT)
          .on('child_added', (messageSnippet) => {
            const message = listnerSingleMessageTransform(messageSnippet, participants)(
              messageSnippet.val()
            )

            // We have to check for duplicates since we get already fetched node as well after
            // initial load
            /* eslint-disable no-underscore-dangle */
            if (this.state.messages.some(m => m._id === message._id)) {
              return
            }

            const updatedMesseges = webMessageTransform
              ? R.append(message, this.state.messages)
              : R.prepend(message, this.state.messages)

            this.setState({
              messages: updatedMesseges,
              messagesCount: this.state.messagesCount + 1,
              initialLoad: false,
            })
          })
      }
    }

    createNewChat = ({
      newChatId,
      eventId,
      uid,
      recipientsIds,
    }: {
      newChatId: string,
      eventId: string,
      uid: string,
      recipientsIds: Array<string>,
    }) => (messages: Array<Message>) => {
      const newChatMetaUpdate = {
        lastMessageText: R.last(messages).text,
        lastMessageCreatedAt: R.last(messages).createdAt,
        lastMessageAuthorId: uid,
        users: {},
        eventId,
        // now all of them are private by default
        type: 'private',
      }
      const participants = R.concat([uid], recipientsIds)

      participants.forEach((id) => {
        newChatMetaUpdate.users[id] = true
      })

      toSendMessage({
        firebaseDB,
        chatId: newChatId,
        userId: uid,
        messages,
        eventId,
        recipientsIds,
        meta: newChatMetaUpdate,
        createNewChat: true,
        // now all of them are private by default
        createPrivateChat: true,
      })

      this.setState({
        /* eslint-disable react/no-unused-state */
        tempChatIdStore: newChatId,
      })
    }

    onSend = ({
      chatId,
      uid,
      eventId,
      recipientsIds,
      messages,
    }) => {
      toSendMessage({
        firebaseDB,
        chatId,
        userId: uid,
        messages,
        eventId,
        recipientsIds,
        meta: {
          lastMessageText: R.last(messages).text,
          lastMessageCreatedAt: R.last(messages).createdAt,
          lastMessageAuthorId: uid,
        },
      })
    }

    unsubscribeChatMessages = (chatId: string) =>
      chatMessagesRef(firebaseDB, chatId)
        .off()

    loadMoreMessages = ({
      chatId,
      participants,
      callBack,
      webMessageTransform,
    }: {
      chatId: string,
      participants: Object,
      callBack: Function,
      webMessageTransform: Function,
    }) => {
      const { messagesCount } = this.state
      const updatedMsgsCount = messagesCount + MESSAGE_PACKAGE_COUNT
      // draft
      // .startAt(this.state.last || 0)
      // .limitToFirst(5)
      // TODO fetch interval 5/+5/+5/...

      // chatMessagesRef(firebaseDBRef, chatId).keepSynced(true) // TODO maybe do it better way
      // fetch last 5/10/15/20/...

      this.setState({ isLoadingEarlier: true }, () => {
        chatMessagesRef(firebaseDB, chatId)
          .orderByChild('createdAt')
          .limitToLast(updatedMsgsCount)
          .once('value') // TODO via on and unsubscription
          .then((chatMsgs) => {
            const messagesFromDB = chatMsgs.val()

            if (R.values(messagesFromDB).length > this.state.messages.length) {
              // add to message's id to other message's object
              chatMsgs.forEach((item) => {
                /* eslint-disable no-underscore-dangle */
                messagesFromDB[item.key]._id = item.key
              })

              const loadedMessages = loadMoreMessagesListTransform(participants)(messagesFromDB)
              const hasMoreToLoad = loadedMessages.length === updatedMsgsCount

              this.setState({
                hasMoreToLoad,
                isLoadingEarlier: false,
                messages: webMessageTransform
                  ? loadedMessages
                  : R.reverse(loadedMessages),
                messagesCount: updatedMsgsCount,
              }, callBack || emptyFunc)
            }
          })
      })
    }

    markMessagesRead = ({
      uid,
      prevMessages,
    }: {
      uid: string,
      prevMessages: any,
    }) => {
      const {
        messages,
      } = this.state
      const messagesIds = getMessagesIds(messages)
      const prevMessagesIds = getMessagesIds(prevMessages)

      const diff = R.difference(messagesIds, prevMessagesIds)

      if (diff.length) {
        const unreadMessagesToDeleteUpdate = diff.reduce((result, messageId) => {
          const newResult = R.assoc(`unread-messages/${uid}/${messageId}`, null, result || {})
          return newResult
        }, 0)

        firebaseDB.update(unreadMessagesToDeleteUpdate)
      }
    }

    checkForChat = ({
      theUserId,
      uid,
      eventId,
    }: {
      theUserId: string,
      uid: string,
      eventId: string,
      /* eslint-disable-next-line */
    }) => {
      return checkForChatExistence(
        firebaseDB,
        theUserId,
        uid,
        eventId
      )
    }

    getChatParticipantsDetails = async (participants: Object) => {
      const allChatsParticipants = {}
      await Promise.all(
        R.keys(participants).map(participantId =>
          new Promise(resolve => usersRef(firebaseDB, participantId)
            .once('value', (userSnapshot) => {
              const userInfo = userSnapshot.val()
              const userData = { ...userInfo, uid: participantId }

              allChatsParticipants[participantId] = userData

              resolve()
            }))
        )
      )

      return allChatsParticipants
    }

    getGroupChatsByEvent = (eventId: string) => getGroupChatsByEvent(firebaseDB, eventId)

    render() {
      return (
        <ComposedComponent
          chatListner={this.chatListner}
          createNewChat={this.createNewChat}
          markMessagesRead={this.markMessagesRead}
          loadMoreMessages={this.loadMoreMessages}
          unsubscribeChatMessages={this.unsubscribeChatMessages}
          onSend={this.onSend}
          chatProps={{ ...this.state, MESSAGE_PACKAGE_COUNT }}
          resetChat={this.resetChat}
          loadMore={this.loadMoreMessages}
          checkForChat={this.checkForChat}
          getGroupChatsByEvent={this.getGroupChatsByEvent}
          getChatParticipantsDetails={this.getChatParticipantsDetails}
          {...this.props}
        />
      )
    }
  }

  return ChatProvider
}

export default ChatProviderWrapper
