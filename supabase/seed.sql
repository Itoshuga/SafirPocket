-- LOCAL DEVELOPMENT DATA ONLY. Never apply automatically to an existing remote database.
do $$
declare
  demo_set_id uuid := '10000000-0000-4000-8000-000000000001';
  card_one_id uuid := '20000000-0000-4000-8000-000000000001';
  card_two_id uuid := '20000000-0000-4000-8000-000000000002';
  card_three_id uuid := '20000000-0000-4000-8000-000000000003';
  variant_one_id uuid := '30000000-0000-4000-8000-000000000001';
  variant_two_id uuid := '30000000-0000-4000-8000-000000000002';
  variant_three_id uuid := '30000000-0000-4000-8000-000000000003';
  booster_id uuid := '40000000-0000-4000-8000-000000000001';
  common_rarity_id uuid := '50000000-0000-4000-8000-000000000001';
  rare_rarity_id uuid := '50000000-0000-4000-8000-000000000002';
  epic_rarity_id uuid := '50000000-0000-4000-8000-000000000003';
  unit_type_id uuid := '60000000-0000-4000-8000-000000000001';
  artifact_type_id uuid := '60000000-0000-4000-8000-000000000002';
  spell_type_id uuid := '60000000-0000-4000-8000-000000000003';
begin
  insert into public.card_sets (id, name, slug, code, description, status, display_order, metadata)
  values (demo_set_id, 'Éclats de Démonstration', 'eclats-demo', 'DEMO',
    'Extension fictive réservée au développement local.', 'published', 1, '{"demo":true}')
  on conflict (id) do nothing;

  insert into public.card_seasons (id, name, slug, code, description, is_active, sort_order)
  values (demo_set_id, 'Éclats de Démonstration', 'eclats-demo', 'DEMO',
    'Saison fictive réservée au développement local.', true, 1)
  on conflict (id) do nothing;

  insert into public.card_rarities (id, name, slug, sort_order)
  values
    (common_rarity_id, 'Commune', 'commune', 1),
    (rare_rarity_id, 'Rare', 'rare', 2),
    (epic_rarity_id, 'Épique', 'epique', 3)
  on conflict (id) do nothing;

  insert into public.card_types (id, name, slug, sort_order)
  values
    (unit_type_id, 'Unité', 'unite', 1),
    (artifact_type_id, 'Artefact', 'artefact', 2),
    (spell_type_id, 'Sort', 'sort', 3)
  on conflict (id) do nothing;

  insert into public.cards (
    id, set_id, name, slug, collection_number, rarity, card_type, cost, effect_text,
    effects, stats, status, display_order, number, attack, defense, value,
    is_commander, rarity_id, season_id, is_active
  )
  values
    (card_one_id, demo_set_id, 'Sentinelle d’Azur', 'sentinelle-azur', '001', 'commune', 'unité', 1,
      'Exemple technique sans règle officielle.', '[{"effectId":"DRAW_CARDS","version":1,"params":{"amount":1}}]', '{"power":1}', 'published', 1,
      1, 1, 0, 1, false, common_rarity_id, demo_set_id, true),
    (card_two_id, demo_set_id, 'Prisme Veilleur', 'prisme-veilleur', '002', 'rare', 'artefact', 2,
      'Exemple fictif de données de carte.', '[]', '{}', 'published', 2,
      2, 0, 2, 2, false, rare_rarity_id, demo_set_id, true),
    (card_three_id, demo_set_id, 'Éclat de Minuit', 'eclat-minuit', '003', 'épique', 'sort', 3,
      'Exemple technique; aucune règle Safir TCG n’est déduite.', '[{"effectId":"HEAL_TARGET","version":1,"params":{"amount":1}}]', '{}', 'published', 3,
      3, 0, 0, 3, false, epic_rarity_id, demo_set_id, true)
  on conflict (id) do nothing;

  insert into public.card_type_links (card_id, type_id, sort_order)
  values
    (card_one_id, unit_type_id, 0),
    (card_two_id, artifact_type_id, 0),
    (card_three_id, spell_type_id, 0)
  on conflict (card_id, type_id) do nothing;

  insert into public.card_variants (id, card_id, name, slug, finish)
  values
    (variant_one_id, card_one_id, 'Standard', 'standard', 'standard'),
    (variant_two_id, card_two_id, 'Standard', 'standard', 'standard'),
    (variant_three_id, card_three_id, 'Standard', 'standard', 'standard')
  on conflict (id) do nothing;

  insert into public.booster_products (id, name, slug, description, price_currency, price_amount, cards_per_pack, status, metadata)
  values (booster_id, 'Booster Démonstration', 'booster-demo',
    'Produit fictif pour tester le flux serveur.', 'demo_gem', 100, 3, 'published', '{"demo":true}')
  on conflict (id) do nothing;

  insert into public.booster_product_slots (booster_product_id, slot_index, quantity, weight_config)
  values (
    booster_id,
    0,
    3,
    jsonb_build_object('entries', jsonb_build_array(
      jsonb_build_object('cardVariantId', variant_one_id, 'weight', 70),
      jsonb_build_object('cardVariantId', variant_two_id, 'weight', 25),
      jsonb_build_object('cardVariantId', variant_three_id, 'weight', 5)
    ))
  )
  on conflict (booster_product_id, slot_index) do nothing;
end $$;
