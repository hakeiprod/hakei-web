-- AddForeignKey
ALTER TABLE "ImportMetadata" ADD CONSTRAINT "ImportMetadata_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ScoreRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionIssue" ADD CONSTRAINT "ConversionIssue_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ScoreRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionValidation" ADD CONSTRAINT "RevisionValidation_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ScoreRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
