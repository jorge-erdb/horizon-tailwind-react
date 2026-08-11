import { useState } from "react";
import { MdContentCopy, MdCheck, MdWarningAmber, MdKey } from "react-icons/md";
import Card from "components/card";
import InputField from "components/fields/InputField";
import { QueryError } from "components/common/QueryState";
import {
  useCreateDataSource,
  useDataSources,
  useIssueWriteKey,
} from "lib/queries/dataSources";

/**
 * Create a data source and reveal its write key exactly once.
 *
 * The key is returned by issue_write_key() and never stored in plaintext, so
 * this component holding it in state is the only place it exists after the
 * response. Navigating away loses it and the user has to rotate — which is
 * the correct trade and is why the warning below is prominent rather than
 * fine print.
 */

// data_sources.kind is constrained to these eight by the schema; keep in sync
// with 0003_domain.sql.
const KINDS = [
  "web",
  "mobile",
  "api",
  "billing",
  "email",
  "warehouse",
  "ads",
  "support",
];

const CopyButton = ({ value, label = "Copy" }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is denied outside a secure context, and over plain
      // HTTP navigator.clipboard is undefined entirely. The key is selectable
      // on screen either way, so this fails quietly rather than throwing.
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
    >
      {copied ? <MdCheck /> : <MdContentCopy />}
      {copied ? "Copied" : label}
    </button>
  );
};

const ConnectSource = ({ functionsUrl }) => {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("web");
  const [issued, setIssued] = useState(null);

  const createSource = useCreateDataSource();
  const issueKey = useIssueWriteKey();
  const sources = useDataSources();

  /**
   * mutateAsync rejects on failure, and react-query has already recorded the
   * error on the mutation for the QueryError below to render. Swallowing it
   * here is what stops that same failure also surfacing as an unhandled
   * promise rejection in the console.
   */
  const rotate = async (source) => {
    try {
      const key = await issueKey.mutateAsync({ id: source.id });
      setIssued({ name: source.name, key });
    } catch {
      setIssued(null);
    }
  };

  const busy = createSource.isPending || issueKey.isPending;
  const error = createSource.error || issueKey.error;

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;

    try {
      // Two steps rather than one: the row has to exist before it can be
      // given a key. If the mint fails the source is still created and can be
      // rotated from the list, so this doesn't need to be transactional.
      const source = await createSource.mutateAsync({
        name: trimmed,
        kind,
        platforms: kind === "web" || kind === "mobile" ? [kind] : [],
      });
      const key = await issueKey.mutateAsync({ id: source.id });

      setIssued({ name: source.name, key });
      setName("");
    } catch {
      // Rendered from the mutation's own error state; see rotate() above.
      setIssued(null);
    }
  };

  const snippet = issued
    ? `curl -X POST ${functionsUrl || "<your-project>/functions/v1"}/ingest \\
  -H "Authorization: Bearer ${issued.key}" \\
  -H "Content-Type: application/json" \\
  -d '{"events":[{"name":"page_view","distinct_id":"u_123","platform":"web"}]}'`
    : "";

  return (
    <Card extra="w-full h-full p-6">
      <h4 className="text-xl font-bold text-navy-700 dark:text-white">
        Connect a source
      </h4>
      <p className="mt-1 text-sm text-gray-600">
        Creates a data source and issues a write key for the ingest endpoint.
      </p>

      <form onSubmit={submit} className="mt-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <InputField
            id="source-name"
            label="Name"
            placeholder="Marketing site"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <div>
            <label
              htmlFor="source-kind"
              className="ml-3 text-sm font-bold text-navy-700 dark:text-white"
            >
              Kind
            </label>
            <select
              id="source-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className="mt-2 flex h-12 w-full items-center rounded-xl border border-gray-200 bg-white/0 p-3 text-sm capitalize outline-none dark:!border-white/10 dark:text-white"
            >
              {KINDS.map((option) => (
                <option
                  key={option}
                  value={option}
                  className="capitalize dark:bg-navy-800"
                >
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="linear mt-4 rounded-xl bg-brand-500 px-5 py-3 text-sm font-medium text-white transition duration-200 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-400 dark:hover:bg-brand-300"
        >
          {busy ? "Creating…" : "Create source & issue key"}
        </button>
      </form>

      {error ? (
        <div className="mt-4">
          <QueryError error={error} />
        </div>
      ) : null}

      {issued ? (
        <div className="mt-6 rounded-2xl bg-navy-800 p-5 dark:bg-navy-900">
          <div className="flex items-center gap-2 text-amber-400">
            <MdWarningAmber className="text-lg" />
            <p className="text-sm font-bold">
              Copy this key now — it will not be shown again
            </p>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Only a hash is stored. If you lose it, rotate the key from the
            source list to issue a new one.
          </p>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-black/40 p-3">
            <code className="select-all break-all font-mono text-sm text-green-400">
              {issued.key}
            </code>
            <CopyButton value={issued.key} label="Copy key" />
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-400">
                Send your first event
              </p>
              <CopyButton value={snippet} label="Copy command" />
            </div>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-black/40 p-3 font-mono text-xs leading-relaxed text-gray-300">
              {snippet}
            </pre>
          </div>

          <button
            type="button"
            onClick={() => setIssued(null)}
            className="mt-4 flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-white"
          >
            <MdKey /> I've saved it — dismiss
          </button>
        </div>
      ) : null}

      {/* Existing keys. Only the six-character hint is readable — enough to
          tell two keys apart when deciding which to rotate, and useless for
          reconstructing one. Sources with no key have never been connected. */}
      {(sources.data ?? []).length > 0 ? (
        <div className="mt-6">
          <p className="mb-2 text-sm font-bold text-navy-700 dark:text-white">
            Write keys
          </p>
          <div className="divide-y divide-gray-200 dark:divide-white/10">
            {sources.data.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy-700 dark:text-white">
                    {source.name}
                  </p>
                  <p className="font-mono text-xs text-gray-600">
                    {source.write_key_hint
                      ? `nvk_…${source.write_key_hint}`
                      : "No key issued"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => rotate(source)}
                  disabled={issueKey.isPending}
                  className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-navy-700 transition hover:bg-gray-100 disabled:opacity-50 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                >
                  {source.write_key_hint ? "Rotate" : "Issue key"}
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-600">
            Rotating immediately invalidates the previous key.
          </p>
        </div>
      ) : null}
    </Card>
  );
};

export default ConnectSource;
