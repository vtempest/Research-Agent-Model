# extract-youtube API Reference

## `YouTubeTranscriptApi`

```ts
new YouTubeTranscriptApi(options?: { proxyConfig?: ProxyConfig; httpClient?: HttpClient })

fetchTranscript(videoId, { languages = ["en"], preserveFormatting = false }): Promise<FetchedTranscript>
listTranscripts(videoId): Promise<TranscriptList>
fetch(videoId, options)   // @deprecated alias of fetchTranscript
list(videoId)             // @deprecated alias of listTranscripts
```

Holds an HTTP client — not thread-safe; one instance per worker/thread.

## `TranscriptList`

Iterable. `findTranscript(codes)` (manual tracks preferred, then auto-generated),
`findManuallyCreatedTranscript(codes)`, `findGeneratedTranscript(codes)`. Each returns
a `Transcript`, or throws `NoTranscriptFound`.

## `Transcript`

`fetch(preserveFormatting?)` → `FetchedTranscript`; `translate(languageCode)` →
`Transcript`; plus track metadata (language, code, generated flag,
`translationLanguages`).

## `FetchedTranscript`

`snippets: FetchedTranscriptSnippet[]` — each `{ text, start, duration }`.

## Transcript utilities

| Export | Returns |
| --- | --- |
| `extractVideoId(url)` | The 11-character id from any YouTube URL form |
| `encodeTranscriptSpeeds(transcript, addPlayer = false)` | `{ html, word_count, speeds }` — `speeds` is run-length encoded (`"3x12,4x8"`) |
| `getTimestampAtChar(transcript, charIndex)` | Seconds at that character offset |
| `decompressTimestampsArray(speeds)` | `number[]` from the run-length string |

## Formatters

`Formatter` (abstract) · `JSONFormatter` · `TextFormatter` · `PrettyPrintFormatter` ·
`ArticleFormatter` · `SRTFormatter` · `WebVTTFormatter` · `FormatterLoader` (by name) ·
`UnknownFormatterType`.

## Proxies

| Class | Constructor |
| --- | --- |
| `GenericProxyConfig` | `{ httpUrl, httpsUrl }` |
| `WebshareProxyConfig` | `{ proxyUsername, proxyPassword, filterIpLocations? }` |
| `ProxyConfig` | Base class |
| `InvalidProxyConfig` | Thrown on a malformed config |

## Errors

Base: `YouTubeTranscriptApiException`.

| Error | Meaning |
| --- | --- |
| `CouldNotRetrieveTranscript` | Base for retrieval failures |
| `InvalidVideoId` | Not a valid video id (often a URL was passed) |
| `TranscriptsDisabled` | Captions disabled by the uploader |
| `NoTranscriptFound` | No track matched the requested languages |
| `NotTranslatable` / `TranslationLanguageNotAvailable` | Translation unsupported / target unavailable |
| `RequestBlocked` / `IpBlocked` | YouTube blocked the request or the IP |
| `AgeRestricted` / `VideoUnplayable` / `VideoUnavailable` | Playability gates |
| `PoTokenRequired` | Proof-of-origin token demanded |
| `YouTubeRequestFailed` / `YouTubeDataUnparsable` | HTTP failure / player JSON changed shape |
| `CookieError`, `CookiePathInvalid`, `CookieInvalid`, `FailedToCreateConsentCookie` | Consent-cookie flow |

Enums: `PlayabilityStatus`, `PlayabilityFailedReason`.

## Types

`FetchedTranscriptSnippet`, `TranslationLanguage`, `RequestsProxyConfigDict`,
`CaptionTrack`, `CaptionsJson`, `InnerTubeData`, `HttpClient`.

## React (`extract-youtube/react`)

`YouTubeTranscriptModal`, `YouTubeTranscriptModalProps`, `TranscriptSnippet`.
Peers: `react`, `react-dom`, `lucide-react`.

## CLI (`extract-youtube <video-id>`)

| Flag | Meaning |
| --- | --- |
| `-l, --languages <codes>` | Comma-separated, e.g. `en,de,fr` |
| `-f, --format <type>` | `json` (default), `text`, `srt`, `webvtt`, `pretty`, `speeds` |
| `-p, --preserve-formatting` | Keep line breaks and inline markup |
| `--proxy <url>` | HTTP/HTTPS proxy |
| `--webshare-user` / `--webshare-pass` | Webshare credentials |
| `-h, --help` / `-v, --version` | |

## Build

`bun run build` = `clean` + `build:lib` + `build:cli` + `build:react` + `build:types`.
Tests run under **jest** (`bun run test`), not vitest.
