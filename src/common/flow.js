// @flow

export type UserChatsEntity = {|
  chatId: string,
  eventId: string,
  lastMessageAuthorId: string,
  lastMessageCreatedAt: string,
  lastMessageText: string,
  navigation: Object, // TODO flow type for nav
  participants: Array<Object>,
  unseenMessages: number,
  userId: string,
|}

export type Message = {|
  createdAt: Date,
  text: string,
  user: {|
    name: string,
    _id: string,
  |},
  _id: string,
|}
