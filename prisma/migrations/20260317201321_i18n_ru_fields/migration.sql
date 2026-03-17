-- AlterTable
ALTER TABLE "AdditionalQuestion" ADD COLUMN     "explanationRu" JSONB,
ADD COLUMN     "optionsRu" TEXT[],
ADD COLUMN     "questionRu" TEXT;

-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN     "descriptionRu" TEXT,
ADD COLUMN     "titleRu" TEXT;

-- AlterTable
ALTER TABLE "CmsPage" ADD COLUMN     "contentRu" TEXT,
ADD COLUMN     "titleRu" TEXT;

-- AlterTable
ALTER TABLE "EmailTemplate" ADD COLUMN     "bodyRu" TEXT,
ADD COLUMN     "htmlBodyRu" TEXT,
ADD COLUMN     "subjectRu" TEXT;

-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN     "explanationRu" JSONB,
ADD COLUMN     "optionsRu" TEXT[],
ADD COLUMN     "questionRu" TEXT;

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "textRu" TEXT,
ADD COLUMN     "titleRu" TEXT;
