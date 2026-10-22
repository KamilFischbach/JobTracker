import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  count: number;
  isOpen: boolean;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmationDialog({
  count,
  isOpen,
  isPending,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && !isPending && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Delete {count} {count === 1 ? 'application' : 'applications'}?
          </DialogTitle>
          <DialogDescription>
            This permanently removes the selected application
            {count === 1 ? '' : 's'}. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type='button'
            variant='destructive'
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? 'Deleting...' : 'Delete permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
