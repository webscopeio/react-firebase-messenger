import moment from 'moment'

export const toUnixTimestamp = item => moment(item).format('x')

export const unixToJSDate = time => moment(time, 'x').toDate()
