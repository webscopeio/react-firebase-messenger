import dayjs from "dayjs";

export const toUnixTimestamp = (item: Date): string => dayjs(item).format("x");

export const unixToJSDate = (time: string): Date => dayjs(time, "x").toDate();
