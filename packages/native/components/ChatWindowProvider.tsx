import React from 'react'
import { append, prepend, last, concat, values, reverse, difference, assoc, keys } from 'rambda'
import { chatMessagesRef, usersRef } from '../helpers/references'
import { checkForChatExistence, toSendMessage, getGroupChatsByEvent } from '../helpers/calls'
import { FirebaseDatabaseTypes } from '@react-native-firebase/database'
import {
  getMessagesIds,
  listnerSingleMessageTransform,
  loadMoreMessagesListTransform,
  type ChatMetadata,
  type ChatUser,
  type CollectionObject,
  type Message,
} from '@webscopeio/react-firebase-messenger'

type Props = {
  firebaseDBRef: FirebaseDatabaseTypes.Reference
  component: Object
}

type State = {
  initialLoad: boolean
  isLoadingEarlier: boolean
  hasMoreToLoad: boolean
  messages: Array<Message>
  messagesCount: number
  tempChatIdStore: string
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

const ChatProviderWrapper = (
  firebaseDB: FirebaseDatabaseTypes.Reference,
  ComposedComponent: React.ComponentType<any>,
  packageCount: number = MESSAGE_PACKAGE_COUNT,
) => {
  class ChatProvider extends React.Component<Props, State> {
    state = chatDefaultState
    resetChat = (callback: VoidFunction) => this.setState(chatDefaultState, callback || emptyFunc)

    chatListner =
      ({
        participants,
        webMessageTransform,
      }: {
        participants: CollectionObject<ChatUser>
        webMessageTransform: boolean
      }) =>
      (chatId: string, newChat?: boolean) => {
        const { initialLoad } = this.state

        // we want to fetch first N messages at once
        if (!newChat && initialLoad) {
          chatMessagesRef(firebaseDB, chatId)
            .orderByChild('createdAt')
            .limitToLast(packageCount)
            .once('value', (messagesSnap) => {
              /*
               * Here we fetch first batch of the messages at once and process them for the chat
               * component. After that we push them to state, mark initial load as done and unsubsribe
               * from value listener as we will listen only to child_added events after that. In order
               * to display lates send message.
               */
              const processedMessages: Array<Message> = []

              messagesSnap.forEach((messageSnippet) => {
                const message = listnerSingleMessageTransform(messageSnippet.key, participants)(messageSnippet.val())

                processedMessages.push(message)
                return true
              })

              this.setState({
                messages: webMessageTransform ? processedMessages : processedMessages.reverse(),
                messagesCount: processedMessages.length - this.state.messagesCount,
                initialLoad: false,
              })
            })
        } else {
          chatMessagesRef(firebaseDB, chatId)
            .orderByChild('createdAt')
            .limitToLast(packageCount)
            .on('child_added', (messageSnippet) => {
              const message = listnerSingleMessageTransform(messageSnippet.key, participants)(messageSnippet.val())

              // We have to check for duplicates since we get already fetched node as well after
              // initial load
              /* eslint-disable no-underscore-dangle */
              if (this.state.messages.some((m: Message) => m._id === message._id)) {
                return
              }

              const updatedMesseges = webMessageTransform
                ? append(message, this.state.messages)
                : prepend(message, this.state.messages)

              this.setState({
                messages: updatedMesseges,
                messagesCount: this.state.messagesCount + 1,
                initialLoad: false,
              })
            })
        }
      }

    createNewChat =
      ({
        newChatId,
        eventId,
        uid,
        recipientsIds,
      }: {
        newChatId: string
        eventId: string
        uid: string
        recipientsIds: Array<string>
      }) =>
      (messages: Array<Message>) => {
        const newChatMetaUpdate: Omit<ChatMetadata, 'isCustom' | 'shiftId'> = {
          lastMessageText: last(messages)?.text || '',
          lastMessageCreatedAt: last(messages)?.createdAt || new Date(),
          lastMessageAuthorId: uid,
          users: {},
          eventId,
          // now all of them are private by default
          type: 'private',
        }
        const participants = concat([uid], recipientsIds)

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
          // NOT EVEN USED IN `toSendMessage`
          // now all of them are private by default
          // createPrivateChat: true,
        })

        this.setState({
          tempChatIdStore: newChatId,
        })
      }

    onSend = ({
      chatId,
      uid,
      eventId,
      recipientsIds,
      messages,
    }: {
      chatId: string
      uid: string
      eventId: string
      recipientsIds: Array<string>
      messages: Array<Message>
    }) => {
      toSendMessage({
        firebaseDB,
        chatId,
        userId: uid,
        messages,
        eventId,
        recipientsIds,
        meta: {
          lastMessageText: last(messages)?.text ?? '',
          lastMessageCreatedAt: last(messages)?.createdAt || new Date(),
          lastMessageAuthorId: uid,
        },
      })
    }

    unsubscribeChatMessages = (chatId: string) => chatMessagesRef(firebaseDB, chatId).off()

    loadMoreMessages = ({
      chatId,
      participants,
      callBack,
      webMessageTransform,
    }: {
      chatId: string
      participants: CollectionObject<ChatUser>
      callBack: VoidFunction
      // TODO not sure what type is this, as it is not call anywhere to be function. It's used in condition.
      webMessageTransform: Function
    }) => {
      const { messagesCount } = this.state
      const updatedMsgsCount = messagesCount + packageCount
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
          .once(
            'value', // TODO via on and unsubscription
            (chatMsgs) => {
              const messagesFromDB = chatMsgs.val() as CollectionObject<any>
              if (values(messagesFromDB).length > this.state.messages.length) {
                // add to message's id to other message's object
                chatMsgs.forEach((item) => {
                  /* eslint-disable no-underscore-dangle */
                  if (item.key) {
                    messagesFromDB[item.key]._id = item.key
                  }
                  return true
                })

                const loadedMessages = loadMoreMessagesListTransform(participants)(messagesFromDB)
                const hasMoreToLoad = loadedMessages.length === updatedMsgsCount

                this.setState(
                  {
                    hasMoreToLoad,
                    isLoadingEarlier: false,
                    messages: webMessageTransform ? loadedMessages : reverse(loadedMessages),
                    messagesCount: updatedMsgsCount,
                  },
                  callBack || emptyFunc,
                )
              }
            },
          )
      })
    }

    markMessagesRead = ({ uid, prevMessages }: { uid: string; prevMessages: Message[] }) => {
      const { messages } = this.state
      const messagesIds = getMessagesIds(messages)
      const prevMessagesIds = getMessagesIds(prevMessages)

      const diff = difference(messagesIds, prevMessagesIds)

      if (diff.length) {
        const unreadMessagesToDeleteUpdate = diff.reduce((result, messageId) => {
          const newResult = assoc(`unread-messages/${uid}/${messageId}`, null, result || {})
          return newResult
        }, {})

        firebaseDB.update(unreadMessagesToDeleteUpdate)
      }
    }

    checkForChat = ({ theUserId, uid, eventId }: { theUserId: string; uid: string; eventId: string }) =>
      checkForChatExistence(firebaseDB, theUserId, uid, eventId)

    getChatParticipantsDetails = async (participants: CollectionObject<true>) => {
      const allChatsParticipants: CollectionObject<object> = {}
      await Promise.all(
        keys(participants).map(
          // participantId is definitely string
          (participantId) =>
            new Promise((resolve) =>
              usersRef(firebaseDB, participantId as string).once('value', (userSnapshot) => {
                const userInfo = userSnapshot.val()
                const userData = { ...userInfo, uid: participantId }

                allChatsParticipants[participantId] = userData
                // resolve participantId just to fulfill the promise
                resolve(participantId)
              }),
            ),
        ),
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
          chatProps={{ ...this.state, packageCount }}
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
