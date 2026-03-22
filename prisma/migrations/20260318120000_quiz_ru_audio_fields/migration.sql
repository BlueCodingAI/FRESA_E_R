-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN     "questionAudioUrlRu" TEXT,
ADD COLUMN     "questionTimestampsUrlRu" TEXT,
ADD COLUMN     "optionAudioUrlsRu" JSONB,
ADD COLUMN     "optionTimestampsUrlsRu" JSONB,
ADD COLUMN     "correctExplanationAudioUrlRu" TEXT,
ADD COLUMN     "correctExplanationTimestampsUrlRu" TEXT,
ADD COLUMN     "incorrectExplanationAudioUrlsRu" JSONB,
ADD COLUMN     "incorrectExplanationTimestampsUrlsRu" JSONB;

-- AlterTable
ALTER TABLE "AdditionalQuestion" ADD COLUMN     "questionAudioUrlRu" TEXT,
ADD COLUMN     "questionTimestampsUrlRu" TEXT,
ADD COLUMN     "optionAudioUrlsRu" JSONB,
ADD COLUMN     "optionTimestampsUrlsRu" JSONB,
ADD COLUMN     "correctExplanationAudioUrlRu" TEXT,
ADD COLUMN     "correctExplanationTimestampsUrlRu" TEXT,
ADD COLUMN     "incorrectExplanationAudioUrlsRu" JSONB,
ADD COLUMN     "incorrectExplanationTimestampsUrlsRu" JSONB;
