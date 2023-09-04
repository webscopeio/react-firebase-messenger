import { ChatMetadata, Message } from './database'

export type OnSendMessage = {
  chatId: string
  userId: string
  messages: Array<Message>
  eventId: string
  recipientsIds: Array<string>
  meta: Pick<ChatMetadata, 'lastMessageAuthorId' | 'lastMessageCreatedAt' | 'lastMessageText'>
  createNewChat?: boolean
}

export type CreateEmptyChat = {
  chatId: string
  userId: string
  eventId: string
  recipientsIds: Array<string>
  meta: ChatMetadata
}
