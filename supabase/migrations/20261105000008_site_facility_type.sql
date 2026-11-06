-- F035 (Liability Declaration) asks for the facility description from Directive 056, Table 1.
-- Free text here; the app offers the exact list the PDF's dropdown accepts.
alter table public.sites add column facility_type text;
