'use client';

import { useState } from 'react';

import { FlagIcon } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import type { VariantProps } from 'class-variance-authority';
import { ReportDialog } from '@/components/report-dialog';

// A self-contained "Report" button + dialog for reporting a user, for use on
// surfaces (like the server-rendered profile header) that just need a drop-in
// control. Renders nothing destructive until the dialog is submitted. `variant`
// and `size` pass straight through to the Button so each surface can match its
// surrounding controls (a compact `icon`/`xs` in a preview, a full-width outline
// on the profile header, …).
export function ReportUserButton({
  reportedUserId,
  name,
  className,
  variant = 'outline',
  size,
}: {
  reportedUserId: string;
  name?: string | null;
  className?: string;
  variant?: VariantProps<typeof buttonVariants>['variant'];
  size?: VariantProps<typeof buttonVariants>['size'];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <FlagIcon className='shrink-0' aria-hidden />
        Report
      </Button>
      <ReportDialog
        open={open}
        onOpenChange={setOpen}
        target={{ reportedUserId, name }}
      />
    </>
  );
}
