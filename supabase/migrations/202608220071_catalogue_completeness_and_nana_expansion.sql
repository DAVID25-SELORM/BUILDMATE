-- Expand the canonical construction catalogue and reconcile only evidence-backed
-- Nana Attakorah II Ventures products. No listing is published and no stock,
-- cost, price, or warehouse is fabricated.
begin;

-- Customer-facing catalogue groups.
insert into public.categories(name,slug,sort_order) values
 ('Cement & Concrete','cement-concrete',10),
 ('Blocks & Masonry','blocks-masonry',20),
 ('Steel & Reinforcement','steel-reinforcement',30),
 ('Timber & Boards','timber-wood',40),
 ('Roofing','roofing',50),
 ('Doors & Windows','doors-windows',60),
 ('Plumbing & Sanitary','plumbing-sanitary',70),
 ('Electrical','electrical',80),
 ('Tiles & Flooring','tiles-flooring',90),
 ('Ceilings & Drywall','ceilings-drywall',100),
 ('Paint & Finishes','paint-finishes',110),
 ('Kitchen & Joinery','kitchen-joinery',120),
 ('External Works','external-works',130),
 ('Tools & Equipment','tools-equipment',140),
 ('Hardware & Fittings','hardware-fittings',900)
on conflict(slug) do update set name=excluded.name,sort_order=excluded.sort_order,is_active=true;

-- Subcategories keep BOQ mapping precise while retaining simple top-level navigation.
with subcategory(parent_slug,name,slug,sort_order) as(values
 ('cement-concrete','Cement','cement',11),('cement-concrete','Aggregates','aggregates',12),
 ('blocks-masonry','Blocks','blocks',21),('blocks-masonry','Foundation Materials','foundation-materials',22),
 ('steel-reinforcement','Reinforcement Steel','reinforcement-steel',31),('steel-reinforcement','Reinforcement Accessories','reinforcement-accessories',32),
 ('timber-wood','Structural Timber','structural-timber',41),('timber-wood','Boards & Sheet Materials','boards-sheet-materials',42),
 ('roofing','Roof Coverings','roof-coverings',51),('roofing','Roofing Accessories','roofing-accessories',52),('roofing','Rainwater Goods','rainwater-goods',53),
 ('doors-windows','Doors & Frames','doors-frames',61),('doors-windows','Windows & Louvre Systems','windows-louvre-systems',62),('doors-windows','Locks & Ironmongery','locks-ironmongery',63),
 ('plumbing-sanitary','Pipes & Fittings','pipes-fittings',71),('plumbing-sanitary','Taps & Valves','taps-valves',72),('plumbing-sanitary','Sanitary Ware','sanitary-ware',73),('plumbing-sanitary','Drainage & Water Storage','drainage-water-storage',74),
 ('electrical','Cables & Wiring','cables-wiring',81),('electrical','Conduits & Boxes','conduits-boxes',82),('electrical','Protection & Distribution','protection-distribution',83),('electrical','Lighting & Accessories','lighting-accessories',84),
 ('tiles-flooring','Tiles','tiles',91),('tiles-flooring','Tiling Accessories','tiling-accessories',92),('tiles-flooring','Waterproofing & Screeding','waterproofing-screeding',93),
 ('ceilings-drywall','Boards & Panels','ceiling-boards-panels',101),('ceilings-drywall','Framework & Finishing','ceiling-framework-finishing',102),
 ('paint-finishes','Paints & Primers','paints-primers',111),('paint-finishes','Painting Tools & Preparation','painting-tools-preparation',112),
 ('kitchen-joinery','Cabinet Materials','cabinet-materials',121),('kitchen-joinery','Cabinet Hardware','cabinet-hardware',122),
 ('external-works','Paving & Kerbs','paving-kerbs',131),('external-works','Drainage & Fencing','drainage-fencing',132),('external-works','Landscaping & External Lighting','landscaping-external-lighting',133),
 ('tools-equipment','Site Tools','site-tools',141),('tools-equipment','Measuring & Cutting Tools','measuring-cutting-tools',142)
)
insert into public.categories(parent_id,name,slug,sort_order)
select p.id,s.name,s.slug,s.sort_order from subcategory s join public.categories p on p.slug=s.parent_slug
on conflict(slug) do update set parent_id=excluded.parent_id,name=excluded.name,sort_order=excluded.sort_order,is_active=true;

-- Reclassify existing canonical products instead of duplicating them.
with mapping(product_slug,category_slug) as(values
 ('sawn-hardwood-timber','structural-timber'),('bamboo-construction-poles','structural-timber'),
 ('timber-board','boards-sheet-materials'),('plywood','boards-sheet-materials'),
 ('high-tensile-reinforcement-bars','reinforcement-steel'),('welded-wire-mesh','reinforcement-steel'),('binding-wire','reinforcement-accessories'),
 ('corrugated-roofing-sheets','roof-coverings'),('louvre-glass','windows-louvre-systems'),('silicone-sealant','windows-louvre-systems'),
 ('pvc-metal-building-fittings','pipes-fittings'),('construction-wheelbarrow','site-tools'),('shovels-spades-metal-pans','site-tools'),
 ('interior-exterior-paint','paints-primers')
)
update public.products p set category_id=c.id,updated_at=now()
from mapping m join public.categories c on c.slug=m.category_slug where p.slug=m.product_slug and p.category_id<>c.id;

-- Canonical products. Units are limited to established trade units; uncertain
-- pack sizes and specifications remain variants or supplier clarifications.
with catalogue(category_slug,name,slug,base_unit,description,aliases) as(values
 ('cement','Portland Cement','portland-cement','bag','General construction cement sold by bag.',array['cement','building cement']::text[]),
 ('aggregates','Building Sand','building-sand','cubic metre','Sand for masonry, concrete and screeding.',array['sand','construction sand']::text[]),
 ('aggregates','Stone Chippings','stone-chippings','cubic metre','Crushed stone aggregate for concrete and external works.',array['chippings','stones','crushed stone']::text[]),
 ('aggregates','Hardcore','hardcore','cubic metre','Hardcore filling material for substructure work.',array['hard core','foundation hardcore']::text[]),
 ('aggregates','Laterite Filling Material','laterite-filling-material','cubic metre','Laterite for approved filling and earthworks.',array['laterite','filling material']::text[]),
 ('blocks','Concrete Blocks','concrete-blocks','piece','Concrete or sandcrete walling blocks sold by size.',array['blocks','sandcrete blocks','cement blocks']::text[]),
 ('foundation-materials','Damp Proof Course','damp-proof-course','roll','DPC membrane for walls and foundation interfaces.',array['dpc','damp proof course']::text[]),
 ('foundation-materials','Damp Proof Membrane','damp-proof-membrane','roll','DPM sheet membrane for ground floors.',array['dpm','damp proof membrane']::text[]),
 ('foundation-materials','Anti-Termite Treatment','anti-termite-treatment','litre','Chemical treatment for approved substructure termite protection.',array['termite treatment','anti termite']::text[]),
 ('roof-coverings','Roofing Tiles','roofing-tiles','piece','Roof tiles sold by material, profile and finish.',array['roof tiles']::text[]),
 ('roof-coverings','Steel Roofing Members','steel-roofing-members','length','Steel members for designed roof structures.',array['steel roof members','roof truss steel']::text[]),
 ('roofing-accessories','Fascia Boards','fascia-boards','length','Fascia boards for roof-edge finishing.',array['fascia board']::text[]),
 ('roofing-accessories','Roofing Nails','roofing-nails','pack','Nails manufactured for roof-sheet fixing.',array['roof nails']::text[]),
 ('roofing-accessories','Roofing Screws','roofing-screws','pack','Weather-sealed screws for roofing sheets.',array['roof screws']::text[]),
 ('roofing-accessories','Ridge Caps','ridge-caps','length','Roof ridge cover matched to roofing profile.',array['roof ridge','ridge cap']::text[]),
 ('roofing-accessories','Valley Gutters','valley-gutters','length','Valley channels for intersecting roof slopes.',array['roof valley','valley gutter']::text[]),
 ('roofing-accessories','Roof Flashing','roof-flashing','length','Sheet flashing for roof junction weatherproofing.',array['flashing','roof flashing']::text[]),
 ('roofing-accessories','Roof Insulation','roof-insulation','roll','Insulation layer for roof assemblies.',array['roofing insulation','thermal insulation']::text[]),
 ('roofing-accessories','Timber Preservative','timber-preservative','litre','Protective treatment for approved timber applications.',array['wood preservative','timber treatment']::text[]),
 ('rainwater-goods','Rain Gutters','rain-gutters','length','Roof-edge rainwater collection gutters.',array['gutters','roof gutter']::text[]),
 ('rainwater-goods','Rainwater Downpipes','rainwater-downpipes','length','Vertical rainwater pipes connected to gutters.',array['downpipes','rain pipe']::text[]),
 ('doors-frames','Security Doors','security-doors','unit','External security doors sold by size and construction.',array['security door','steel door']::text[]),
 ('doors-frames','Internal Doors','internal-doors','unit','Internal doors sold by material and size.',array['interior doors','room doors']::text[]),
 ('doors-frames','Door Frames','door-frames','unit','Frames matched to door material and opening size.',array['door frame']::text[]),
 ('locks-ironmongery','Door Locks','door-locks','unit','Door locksets sold by type and application.',array['locks','door lock']::text[]),
 ('locks-ironmongery','Padlocks','padlocks','unit','Portable keyed or combination padlocks.',array['padlock']::text[]),
 ('locks-ironmongery','Lock Cylinders','lock-cylinders','unit','Replacement door lock cylinders.',array['cylinder lock','lock barrel']::text[]),
 ('locks-ironmongery','Door Handles','door-handles','pair','Door handles sold as matched pairs.',array['handles','door handle']::text[]),
 ('locks-ironmongery','Hinges','hinges','pair','Door, window and cabinet hinges sold by type and size.',array['door hinges','window hinges']::text[]),
 ('windows-louvre-systems','Aluminium Windows','aluminium-windows','unit','Aluminium window assemblies sold by size and configuration.',array['aluminum windows','aluminium window']::text[]),
 ('windows-louvre-systems','uPVC Windows','upvc-windows','unit','uPVC window assemblies sold by size and configuration.',array['upvc window','plastic windows']::text[]),
 ('windows-louvre-systems','Louvre Frames','louvre-frames','unit','Frames and carriers for louvre glass systems.',array['louvre frame','jalousie frame']::text[]),
 ('windows-louvre-systems','Mosquito Nets','mosquito-nets','square metre','Insect-screen material or assemblies.',array['insect screen','mosquito mesh']::text[]),
 ('windows-louvre-systems','Window Accessories','window-accessories','piece','Window-specific fittings requiring type and size confirmation.',array['window fittings']::text[]),
 ('pipes-fittings','PVC Pipes','pvc-pipes','length','PVC pipes sold by diameter, class and application.',array['pvc','plastic pipes','pvc pipe']::text[]),
 ('pipes-fittings','PPR Pipes','ppr-pipes','length','PPR pressure pipes sold by diameter and pressure class.',array['ppr','ppr pipe']::text[]),
 ('pipes-fittings','Metal Pipes','metal-pipes','length','Metal pipes sold by material, diameter and class.',array['steel pipes','galvanized pipes']::text[]),
 ('pipes-fittings','Pipe Fittings','pipe-fittings','piece','Pipe fittings sold by material, fitting type and diameter.',array['plumbing fittings','pipe connectors']::text[]),
 ('taps-valves','Plumbing Valves','plumbing-valves','piece','Flow-control valves sold by type and diameter.',array['water valves','pipe valves']::text[]),
 ('taps-valves','Water Taps','water-taps','unit','Water taps sold by application and finish.',array['taps','faucets']::text[]),
 ('taps-valves','Water Mixers','water-mixers','unit','Hot and cold water mixer fittings.',array['mixer taps','faucet mixer']::text[]),
 ('sanitary-ware','WC Sets','wc-sets','set','Complete water-closet sets sold by configuration.',array['toilet set','water closet','wc']::text[]),
 ('sanitary-ware','Wash-Hand Basins','wash-hand-basins','unit','Wash-hand basins sold by size and mounting type.',array['wash basin','hand basin']::text[]),
 ('sanitary-ware','Kitchen Sinks','kitchen-sinks','unit','Kitchen sinks sold by material, bowl arrangement and size.',array['sink','kitchen sink']::text[]),
 ('sanitary-ware','Shower Sets','shower-sets','set','Shower fittings sold as complete sets.',array['shower kit','shower']::text[]),
 ('drainage-water-storage','Water Storage Tanks','water-storage-tanks','unit','Water tanks sold by verified capacity and material.',array['water tank','poly tank']::text[]),
 ('drainage-water-storage','Floor Drains','floor-drains','piece','Floor drain outlets sold by size and material.',array['floor trap','drain outlet']::text[]),
 ('drainage-water-storage','Plumbing Traps','plumbing-traps','piece','Waste traps sold by type and connection size.',array['p trap','bottle trap']::text[]),
 ('drainage-water-storage','Waste Pipes','waste-pipes','length','Wastewater pipes sold by diameter and class.',array['waste pipe','drain pipe']::text[]),
 ('drainage-water-storage','Inspection Chamber Materials','inspection-chamber-materials','piece','Components for designed inspection chambers.',array['inspection chamber']::text[]),
 ('drainage-water-storage','Manhole Materials','manhole-materials','piece','Manhole covers, rings and related components.',array['manhole cover','manhole ring']::text[]),
 ('drainage-water-storage','Septic & Sewer Accessories','septic-sewer-accessories','piece','Septic and sewer fittings requiring specification confirmation.',array['septic fittings','sewer accessories']::text[]),
 ('pipes-fittings','Plumbing Adhesive & Sealant','plumbing-adhesive-sealant','tube','Adhesives and sealants for compatible plumbing systems.',array['pvc glue','pipe adhesive','plumbing sealant']::text[]),
 ('cables-wiring','Electrical Cables','electrical-cables','metre','Electrical cables sold by conductor count, size and rating.',array['electric cable','power cable']::text[]),
 ('cables-wiring','Electrical Wires','electrical-wires','metre','Single-core and installation wires sold by size and rating.',array['electric wire','house wire']::text[]),
 ('cables-wiring','Earthing Cables','earthing-cables','metre','Protective earthing conductors sold by size.',array['earth cable','ground wire']::text[]),
 ('conduits-boxes','Electrical Conduits','electrical-conduits','length','Electrical conduit sold by material and diameter.',array['conduit','electrical pipe']::text[]),
 ('conduits-boxes','Conduit Fittings','conduit-fittings','piece','Conduit bends, couplers and connectors.',array['conduit accessories']::text[]),
 ('conduits-boxes','Junction Boxes','junction-boxes','piece','Electrical junction and adaptable boxes.',array['electrical box','junction box']::text[]),
 ('protection-distribution','Electrical Switches','electrical-switches','unit','Wall switches sold by gang and rating.',array['light switches','switches']::text[]),
 ('protection-distribution','Electrical Sockets','electrical-sockets','unit','Socket outlets sold by gang and rating.',array['power sockets','socket outlet']::text[]),
 ('protection-distribution','Distribution Boards','distribution-boards','unit','Electrical distribution boards sold by way count and rating.',array['consumer unit','db board']::text[]),
 ('protection-distribution','Circuit Breakers','circuit-breakers','unit','Circuit breakers sold by type, poles and current rating.',array['breaker','mcb','rcbo']::text[]),
 ('protection-distribution','Earthing Rods','earthing-rods','length','Earthing electrodes sold by material and dimensions.',array['earth rod','ground rod']::text[]),
 ('protection-distribution','Meter Accessories','meter-accessories','piece','Approved meter boxes and installation accessories.',array['meter box','electric meter accessories']::text[]),
 ('lighting-accessories','Light Fittings','light-fittings','unit','Indoor light fittings sold by type and rating.',array['lighting fixture','light fixture']::text[]),
 ('lighting-accessories','Light Bulbs','light-bulbs','unit','Lamps sold by cap, wattage and colour temperature.',array['bulbs','led bulb']::text[]),
 ('lighting-accessories','Outdoor Lighting Accessories','outdoor-lighting-accessories','piece','Weather-rated lighting fittings and accessories.',array['external lights','outdoor lights']::text[]),
 ('tiles','Floor Tiles','floor-tiles','box','Floor tiles sold by box with size and coverage specifications.',array['floor tile','ceramic tiles','porcelain tiles']::text[]),
 ('tiles','Wall Tiles','wall-tiles','box','Wall tiles sold by box with size and coverage specifications.',array['wall tile']::text[]),
 ('tiling-accessories','Tile Adhesive','tile-adhesive','bag','Cementitious or specialist tile adhesive.',array['tile glue','ceramic adhesive']::text[]),
 ('tiling-accessories','Tile Grout','tile-grout','bag','Grout for tile joints sold by colour and pack size.',array['grout','tile joint filler']::text[]),
 ('tiling-accessories','Tile Spacers','tile-spacers','pack','Tile spacers sold by joint width.',array['tile spacer']::text[]),
 ('tiling-accessories','Tile Skirting','tile-skirting','piece','Skirting tile pieces matched to floor finishes.',array['skirting tiles']::text[]),
 ('waterproofing-screeding','Waterproofing Products','waterproofing-products','litre','Waterproofing systems sold by application and coverage.',array['waterproofing','waterproof coating']::text[]),
 ('waterproofing-screeding','Screeding Compound','screeding-compound','bag','Prepared screeding or levelling material.',array['floor screed','levelling compound']::text[]),
 ('ceiling-boards-panels','Gypsum Boards','gypsum-boards','sheet','Gypsum plasterboard sold by thickness and dimensions.',array['plasterboard','drywall board']::text[]),
 ('ceiling-boards-panels','POP Materials','pop-materials','bag','Plaster of Paris materials sold by pack size.',array['plaster of paris','pop cement']::text[]),
 ('ceiling-boards-panels','Ceiling Boards','ceiling-boards','sheet','Ceiling boards sold by material, thickness and dimensions.',array['ceiling board']::text[]),
 ('ceiling-framework-finishing','Ceiling Framework','ceiling-framework','length','Metal or timber ceiling support sections.',array['ceiling frame','drywall channels']::text[]),
 ('ceiling-framework-finishing','Drywall Screws','drywall-screws','pack','Screws for compatible drywall and ceiling assemblies.',array['gypsum screws','ceiling screws']::text[]),
 ('ceiling-framework-finishing','Joint Tape','joint-tape','roll','Tape for gypsum-board joints.',array['drywall tape']::text[]),
 ('ceiling-framework-finishing','Joint Compound','joint-compound','bucket','Compound for board joints and finishing.',array['drywall compound','joint filler']::text[]),
 ('ceiling-framework-finishing','Ceiling Cornices','ceiling-cornices','length','Decorative cornices sold by profile and length.',array['cornice','coving']::text[]),
 ('ceiling-framework-finishing','Ceiling Access Panels','ceiling-access-panels','unit','Access panels sold by size and fire rating where applicable.',array['access hatch','ceiling hatch']::text[]),
 ('paints-primers','Wall Putty','wall-putty','bag','Wall putty for approved substrate preparation.',array['skim coat','wall filler']::text[]),
 ('paints-primers','Surface Filler','surface-filler','kg','Filler for cracks and minor surface defects.',array['crack filler','wall filler']::text[]),
 ('paints-primers','Paint Primer','paint-primer','litre','Primer sold by substrate and formulation.',array['primer','undercoat']::text[]),
 ('paints-primers','Interior Emulsion Paint','interior-emulsion-paint','bucket','Interior water-based emulsion paint.',array['interior paint','emulsion paint']::text[]),
 ('paints-primers','Exterior Paint','exterior-paint','bucket','Weather-resistant exterior wall paint.',array['outdoor paint','weatherproof paint']::text[]),
 ('paints-primers','Gloss Paint','gloss-paint','litre','Gloss coating sold by substrate, colour and volume.',array['oil paint','gloss']::text[]),
 ('paints-primers','Metal Primer','metal-primer','litre','Primer formulated for compatible metal surfaces.',array['red oxide','steel primer']::text[]),
 ('paints-primers','Wood Primer','wood-primer','litre','Primer formulated for timber surfaces.',array['timber primer']::text[]),
 ('paints-primers','Paint Thinner','paint-thinner','litre','Compatible thinner sold by formulation and volume.',array['thinner','paint solvent']::text[]),
 ('painting-tools-preparation','Paint Brushes','paint-brushes','piece','Paint brushes sold by width and bristle type.',array['paint brush','brushes']::text[]),
 ('painting-tools-preparation','Paint Rollers','paint-rollers','piece','Paint rollers sold by width and pile type.',array['paint roller','rollers']::text[]),
 ('painting-tools-preparation','Masking Tape','masking-tape','roll','Masking tape sold by width and roll length.',array['painters tape','masking']::text[]),
 ('painting-tools-preparation','Sandpaper','sandpaper','sheet','Abrasive paper sold by grit and application.',array['abrasive paper','glass paper']::text[]),
 ('cabinet-materials','MDF Boards','mdf-boards','sheet','MDF boards sold by thickness, grade and dimensions.',array['mdf','fibreboard']::text[]),
 ('cabinet-materials','Cabinet Boards','cabinet-boards','sheet','Cabinet sheet materials sold by type and finish.',array['cabinet board']::text[]),
 ('cabinet-materials','Kitchen Worktops','kitchen-worktops','length','Worktops sold by material, profile and dimensions.',array['countertop','worktop']::text[]),
 ('cabinet-hardware','Cabinet Handles','cabinet-handles','piece','Cabinet and wardrobe handles sold by style and size.',array['cupboard handles','wardrobe handles']::text[]),
 ('cabinet-hardware','Drawer Runners','drawer-runners','pair','Drawer slides sold by length and load rating.',array['drawer slides','drawer rails']::text[]),
 ('cabinet-hardware','Cabinet Adhesive','cabinet-adhesive','tube','Adhesive for compatible joinery applications.',array['wood glue','joinery adhesive']::text[]),
 ('cabinet-hardware','Wardrobe Fittings','wardrobe-fittings','piece','Wardrobe rails, brackets and related fittings.',array['wardrobe accessories']::text[]),
 ('paving-kerbs','Paving Blocks','paving-blocks','piece','Paving blocks sold by shape, thickness and finish.',array['pavers','interlocking blocks']::text[]),
 ('paving-kerbs','Kerbs','kerbs','piece','Precast kerbs sold by profile and dimensions.',array['curbstones','kerb stones']::text[]),
 ('drainage-fencing','Drainage Channels','drainage-channels','length','Surface drainage channels sold by dimensions and material.',array['channel drain','drain channel']::text[]),
 ('drainage-fencing','Fencing Materials','fencing-materials','piece','Fence components requiring material and size specification.',array['fence materials','fencing']::text[]),
 ('drainage-fencing','Gates','gates','unit','Gates sold by material, opening size and operation.',array['compound gate','security gate']::text[]),
 ('landscaping-external-lighting','Landscaping Materials','landscaping-materials','bag','Packaged landscaping materials sold by material and pack size.',array['landscape materials']::text[]),
 ('site-tools','Masonry Trowels','masonry-trowels','piece','Trowels sold by shape and blade size.',array['trowel','brick trowel']::text[]),
 ('site-tools','Hammers','hammers','piece','Hammers sold by type and weight.',array['claw hammer','club hammer']::text[]),
 ('measuring-cutting-tools','Measuring Tools','measuring-tools','piece','Construction measuring tools sold by type and range.',array['tape measure','spirit level']::text[]),
 ('measuring-cutting-tools','Cutting Tools','cutting-tools','piece','Manual construction cutting tools sold by type and capacity.',array['hand saw','bolt cutter']::text[])
), inserted as(
 insert into public.products(category_id,name,slug,description,base_unit,search_aliases,is_active)
 select c.id,x.name,x.slug,x.description,x.base_unit,x.aliases,true from catalogue x join public.categories c on c.slug=x.category_slug
 on conflict(slug) do update set category_id=excluded.category_id,name=excluded.name,description=excluded.description,
  base_unit=excluded.base_unit,search_aliases=(select array_agg(distinct alias order by alias) from unnest(products.search_aliases||excluded.search_aliases) alias),is_active=true,updated_at=now()
 returning id,name,slug
)
insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data)
select null,'product',i.id::text,'CATALOGUE_COMPLETENESS_UPDATE',jsonb_build_object('product',i.name,'slug',i.slug,'source','approved catalogue completeness reconciliation','migration','202608220071')
from inserted i where not exists(select 1 from public.audit_logs a where a.entity_type='product' and a.entity_id=i.id::text and a.action='CATALOGUE_COMPLETENESS_UPDATE' and a.after_data->>'migration'='202608220071');

-- Improve aliases on the field-visited canonical products without replacing prior aliases.
with aliases(slug,alias_values) as(values
 ('high-tensile-reinforcement-bars',array['rebar','iron rods','reinforcement bars','reinforcement steel']::text[]),
 ('corrugated-roofing-sheets',array['roofing sheet','aluminium roofing','iron sheets']::text[]),
 ('binding-wire',array['tie wire','rebar tying wire']::text[]),('sawn-hardwood-timber',array['wood','lumber','sawn timber']::text[]),
 ('plywood',array['ply board','plywood sheet']::text[]),('welded-wire-mesh',array['wire mesh','reinforcement mesh']::text[]),
 ('construction-wheelbarrow',array['wheelbarrow','site wheelbarrow']::text[]),('louvre-glass',array['jalousie glass','louvre blade']::text[]),
 ('silicone-sealant',array['silicone','building sealant']::text[])
)
update public.products p set search_aliases=(select array_agg(distinct alias order by alias) from unnest(p.search_aliases||a.alias_values) alias),updated_at=now()
from aliases a where p.slug=a.slug;

-- Search accepts an exact alias or a useful alias contained in a longer BOQ line.
create or replace function public.public_marketplace_search_listing_ids(target_query text)
returns setof uuid language sql stable security definer set search_path=public as $$
 select distinct l.id from supplier_listings l join products p on p.id=l.product_id
 left join brands b on b.id=p.brand_id left join product_variants v on v.id=l.product_variant_id
 where marketplace_listing_is_eligible(l) and p.is_active
 and (trim(coalesce(target_query,''))='' or p.name ilike '%'||trim(target_query)||'%'
   or exists(select 1 from unnest(p.search_aliases) alias where lower(trim(target_query))=lower(alias)
     or lower(trim(target_query)) like '%'||lower(alias)||'%')
   or b.name ilike '%'||trim(target_query)||'%' or v.name ilike '%'||trim(target_query)||'%'
   or (v.id is not null and replace(lower(trim(target_query)),' ','') like '%'||replace(lower(v.name),' ','')||'%')
   or v.specifications::text ilike '%'||trim(target_query)||'%')
$$;
revoke all on function public.public_marketplace_search_listing_ids(text) from public;
grant execute on function public.public_marketplace_search_listing_ids(text) to anon,authenticated;

-- BOQ-ready variants: dimensions are part of the identifier, not estimated quantities.
with variants(product_slug,name,slug,specifications) as(values
 ('high-tensile-reinforcement-bars','8 mm','8mm',jsonb_build_object('diameter_mm',8)),
 ('high-tensile-reinforcement-bars','10 mm','10mm',jsonb_build_object('diameter_mm',10)),
 ('high-tensile-reinforcement-bars','12 mm','12mm',jsonb_build_object('diameter_mm',12)),
 ('high-tensile-reinforcement-bars','16 mm','16mm',jsonb_build_object('diameter_mm',16)),
 ('high-tensile-reinforcement-bars','20 mm','20mm',jsonb_build_object('diameter_mm',20)),
 ('high-tensile-reinforcement-bars','25 mm','25mm',jsonb_build_object('diameter_mm',25)),
 ('concrete-blocks','4 inch','4-inch',jsonb_build_object('width','4 inch')),
 ('concrete-blocks','5 inch','5-inch',jsonb_build_object('width','5 inch')),
 ('concrete-blocks','6 inch','6-inch',jsonb_build_object('width','6 inch'))
), inserted as(
 insert into public.product_variants(product_id,name,slug,specifications)
 select p.id,v.name,v.slug,v.specifications from variants v join public.products p on p.slug=v.product_slug
 on conflict(product_id,slug) do nothing returning id,product_id,name,slug
)
insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data)
select null,'product_variant',i.id::text,'VARIANT_CREATED',jsonb_build_object('product_id',i.product_id,'variant',i.name,'slug',i.slug,'source','catalogue completeness reconciliation') from inserted i;

-- Canonical Nana branch must already exist; never manufacture a location.
do $$ begin
 if not exists(select 1 from public.organisations where id='9b232d45-65f6-4f7d-83d5-d0907f98b4ff' and name='Nana Attakorah II Ventures' and organisation_type='supplier') then raise exception 'Canonical Nana Attakorah II Ventures supplier is unavailable';end if;
 if not exists(select 1 from public.supplier_branches where id='eca78e0f-1054-4c22-9d89-c36eba8d687c' and organisation_id='9b232d45-65f6-4f7d-83d5-d0907f98b4ff' and name='Kwashieman' and is_active) then raise exception 'Canonical active Kwashieman branch is unavailable';end if;
end $$;

-- Move only branchless, evidence-backed legacy drafts when that product/variant
-- does not already exist at Kwashieman.
update public.supplier_listings source set branch_id='eca78e0f-1054-4c22-9d89-c36eba8d687c',warehouse_id=null,updated_at=now()
where source.supplier_id='9b232d45-65f6-4f7d-83d5-d0907f98b4ff' and source.branch_id is null
 and source.product_id in(select id from public.products where slug in('sawn-hardwood-timber','bamboo-construction-poles','high-tensile-reinforcement-bars','binding-wire','corrugated-roofing-sheets','welded-wire-mesh','construction-wheelbarrow','shovels-spades-metal-pans','interior-exterior-paint','pvc-metal-building-fittings','timber-board','plywood','louvre-glass','silicone-sealant'))
 and not exists(select 1 from public.supplier_listings existing where existing.id<>source.id and existing.supplier_id=source.supplier_id and existing.product_id=source.product_id and existing.product_variant_id is not distinct from source.product_variant_id and existing.branch_id='eca78e0f-1054-4c22-9d89-c36eba8d687c' and existing.warehouse_id is null and existing.sku is null);

-- Field-observed product families are draft/enquiry-only when absent.
with evidence(product_slug) as(values('sawn-hardwood-timber'),('bamboo-construction-poles'),('high-tensile-reinforcement-bars'),('binding-wire'),('corrugated-roofing-sheets'),('welded-wire-mesh'),('construction-wheelbarrow'),('shovels-spades-metal-pans'),('interior-exterior-paint'),('pvc-metal-building-fittings')),
inserted as(
 insert into public.supplier_listings(supplier_id,product_id,product_variant_id,price,stock_quantity,stock_status,inventory_mode,is_active,listing_status,branch_id,warehouse_id,delivery_available,pickup_available,supplier_notes)
 select '9b232d45-65f6-4f7d-83d5-d0907f98b4ff',p.id,null,null,null,'confirmation_required','confirmation_required',false,'draft','eca78e0f-1054-4c22-9d89-c36eba8d687c',null,true,true,'Field-observed on 8 August 2026. Supplier must confirm specification, current price and stock before publication.'
 from evidence e join public.products p on p.slug=e.product_slug
 where not exists(select 1 from public.supplier_listings l where l.supplier_id='9b232d45-65f6-4f7d-83d5-d0907f98b4ff' and l.product_id=p.id and l.product_variant_id is null and l.branch_id='eca78e0f-1054-4c22-9d89-c36eba8d687c' and l.warehouse_id is null and l.sku is null)
 returning id,product_id,branch_id
)
insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data)
select null,'supplier_listing',i.id::text,'SUPPLIER_LISTING_CREATED',jsonb_build_object('supplier_id','9b232d45-65f6-4f7d-83d5-d0907f98b4ff','product_id',i.product_id,'branch_id',i.branch_id,'status','draft','evidence','field observed 2026-08-08','reason','NANA_CATALOGUE_EXPANSION') from inserted i;

-- Seven invoice-supported entries retain their approved field prices. Existing
-- listings are never overwritten, so subsequent supplier corrections win.
with approved(product_slug,variant_slug,price) as(values
 ('sawn-hardwood-timber','dahoma-2x6',160::numeric),('sawn-hardwood-timber','esa-2x6',135::numeric),
 ('timber-board','wawa-board',220::numeric),('plywood','three-quarter-inch',320::numeric),
 ('louvre-glass','plain',12::numeric),('louvre-glass','tinted',15::numeric),('silicone-sealant',null,25::numeric)
), resolved as(
 select p.id product_id,v.id variant_id,a.price from approved a join public.products p on p.slug=a.product_slug left join public.product_variants v on v.product_id=p.id and v.slug=a.variant_slug
), inserted as(
 insert into public.supplier_listings(supplier_id,product_id,product_variant_id,price,currency,price_effective_date,price_source,price_source_reference,stock_quantity,stock_status,inventory_mode,is_active,listing_status,branch_id,warehouse_id,delivery_available,pickup_available,supplier_notes)
 select '9b232d45-65f6-4f7d-83d5-d0907f98b4ff',r.product_id,r.variant_id,r.price,'GHS','2026-08-08','field/supplier price sheet','Nana Attakorah III invoice 0000931',null,'confirmation_required','confirmation_required',false,'draft','eca78e0f-1054-4c22-9d89-c36eba8d687c',null,true,true,'Invoice-supported field price. Supplier must confirm current stock before publication.'
 from resolved r where not exists(select 1 from public.supplier_listings l where l.supplier_id='9b232d45-65f6-4f7d-83d5-d0907f98b4ff' and l.product_id=r.product_id and l.product_variant_id is not distinct from r.variant_id and l.branch_id='eca78e0f-1054-4c22-9d89-c36eba8d687c' and l.warehouse_id is null and l.sku is null)
 returning id,product_id,product_variant_id,branch_id,price
)
insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data)
select null,'supplier_listing',i.id::text,'NANA_CATALOGUE_EXPANSION',jsonb_build_object('supplier_id','9b232d45-65f6-4f7d-83d5-d0907f98b4ff','product_id',i.product_id,'variant_id',i.product_variant_id,'branch_id',i.branch_id,'price',i.price,'stock',null,'status','draft','source','invoice 0000931') from inserted i;

-- Summary event is idempotent and records the approval boundary.
insert into public.audit_logs(actor_id,entity_type,entity_id,action,after_data)
select null,'supplier_catalogue','9b232d45-65f6-4f7d-83d5-d0907f98b4ff','NANA_CATALOGUE_EXPANSION',jsonb_build_object('branch_id','eca78e0f-1054-4c22-9d89-c36eba8d687c','evidence_policy','confirmed or field observed only','publication','none','stock_fabricated',false,'prices_fabricated',false,'migration','202608220071')
where not exists(select 1 from public.audit_logs where entity_type='supplier_catalogue' and entity_id='9b232d45-65f6-4f7d-83d5-d0907f98b4ff' and action='NANA_CATALOGUE_EXPANSION' and after_data->>'migration'='202608220071');

commit;
