-- =============================================================================
-- 0004 — Storage : images du chat et photos des élèves
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('chat-images', 'chat-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('contestant-photos', 'contestant-photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "chat-images: lecture publique"
  on storage.objects for select
  using (bucket_id = 'chat-images');

create policy "chat-images: membres déposent dans leur dossier"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and public.is_member()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "chat-images: l'auteur supprime"
  on storage.objects for delete to authenticated
  using (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "contestant-photos: lecture publique"
  on storage.objects for select
  using (bucket_id = 'contestant-photos');

create policy "contestant-photos: admin écrit"
  on storage.objects for all to authenticated
  using (bucket_id = 'contestant-photos' and public.is_admin())
  with check (bucket_id = 'contestant-photos' and public.is_admin());
