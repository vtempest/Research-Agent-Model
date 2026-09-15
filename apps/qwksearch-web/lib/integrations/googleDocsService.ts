import { tursoQueries } from '@/lib/database/turso';

export interface GoogleDocsConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface ParagraphElement {
  textRun?: { content?: string };
}
interface Paragraph {
  elements?: ParagraphElement[];
}
interface BodyContent {
  paragraph?: Paragraph;
}

type DocsRequest = Record<string, unknown>;

async function gfetch<T = any>(
  url: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    const err: any = new Error(text || `Request failed: ${res.status}`);
    err.code = res.status;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export class GoogleDocsService {
  private accessToken: string;
  private refreshToken?: string;
  private config: GoogleDocsConfig;

  constructor(config: GoogleDocsConfig, accessToken?: string, refreshToken?: string) {
    this.config = config;
    this.accessToken = accessToken || '';
    this.refreshToken = refreshToken;
  }

  /**
   * Scopes requested when a user connects Google Drive.
   *
   * `drive.file` is the per-file scope: it grants access only to files the
   * user explicitly hands over through the Google Picker plus files this app
   * creates itself, which is the whole of what the connector does (download
   * picked files, create/update docs it exported). It replaces the pair this
   * used to request — `drive.readonly` and `documents` — which Google renders
   * on the consent screen as "See and download all your Google Drive files"
   * and "See, edit, create and delete all your Google Docs documents". Those
   * are restricted scopes: they cover the user's entire Drive, they drag the
   * OAuth client through Google's restricted-scope verification, and because
   * this app uses one OAuth client for both sign-in and Drive they made the
   * account's first Google consent look like a demand for the whole Drive.
   */
  static readonly AUTH_SCOPES: readonly string[] = [
    'https://www.googleapis.com/auth/drive.file',
  ];

  static getAuthUrl(config: GoogleDocsConfig): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      // Layer this grant on top of whatever the account already approved (the
      // identity scopes from sign-in) instead of replacing it, so connecting
      // Drive never silently drops the sign-in grant.
      include_granted_scopes: 'true',
      scope: GoogleDocsService.AUTH_SCOPES.join(' '),
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  static async getTokensFromCode(
    config: GoogleDocsConfig,
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!res.ok) throw new Error(await res.text());
    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
    };
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token!,
    };
  }

  private markdownToGoogleDocs(markdown: string): DocsRequest[] {
    const requests: DocsRequest[] = [];
    const lines = markdown.split('\n');
    let currentIndex = 1;

    lines.forEach((line) => {
      if (!line.trim()) {
        requests.push({ insertText: { text: '\n', location: { index: currentIndex } } });
        currentIndex += 1;
        return;
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2] + '\n';
        requests.push({ insertText: { text, location: { index: currentIndex } } });
        requests.push({
          updateParagraphStyle: {
            range: { startIndex: currentIndex, endIndex: currentIndex + text.length - 1 },
            paragraphStyle: { namedStyleType: `HEADING_${level}` },
            fields: 'namedStyleType',
          },
        });
        currentIndex += text.length;
        return;
      }

      const boldRegex = /\*\*(.+?)\*\*/g;
      const boldMatches = [...line.matchAll(boldRegex)];
      if (boldMatches.length > 0) {
        const processedLine = line.replace(boldRegex, '$1');
        requests.push({
          insertText: { text: processedLine + '\n', location: { index: currentIndex } },
        });
        boldMatches.forEach((match) => {
          const startOffset = line.indexOf(match[0]);
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: currentIndex + startOffset,
                endIndex: currentIndex + startOffset + match[1].length,
              },
              textStyle: { bold: true },
              fields: 'bold',
            },
          });
        });
        currentIndex += processedLine.length + 1;
        return;
      }

      requests.push({ insertText: { text: line + '\n', location: { index: currentIndex } } });
      currentIndex += line.length + 1;
    });

    return requests;
  }

  async exportToGoogleDocs(
    title: string,
    content: string,
    _documentId: string,
    _userId?: string,
  ): Promise<{ googleDocId: string; url: string }> {
    try {
      const created = await gfetch<{ documentId: string }>(
        'https://docs.googleapis.com/v1/documents',
        this.accessToken,
        { method: 'POST', body: JSON.stringify({ title }) },
      );
      const googleDocId = created.documentId;

      const requests = this.markdownToGoogleDocs(content);
      if (requests.length > 0) {
        await gfetch(
          `https://docs.googleapis.com/v1/documents/${googleDocId}:batchUpdate`,
          this.accessToken,
          { method: 'POST', body: JSON.stringify({ requests }) },
        );
      }

      return {
        googleDocId,
        url: `https://docs.google.com/document/d/${googleDocId}/edit`,
      };
    } catch (error: any) {
      throw new Error(`Failed to export to Google Docs: ${error.message}`);
    }
  }

  async importFromGoogleDocs(googleDocId: string): Promise<{ title: string; content: string }> {
    try {
      const doc = await gfetch<{ title?: string; body?: { content?: BodyContent[] } }>(
        `https://docs.googleapis.com/v1/documents/${googleDocId}`,
        this.accessToken,
      );

      const title = doc.title || 'Untitled';
      let content = '';
      doc.body?.content?.forEach((element) => {
        element.paragraph?.elements?.forEach((elem) => {
          if (elem.textRun?.content) content += elem.textRun.content;
        });
      });

      return { title, content: content.trim() };
    } catch (error: any) {
      throw new Error(`Failed to import from Google Docs: ${error.message}`);
    }
  }

  async shareGoogleDoc(
    googleDocId: string,
    emailAddress: string,
    role: 'reader' | 'writer' | 'commenter' = 'reader',
  ): Promise<void> {
    try {
      await gfetch(
        `https://www.googleapis.com/drive/v3/files/${googleDocId}/permissions?sendNotificationEmail=true`,
        this.accessToken,
        {
          method: 'POST',
          body: JSON.stringify({ type: 'user', role, emailAddress }),
        },
      );
    } catch (error: any) {
      throw new Error(`Failed to share Google Doc: ${error.message}`);
    }
  }

  async getShareableLink(googleDocId: string): Promise<string> {
    try {
      await gfetch(
        `https://www.googleapis.com/drive/v3/files/${googleDocId}/permissions`,
        this.accessToken,
        {
          method: 'POST',
          body: JSON.stringify({ type: 'anyone', role: 'reader' }),
        },
      );

      const file = await gfetch<{ webViewLink?: string }>(
        `https://www.googleapis.com/drive/v3/files/${googleDocId}?fields=webViewLink`,
        this.accessToken,
      );

      return file.webViewLink || `https://docs.google.com/document/d/${googleDocId}/edit`;
    } catch (error: any) {
      throw new Error(`Failed to get shareable link: ${error.message}`);
    }
  }

  static async getSyncStatus(documentId: string): Promise<{
    isSynced: boolean;
    googleDocId?: string;
    lastSyncedAt?: string;
  }> {
    const sync = await tursoQueries.getGoogleDocSync(documentId);
    if (!sync) return { isSynced: false };
    return {
      isSynced: true,
      googleDocId: sync.googleDocId,
      lastSyncedAt: sync.lastSyncedAt,
    };
  }

  static async removeSyncStatus(documentId: string): Promise<void> {
    await tursoQueries.deleteGoogleDocSync(documentId);
  }
}
