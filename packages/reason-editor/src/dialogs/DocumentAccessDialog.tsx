/**
 * @module DocumentAccessDialog
 * @description Shown when a document ID restored from a URL (e.g. a shared
 * `?docs=` link) can't be opened by the current user. Offers a one-shot
 * "Request access" action that notifies the document's owner; once sent,
 * the button is permanently disabled for this user+document pair to avoid
 * spamming the owner with repeat requests.
 */
import { Lock, Mail, Check, HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../app-ui/dialog';
import { Button } from '../app-ui/button';
import type { DocumentAccessState } from '../app-hooks/useDocumentAccessRequest';

interface DocumentAccessDialogProps {
  state: DocumentAccessState;
  onRequestAccess: () => void;
  onOpenChange: (open: boolean) => void;
  onSignIn?: () => void;
}

export const DocumentAccessDialog = ({
  state,
  onRequestAccess,
  onOpenChange,
  onSignIn,
}: DocumentAccessDialogProps) => {
  const open = state.status === 'denied' || state.status === 'not-found' || state.status === 'sign-in-required';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {state.status === 'denied' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <DialogTitle>You don&apos;t have access to this document</DialogTitle>
              </div>
              <DialogDescription>
                Ask the owner for access — they&apos;ll get a one-time email letting them know you&apos;d like to view it.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={onRequestAccess}
                disabled={state.accessRequested || state.requesting}
              >
                {state.accessRequested ? (
                  <>
                    <Check className="h-4 w-4" />
                    Request sent
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    {state.requesting ? 'Sending…' : 'Request access'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {state.status === 'sign-in-required' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <DialogTitle>Sign in to open this document</DialogTitle>
              </div>
              <DialogDescription>
                This document belongs to someone else. Sign in so we know who to request access for.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {onSignIn && <Button onClick={onSignIn}>Sign in</Button>}
            </DialogFooter>
          </>
        )}

        {state.status === 'not-found' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
                <DialogTitle>Document not found</DialogTitle>
              </div>
              <DialogDescription>
                This link doesn&apos;t point to a document that exists anymore.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
