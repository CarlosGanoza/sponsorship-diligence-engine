import type { ReviewerCalibrationItemMutationInput } from "@/lib/calibration/workspace";
import { serializeUpdatedReviewerCalibrationWorkspace } from "@/lib/calibration/workspace";
import { prisma } from "@/lib/db/prisma";

export async function persistReviewerCalibrationItemState(input: {
  reviewerId: string;
  update: ReviewerCalibrationItemMutationInput;
}) {
  const currentValue = (
    await prisma.appSetting.findUnique({
      where: { key: "REVIEWER_CALIBRATION_WORKSPACE" },
      select: { value: true },
    })
  )?.value;

  const nextValue = serializeUpdatedReviewerCalibrationWorkspace({
    currentValue,
    reviewerId: input.reviewerId,
    update: input.update,
  });

  await prisma.appSetting.upsert({
    where: { key: "REVIEWER_CALIBRATION_WORKSPACE" },
    update: { value: nextValue },
    create: { key: "REVIEWER_CALIBRATION_WORKSPACE", value: nextValue },
  });
}
