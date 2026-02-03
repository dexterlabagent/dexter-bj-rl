'use client';

import type { ReactNode } from 'react';
import { Drawer } from 'vaul';

type VaulDrawerProps = {
  children: ReactNode;
  renderContent: () => ReactNode;
};

export function VaulDrawer({ children, renderContent }: VaulDrawerProps) {
  return (
    <Drawer.Root direction="right">
      <Drawer.Trigger asChild>{children}</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-secondary/90" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 top-0 md:bottom-2 md:left-auto md:right-2 md:top-2 overflow-hidden rounded-none md:rounded-lg bg-secondary z-10 flex w-full md:w-[500px] lg:w-[610px] outline-none"
        >
          <div className="flex h-full w-full grow flex-col border border-border overflow-y-auto rounded-[16px] bg-secondary p-6">
            {renderContent()}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
