import moment from "moment";

export const toUnixTimestamp = (item: Date): string => moment(item).format("x");

export const unixToJSDate = (time: string): Date => moment(time, "x").toDate();
