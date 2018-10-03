// @flow
import React from 'react'
import * as R from 'ramda'
import PropTypes from 'prop-types'

import { chatMessagefRef } from '../firebase/references'
import {
  toSendMessage,
  checkForChatExistence,
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
  messages: Array<Message>,
  messagesCount: number,
  tempChatIdStore: string,
  initialLoad: boolean,
}

const MESSAGE_PACKAGE_COUNT = 10
const chatDefaultState = {
  messages: [],
  messagesCount: 0,
  tempChatIdStore: '',
  initialLoad: true,
}

const emptyFunc = () => null

const ChatProviderWrapper = (ComposedComponent) => {
  class ChatProvider extends React.Component<Props, State> {
    state = chatDefaultState

    static contextTypes = {
      firebaseDB: PropTypes.object.isRequired,
    }

    resetChat = (callback: Function) => this.setState(chatDefaultState, callback || emptyFunc)

    chatListner = ({
      participants,
      webMessageTransform,
    }) => (chatId: string) => {
      const { firebaseDB } = this.context
      const { initialLoad } = this.state

      // we want to fetch first N messages at once
      if (initialLoad) {
        chatMessagefRef(firebaseDB, chatId)
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

            // TODO CHECK RN VERSION
            this.setState({
              messages: updatedMesseges,
              messagesCount: this.state.messagesCount + processedMessages.length,
              initialLoad: false,
            })

            chatMessagefRef(firebaseDB, chatId).off('value')
          })
      } else {
        chatMessagefRef(firebaseDB, chatId)
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
            })
          })
      }
    }

    createNewChat = ({
      newChatId,
      eventId,
      uid,
      recipientsIds,
    }) => (messages: Array<Message>) => {
      const { firebaseDB } = this.context

      const newChatMetaUpdate = {
        lastMessageText: R.last(messages).text,
        lastMessageCreatedAt: R.last(messages).createdAt,
        lastMessageAuthorId: uid,
        users: {},
        eventId,
      }
      const participants = R.concat([uid], recipientsIds)


      participants.forEach((id) => {
        newChatMetaUpdate.users[id] = true
      })

      toSendMessage(
        firebaseDB,
        newChatId,
        uid,
        messages,
        eventId,
        recipientsIds,
        newChatMetaUpdate,
        true
      )

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
      const { firebaseDB } = this.context

      toSendMessage(
        firebaseDB,
        chatId,
        uid,
        messages,
        eventId,
        recipientsIds,
        {
          lastMessageText: R.last(messages).text,
          lastMessageCreatedAt: R.last(messages).createdAt,
          lastMessageAuthorId: uid,
        }
      )
    }

    unsubscribeChatMessages = (chatId: string) => {
      const { firebaseDB } = this.context

      return chatMessagefRef(firebaseDB, chatId).off()
    }

    loadMoreMessages = ({
      chatId,
      participants,
      callBack,
      webMessageTransform,
    }) => {
      const { firebaseDB } = this.context
      const { messagesCount } = this.state
      const updatedMsgsCount = messagesCount + MESSAGE_PACKAGE_COUNT
      // draft
      // .startAt(this.state.last || 0)
      // .limitToFirst(5)
      // TODO fetch interval 5/+5/+5/...

      // chatMessagefRef(firebaseDBRef, chatId).keepSynced(true) // TODO maybe do it better way
      // fetch last 5/10/15/20/...

      chatMessagefRef(firebaseDB, chatId)
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

            this.setState({
              messages: webMessageTransform
                ? loadedMessages
                : R.reverse(loadedMessages),
              messagesCount: updatedMsgsCount,
            }, callBack || emptyFunc)
          }
        })
    }

    markMessagesRead = ({
      uid,
      prevMessages,
    }) => {
      const { firebaseDB } = this.context
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
    }) => {
      const { firebaseDB } = this.context

      return checkForChatExistence(
        firebaseDB,
        theUserId,
        uid,
        eventId
      )
    }

    render() {
      // const { ...rest } = this.props

      return (
        <ComposedComponent
          chatListner={this.chatListner}
          createNewChat={this.createNewChat}
          markMessagesRead={this.markMessagesRead}
          loadMoreMessages={this.loadMoreMessages}
          unsubscribeChatMessages={this.unsubscribeChatMessages}
          onSend={this.onSend}
          chatProps={this.state}
          resetChat={this.resetChat}
          loadMore={this.loadMoreMessages}
          checkForChat={this.checkForChat}
          {...this.props}
        />
      )
    }
  }

  return ChatProvider
}

export default ChatProviderWrapper
