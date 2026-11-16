-- Index for the Sermon.seriesId foreign key (ON DELETE SET NULL).
--
-- Workstream E (database integrity) audit: every tenant-scoped query already
-- had a leading churchId index, but deleting a sermon series triggered a
-- cross-tenant table scan on `sermons` to detach its sermons. This index
-- keeps that operation indexed. (The remaining un-indexed FKs —
-- website_pages.createdById/updatedById, media.uploadedById — only fire on
-- rare platform-admin account deletion and were deliberately left alone.)
CREATE INDEX "sermons_seriesId_idx" ON "sermons"("seriesId");
