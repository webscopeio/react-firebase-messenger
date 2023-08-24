import dayjs from "dayjs";

export const toUnixTimestamp = (item: Date): string => dayjs(item).unix().toString();

export const unixToJSDate = (time: string): Date => dayjs.unix(+time).toDate();
