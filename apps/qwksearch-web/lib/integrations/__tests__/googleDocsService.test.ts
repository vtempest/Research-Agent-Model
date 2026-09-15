import { describe, expect, it, vi } from 'vitest';

// The service module reaches for the database at import time; the OAuth URL
// builder under test is static and touches none of it.
vi.mock('@/lib/database/turso', () => ({ tursoQueries: {} }));

import { GoogleDocsService } from '../googleDocsService';

const authUrl = () =>
  new URL(
    GoogleDocsService.getAuthUrl({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://qwksearch.com/api/doc/google-docs/callback',
    }),
  );

describe('GoogleDocsService.getAuthUrl', () => {
  it('requests only per-file Drive access', () => {
    // `drive.file` covers everything the connector does — read the files the
    // user picks, write the docs it creates — without the consent screen
    // asking for the user's entire Drive.
    expect(authUrl().searchParams.get('scope')).toBe(
      'https://www.googleapis.com/auth/drive.file',
    );
  });

  it('never asks for the restricted whole-Drive scopes', () => {
    const scope = authUrl().searchParams.get('scope') ?? '';

    expect(scope).not.toContain('auth/drive.readonly');
    expect(scope).not.toContain('auth/documents');
  });

  it('adds the grant to the scopes the account already approved', () => {
    // Without incremental authorization, connecting Drive would replace the
    // identity grant made at sign-in rather than extend it.
    const params = authUrl().searchParams;

    expect(params.get('include_granted_scopes')).toBe('true');
    expect(params.get('access_type')).toBe('offline');
  });

  it('sends the caller-supplied client and redirect', () => {
    const params = authUrl().searchParams;

    expect(params.get('client_id')).toBe('client-id');
    expect(params.get('redirect_uri')).toBe(
      'https://qwksearch.com/api/doc/google-docs/callback',
    );
    expect(params.get('response_type')).toBe('code');
  });
});
