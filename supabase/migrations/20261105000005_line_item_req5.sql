-- Req. 5 (a)-(k): tag management / administration lines with the Directive item they satisfy.
-- Used by validation rule V-15. Nullable: only management and administration lines carry it.
alter table public.cost_line_items
  add column req5_item text check (req5_item is null or req5_item in ('a','b','c','d','e','f','g','h','i','j','k'));
