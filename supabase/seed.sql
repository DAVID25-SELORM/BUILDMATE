insert into public.categories (name,slug,sort_order) values
('Structural Materials','structural-materials',1),
('Roofing','roofing',2),
('Plumbing','plumbing',3),
('Electrical','electrical',4),
('Finishing','finishing',5),
('Tools & Equipment','tools-equipment',6)
on conflict do nothing;

insert into public.brands (name,slug) values
('Generic','generic'),('Ghacem','ghacem'),('Diamond Cement','diamond-cement')
on conflict do nothing;
