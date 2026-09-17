"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pastille } from "@/components/ui/Pastille";
import { EmptyBox } from "@/components/ui/Feedback";
import { GifSheet } from "@/components/chat/GifSheet";
import { MessageBody } from "@/components/chat/MessageBody";
import { useSeason } from "@/lib/season";
import { supabase } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { chatTime } from "@/lib/format";
import type { Gif } from "@/lib/tenor";
import type { Message, MessageReaction } from "@/lib/types";

const PAGE = 50;
const EMOJIS = ["👍", "😂", "😮", "😭", "🔥", "❤️"];

export function Chat({ className = "" }: { className?: string }) {
  const store = useSeason();
  const seasonId = store.season?.id ?? null;
  const me = store.profile;
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<null | "send" | "image">(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stickToBottom = useRef(true);

  const profiles = useMemo(() => new Map(store.profiles.map((p) => [p.id, p])), [store.profiles]);

  const loadReactions = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const { data } = await supabase().from("message_reactions").select("*").in("message_id", ids);
    setReactions((prev) => {
      const keep = prev.filter((r) => !ids.includes(r.message_id));
      return [...keep, ...((data ?? []) as MessageReaction[])];
    });
  }, []);

  // Chargement initial : les 50 derniers
  useEffect(() => {
    if (!seasonId) return;
    let cancelled = false;
    setMessages([]);
    setReactions([]);
    supabase()
      .from("messages")
      .select("*")
      .eq("season_id", seasonId)
      .order("created_at", { ascending: false })
      .limit(PAGE)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
          return;
        }
        const list = ((data ?? []) as Message[]).reverse();
        setMessages(list);
        setHasMore(list.length === PAGE);
        void loadReactions(list.map((m) => m.id));
        stickToBottom.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [seasonId, loadReactions]);

  // Temps réel
  useEffect(() => {
    if (!seasonId) return;
    const sb = supabase();
    const ch = sb
      .channel(`chat-${seasonId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `season_id=eq.${seasonId}` }, (p) => {
        const m = p.new as Message;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `season_id=eq.${seasonId}` }, (p) => {
        const m = p.new as Message;
        setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reactions" }, (p) => {
        const r = p.new as MessageReaction;
        setReactions((prev) => (prev.some((x) => x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji) ? prev : [...prev, r]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_reactions" }, (p) => {
        const r = p.old as Partial<MessageReaction>;
        setReactions((prev) => prev.filter((x) => !(x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji)));
      })
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, [seasonId]);

  // Défilement : on colle au bas tant que l'utilisateur y est
  useEffect(() => {
    const el = listRef.current;
    if (!el || !stickToBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function loadOlder() {
    if (!seasonId || !messages.length) return;
    const el = listRef.current;
    const before = el ? el.scrollHeight : 0;
    const { data } = await supabase()
      .from("messages")
      .select("*")
      .eq("season_id", seasonId)
      .lt("created_at", messages[0].created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    const older = ((data ?? []) as Message[]).reverse();
    setHasMore(older.length === PAGE);
    stickToBottom.current = false;
    setMessages((prev) => [...older, ...prev]);
    void loadReactions(older.map((m) => m.id));
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - before;
    });
  }

  async function send(payload: Partial<Message>) {
    if (!seasonId || !me) return;
    setBusy("send");
    setError(null);
    const { error } = await supabase().from("messages").insert({ season_id: seasonId, user_id: me.id, ...payload });
    setBusy(null);
    if (error) setError(error.message);
    stickToBottom.current = true;
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    await send({ body });
    inputRef.current?.focus();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !me) return;
    setBusy("image");
    setError(null);
    try {
      const { blob, ext, contentType } = await compressImage(file);
      const path = `${me.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase().storage.from("chat-images").upload(path, blob, { contentType, upsert: false });
      if (error) throw error;
      const { data } = supabase().storage.from("chat-images").getPublicUrl(path);
      await send({ image_url: data.publicUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible");
    } finally {
      setBusy(null);
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!me) return;
    setReactFor(null);
    const exists = reactions.some((r) => r.message_id === messageId && r.user_id === me.id && r.emoji === emoji);
    if (exists) {
      setReactions((prev) => prev.filter((r) => !(r.message_id === messageId && r.user_id === me.id && r.emoji === emoji)));
      await supabase().from("message_reactions").delete().match({ message_id: messageId, user_id: me.id, emoji });
    } else {
      setReactions((prev) => [...prev, { message_id: messageId, user_id: me.id, emoji, created_at: new Date().toISOString() }]);
      await supabase().from("message_reactions").insert({ message_id: messageId, user_id: me.id, emoji });
    }
  }

  async function remove(messageId: string) {
    setConfirmDelete(null);
    const { error } = await supabase().from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", messageId);
    if (error) setError(error.message);
  }

  // Mentions : @pseudo en cours de saisie
  const mention = useMemo(() => {
    const m = /(^|\s)@([^\s@]*)$/.exec(draft);
    if (!m) return null;
    const q = m[2].toLowerCase();
    const list = store.profiles.filter((p) => p.id !== me?.id && p.display_name.toLowerCase().startsWith(q)).slice(0, 5);
    return list.length ? { query: m[2], list } : null;
  }, [draft, store.profiles, me?.id]);

  function insertMention(name: string) {
    setDraft((d) => d.replace(/@([^\s@]*)$/, `@${name} `));
    inputRef.current?.focus();
  }

  const validated = store.leaderboard.filter((r) => r.has_submitted).length;

  return (
    <section className={`card flex flex-col ${className}`}>
      <div className="px-4 py-3.5 border-b border-line">
        <h2 className="card-title">Le chat</h2>
        <p className="m-0 mt-0.5 text-xs text-ink-2">
          {store.profiles.length} joueur{store.profiles.length > 1 ? "s" : ""} · seul espace public
        </p>
      </div>

      <ul ref={listRef} onScroll={onScroll} className="list-none m-0 p-3 flex-1 min-h-[240px] overflow-y-auto flex flex-col gap-3">
        {hasMore ? (
          <li className="text-center">
            <button type="button" onClick={loadOlder} className="btn-muted text-[13px] min-h-9">
              Messages précédents
            </button>
          </li>
        ) : null}
        {messages.length === 0 ? (
          <li>
            <EmptyBox title="Personne n'a encore parlé">
              {validated > 0 ? `${validated} joueur${validated > 1 ? "s" : ""} sur ${store.profiles.length} ${validated > 1 ? "ont" : "a"} validé son classement. ` : ""}
              À toi de lancer le premier message.
            </EmptyBox>
          </li>
        ) : null}
        {messages.map((m) => {
          const author = profiles.get(m.user_id);
          const mine = m.user_id === me?.id;
          const rs = reactions.filter((r) => r.message_id === m.id);
          const grouped = EMOJIS.map((e) => ({ emoji: e, users: rs.filter((r) => r.emoji === e).map((r) => r.user_id) })).filter((g) => g.users.length);
          return (
            <li key={m.id} className="flex gap-2.5 group">
              <Pastille name={author?.display_name ?? "?"} photo={author?.avatar_url} size={30} tone={mine ? "violet" : "veil"} />
              <div className="min-w-0 flex-1">
                <p className="m-0 mb-0.5 text-xs text-ink-2">
                  <span className="font-semibold text-ink">{author?.display_name ?? "Joueur parti"}{mine ? " (toi)" : ""}</span> · {chatTime(m.created_at)}
                </p>
                {m.deleted_at ? (
                  <p className="m-0 text-sm italic text-ink-2">Message supprimé</p>
                ) : (
                  <>
                    {m.body ? (
                      <p className="m-0 text-sm leading-[1.45] [text-wrap:pretty] break-words whitespace-pre-wrap">
                        <MessageBody body={m.body} profiles={store.profiles} />
                      </p>
                    ) : null}
                    {m.gif_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.gif_url} alt="GIF" className="mt-1 max-w-[240px] max-h-[240px] rounded-[10px] border border-line" loading="lazy" />
                    ) : null}
                    {m.image_url ? (
                      <a href={m.image_url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.image_url} alt="Image partagée" className="mt-1 max-w-[260px] max-h-[260px] rounded-[10px] border border-line" loading="lazy" />
                      </a>
                    ) : null}
                  </>
                )}
                {!m.deleted_at ? (
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {grouped.map((g) => {
                      const meIn = me ? g.users.includes(me.id) : false;
                      return (
                        <button
                          key={g.emoji}
                          type="button"
                          onClick={() => toggleReaction(m.id, g.emoji)}
                          aria-pressed={meIn}
                          title={g.users.map((u) => profiles.get(u)?.display_name ?? "?").join(", ")}
                          className={`inline-flex items-center gap-1 min-h-7 px-2 rounded-full text-xs border ${meIn ? "bg-violet-veil border-violet-line text-violet-dark" : "bg-surface border-line text-ink-2"}`}
                        >
                          {g.emoji} {g.users.length}
                        </button>
                      );
                    })}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setReactFor(reactFor === m.id ? null : m.id)}
                        aria-label="Réagir"
                        aria-expanded={reactFor === m.id}
                        className="min-h-7 min-w-7 px-1.5 rounded-full text-xs text-ink-2 border border-transparent hover:border-line"
                      >
                        +☺
                      </button>
                      {reactFor === m.id ? (
                        <div role="group" aria-label="Réactions" className="absolute z-10 left-0 top-full mt-1 flex gap-0.5 bg-surface border border-line rounded-full px-1 py-0.5 shadow-none">
                          {EMOJIS.map((e) => (
                            <button key={e} type="button" onClick={() => toggleReaction(m.id, e)} aria-label={`Réagir ${e}`} className="min-w-9 min-h-9 text-lg rounded-full hover:bg-page">
                              {e}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {mine ? (
                      confirmDelete === m.id ? (
                        <button type="button" onClick={() => remove(m.id)} className="min-h-7 px-2 rounded-full text-xs font-semibold text-ko bg-ko-veil">
                          Confirmer la suppression
                        </button>
                      ) : (
                        <button type="button" onClick={() => setConfirmDelete(m.id)} className="min-h-7 px-2 rounded-full text-xs text-ink-2 hover:text-ko">
                          Supprimer
                        </button>
                      )
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <form onSubmit={submit} className="relative border-t border-line p-3 flex flex-col gap-2">
        {error ? <p className="m-0 text-xs text-ko">{error}</p> : null}
        {mention ? (
          <ul role="listbox" aria-label="Mentionner un joueur" className="absolute bottom-full left-3 mb-1 list-none m-0 p-1 bg-surface border border-line rounded-sm flex flex-col">
            {mention.list.map((p) => (
              <li key={p.id}>
                <button type="button" role="option" aria-selected={false} onClick={() => insertMention(p.display_name)} className="w-full text-left min-h-9 px-2.5 rounded-[8px] text-sm hover:bg-violet-veil">
                  @{p.display_name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex gap-2 items-end">
          <label htmlFor="chat-input" className="sr-only-label">
            Message au groupe
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Écrire au groupe"
            className="field flex-1 py-2.5 resize-none max-h-32 leading-[1.4]"
            style={{ minHeight: 44 }}
          />
          <button type="submit" disabled={busy !== null || !draft.trim()} className="btn-primary min-w-11 px-3.5 text-sm">
            Envoyer
          </button>
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => setGifOpen(true)} className="btn-muted min-h-9 text-xs font-bold tracking-wide px-3">
            GIF
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy === "image"} className="btn-muted min-h-9 text-xs px-3">
            {busy === "image" ? "Envoi…" : "Image"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" aria-label="Choisir une image" />
          <span className="ml-auto self-center text-[11px] text-ink-2">@ pour mentionner</span>
        </div>
      </form>

      <GifSheet
        open={gifOpen}
        onClose={() => setGifOpen(false)}
        onPick={(g: Gif) => {
          setGifOpen(false);
          void send({ gif_url: g.url, gif_provider: "tenor" });
        }}
      />
    </section>
  );
}
