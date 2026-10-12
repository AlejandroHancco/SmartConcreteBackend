-- CreateTable
CREATE TABLE "activity_events" (
    "id" SERIAL NOT NULL,
    "teamId" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_event_recipients" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_event_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_activity_events_team_created" ON "activity_events"("teamId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "activity_event_recipients_eventId_userId_key" ON "activity_event_recipients"("eventId", "userId");

-- CreateIndex
CREATE INDEX "idx_activity_recipients_user_read" ON "activity_event_recipients"("userId", "read", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "activity_event_recipients" ADD CONSTRAINT "activity_event_recipients_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "activity_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "activity_event_recipients" ADD CONSTRAINT "activity_event_recipients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION;
