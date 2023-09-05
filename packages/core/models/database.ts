/**
 * Wrapper for simple collection defining
 * @example CollectionObject<ChatUser> -> { "superId1": ChatUser, "superId2": ChatUser }
 */
export type CollectionObject<T> = { [id: string]: T }

export type UserChatsEntity = {
  chatId: string
  eventId: string
  lastMessageAuthorId: string
  lastMessageCreatedAt: string
  lastMessageText: string
  navigation: Object // TODO flow type for nav
  participants: Array<Object>
  unseenMessages: number
  userId: string
}

export type Message = {
  createdAt: Date
  text: string
  user: {
    _id: string
    name: string
    photoUrl?: string
  }
  _id: string
}

export type ChatMetadata = {
  eventId: string
  isCustom: boolean
  lastMessageAuthorId: string
  lastMessageCreatedAt: Date
  lastMessageText: string
  shiftId: string
  // [ { 'dsfsdf2r32db2i3udb2': true } ]
  users: CollectionObject<true>
  type?: string
  chatId?: string
  jobId?: string
}

export type ChatMessage = {
  createdAt: string
  text: string
  userId: string
}

type ChatUserStaffer = {
  photoUrl: string
  nameFirst: string
  nameLast: string
  businessName?: never
}

type ChatUserBusiness = {
  photoUrl: string
  businessName: string
  nameFirst?: never
  nameLast?: never
}

export type ChatUser = ChatUserStaffer | ChatUserBusiness

export type ChatParticipant = {
  photoUrl: string
  uid: string
  _id: string
  name?: string
  nameFirst?: string
  nameLast?: string
  businessName?: string
}

export type UnreadMessage = {
  chatId: string
  eventId: string
}

export type UserChats = {
  lastMessageCreatedAt: string
}
