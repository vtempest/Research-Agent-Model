/**
 * QwkSearch demo: search the web, then extract the top result's content.
 *
 * This is an executable example against the live QwkSearch API, not a unit
 * test, so it lives in examples/ rather than under a test glob.
 *
 * Run with: tsx examples/qwksearch-demo.ts
 */

import * as qwk from '../src/qwksearch/api-client';
import type * as Types from '../src/qwksearch/index';

var searchResults = await qwk.searchWeb({
    query: {
        q: 'Bitcoin',
        cat: 'news'
    }
})

import { grab, log } from 'grab-url'
log(searchResults.data?.results?.[0].url)

if (!searchResults.data?.results?.[0].url)
    throw new Error('No URL found');

var topResult = await qwk.extractContent({
    query: {
        url: searchResults.data?.results?.[0].url || ''
    }
})

log(topResult.data);
