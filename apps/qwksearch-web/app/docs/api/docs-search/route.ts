/**
 * @fileoverview Static search index for the /docs help site. Exported once at
 * build time and queried client-side, so search costs no request-time work.
 */
import { searchServer } from 'user-help-docs/search';

export const revalidate = false;

export const { staticGET: GET } = searchServer;
