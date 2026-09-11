import { SignalCategory } from "@prisma/client";

import { signalCategoryValues } from "@/lib/ai/schemas";
import { parseDelimitedList, serializeDelimitedList } from "@/lib/utils/strings";

export type SignalCategoryValue = (typeof signalCategoryValues)[number];

const signalCategoryMap: Record<SignalCategoryValue, SignalCategory> = {
  initiative: SignalCategory.INITIATIVE,
  follow_through: SignalCategory.FOLLOW_THROUGH,
  leadership: SignalCategory.LEADERSHIP,
  adaptability: SignalCategory.ADAPTABILITY,
  communication: SignalCategory.COMMUNICATION,
  analytical_thinking: SignalCategory.ANALYTICAL_THINKING,
  collaboration: SignalCategory.COLLABORATION,
  resilience: SignalCategory.RESILIENCE,
  mission_alignment: SignalCategory.MISSION_ALIGNMENT,
};

const inverseSignalCategoryMap = Object.entries(signalCategoryMap).reduce(
  (accumulator, [key, value]) => {
    accumulator[value] = key as SignalCategoryValue;
    return accumulator;
  },
  {} as Record<SignalCategory, SignalCategoryValue>,
);

export function toPrismaSignalCategory(value: SignalCategoryValue) {
  return signalCategoryMap[value];
}

export function fromPrismaSignalCategory(value: SignalCategory) {
  return inverseSignalCategoryMap[value];
}

export function parseTags(value: string) {
  return parseDelimitedList(value);
}

export function serializeTags(tags: string[]) {
  return serializeDelimitedList(tags);
}
