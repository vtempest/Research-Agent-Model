CREATE TABLE `document_access_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documentId` integer NOT NULL,
	`requesterUserId` text NOT NULL,
	`ownerUserId` text NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requesterUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_document_access_requests_doc_requester` ON `document_access_requests` (`documentId`,`requesterUserId`);
--> statement-breakpoint
CREATE INDEX `idx_document_access_requests_documentId` ON `document_access_requests` (`documentId`);
--> statement-breakpoint
CREATE INDEX `idx_document_access_requests_requesterUserId` ON `document_access_requests` (`requesterUserId`);
