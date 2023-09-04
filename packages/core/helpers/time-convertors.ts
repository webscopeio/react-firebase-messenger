import dayjs from 'dayjs'

/**
 * Convert a Date object to a Unix timestamp milliseconds
 */
export const toUnixTimestamp = (item: Date): string => dayjs(item).valueOf().toString()

/**
 * Convert a Unix timestamp milliseconds to a Date object
 */
export const unixToJSDate = (time: string): Date => dayjs(+time).toDate()
