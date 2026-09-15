import type { ReactNode } from 'react';

import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { source } from 'user-help-docs';
import { docsConfig } from 'user-help-docs/config';
import { docsLayoutOptions } from 'user-help-docs/layout.config';

export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      search={{
        options: {
          // The index is built at compile time by `app/docs/api/docs-search`,
          // so search runs entirely in the browser against a static JSON file.
          type: 'static',
          api: docsConfig.searchApi,
        },
      }}
    >
      <DocsLayout tree={source.pageTree} {...docsLayoutOptions}>
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
