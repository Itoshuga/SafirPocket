-- Every booster-eligible card needs one reusable collection variant.
insert into public.card_variants (
  card_id,
  name,
  slug,
  finish,
  artwork_path,
  display_order
)
select card.id,
       'Standard',
       'standard',
       'standard',
       coalesce(card.image_url, card.artwork_path),
       0
from public.cards card
where not exists (
  select 1
  from public.card_variants variant
  where variant.card_id = card.id
);
