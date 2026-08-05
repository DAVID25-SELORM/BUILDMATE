-- Preserve public catalogue reads while keeping catalogue mutations permission-scoped.
-- An ALL policy is also evaluated for SELECT and caused anonymous reads to invoke
-- the intentionally private admin_has_permission function.
drop policy if exists "catalogue scoped categories" on public.categories;
drop policy if exists "catalogue scoped brands" on public.brands;
drop policy if exists "catalogue scoped products" on public.products;

create policy "catalogue scoped categories insert" on public.categories for insert to authenticated with check(public.admin_has_permission('catalogue'));
create policy "catalogue scoped categories update" on public.categories for update to authenticated using(public.admin_has_permission('catalogue')) with check(public.admin_has_permission('catalogue'));
create policy "catalogue scoped categories delete" on public.categories for delete to authenticated using(public.admin_has_permission('catalogue'));
create policy "catalogue scoped brands insert" on public.brands for insert to authenticated with check(public.admin_has_permission('catalogue'));
create policy "catalogue scoped brands update" on public.brands for update to authenticated using(public.admin_has_permission('catalogue')) with check(public.admin_has_permission('catalogue'));
create policy "catalogue scoped brands delete" on public.brands for delete to authenticated using(public.admin_has_permission('catalogue'));
create policy "catalogue scoped products insert" on public.products for insert to authenticated with check(public.admin_has_permission('catalogue'));
create policy "catalogue scoped products update" on public.products for update to authenticated using(public.admin_has_permission('catalogue')) with check(public.admin_has_permission('catalogue'));
create policy "catalogue scoped products delete" on public.products for delete to authenticated using(public.admin_has_permission('catalogue'));
