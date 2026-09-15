import { redirect } from 'next/navigation';

/**
 * `/workspace/demo` — no document specified. The playground toolbar is the
 * default Reason Editor surface (see the module comment in
 * `react-reason-editor/docs-agent`), so this bounces to a scratch document on
 * it. The two toolbar-schema versions stay reachable at
 * `/workspace/demo/plate/:id` and `/workspace/demo/tiptap/:id`, one click away
 * via the surface switcher in `DemoShell`.
 */
export default function DemoIndexPage() {
  redirect('/workspace/demo/playground/default');
}
