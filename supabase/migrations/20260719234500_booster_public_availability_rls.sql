drop policy if exists booster_products_published_read on public.booster_products;

create policy booster_products_published_read on public.booster_products for select
  using (
    (
      status = 'published'
      and is_active
      and deleted_at is null
      and (available_from is null or available_from <= now())
      and (available_until is null or available_until > now())
    )
    or public.is_privileged()
  );
