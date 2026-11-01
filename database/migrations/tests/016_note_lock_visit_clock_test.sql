\set ON_ERROR_STOP 0
\set QUIET 1
create table t_pn2 (id uuid primary key default gen_random_uuid(), note_id uuid not null references progress_notes(id), txt text);
select nc_attach_note_guard('t_pn2');
insert into organizations(id,name,slug) values ('00000000-0000-0000-0000-0000000000a1','Org','org') on conflict do nothing;
insert into users(id,org_id,email,hashed_password,role) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','cm@x','x','clinician'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1','tl@x','x','team_lead'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000a1','sup@x','x','supervisor'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000a1','adm@x','x','admin');
insert into clients(id,org_id,first_name,last_name) values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','A','B');
insert into visits(id,org_id,client_id,cm_id) values
 ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000001');
insert into progress_notes(id,visit_id,org_id,cm_id,client_id) values
 ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1');
\echo -- 1 start clock ok
select nc_start_clock('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000001',null,null,null,now(),0,gen_random_uuid()) is not null as ok;
\echo -- 2 second clock for same user refused
select nc_start_clock('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-000000000001',null,null,null,now(),0,gen_random_uuid());
\echo -- 3 stop without camera refused
select nc_stop_clock('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000001',null,null,null,'h1',null,false,now(),0,gen_random_uuid());
\echo -- 4 stop with camera ok
select nc_stop_clock('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000001',null,null,null,repeat('a',64),'k',true,now(),0,gen_random_uuid()) is not null as ok;
select credited_minutes, closed_correctly, submit_due_at is not null as due from progress_notes where id='00000000-0000-0000-0000-0000000000b1';
\echo -- 5 time edit direct refused
update visits set photo_taken_at = photo_taken_at + interval '1 hour' where id='00000000-0000-0000-0000-0000000000f1';
\echo -- 6 draft write by author ok, by other refused
begin; select set_config('nc.user_id','00000000-0000-0000-0000-000000000001',true); insert into t_pn2(note_id,txt) values ('00000000-0000-0000-0000-0000000000b1','hello'); commit;
begin; select set_config('nc.user_id','00000000-0000-0000-0000-000000000002',true); insert into t_pn2(note_id,txt) values ('00000000-0000-0000-0000-0000000000b1','x'); commit;
select count(*) as audit_rows from field_audit;
\echo -- 7 submit locks
select nc_submit_note('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000001',null,null,null,now(),0,gen_random_uuid()) is not null as ok;
select lock_state, submitted_late from progress_notes where id='00000000-0000-0000-0000-0000000000b1';
\echo -- 8 write after lock refused (author, and SOAP column)
begin; select set_config('nc.user_id','00000000-0000-0000-0000-000000000001',true); update t_pn2 set txt='changed'; commit;
update progress_notes set section_s='sneaky' where id='00000000-0000-0000-0000-0000000000b1';
\echo -- 9 author reopen refused, supervisor-less team lead ok
select nc_reopen_note('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000001','oops');
select nc_reopen_note('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000002','accidental submit') is not null as ok;
select lock_state from progress_notes where id='00000000-0000-0000-0000-0000000000b1';
\echo -- 10 edit while reopened by author ok; time still frozen; resubmit
begin; select set_config('nc.user_id','00000000-0000-0000-0000-000000000001',true); update t_pn2 set txt='fixed'; commit;
update visits set hipaa_signed_at = now() where id='00000000-0000-0000-0000-0000000000f1';
select nc_submit_note('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000001',null,null,null,now(),0,gen_random_uuid()) is not null as ok;
select lock_state from progress_notes where id='00000000-0000-0000-0000-0000000000b1';
select reopened_by is not null and resubmitted_at is not null as reopen_closed from note_reopens;
\echo -- 11 addendum: team lead time change refused, plain ok, supervisor time ok after countersign by admin
insert into capture_events(org_id,user_id,kind,note_id) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002','addendum_signature','00000000-0000-0000-0000-0000000000b1');
select nc_add_addendum('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000002','time','[]',(select id from capture_events where kind='addendum_signature' limit 1), now()-interval '2 hours', null);
select nc_add_addendum('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000002','typo','[{"field":"txt"}]',(select id from capture_events where kind='addendum_signature' limit 1)) is not null as plain_ok;
insert into capture_events(org_id,user_id,kind,note_id) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000003','addendum_signature','00000000-0000-0000-0000-0000000000b1');
select nc_add_addendum('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000003','extend','[]',(select id from capture_events where user_id='00000000-0000-0000-0000-000000000003' limit 1), (select hipaa_signed_at from visits where id='00000000-0000-0000-0000-0000000000f1') - interval '30 minutes', null) is not null as time_ok;
\echo -- 12 own addendum countersign refused; admin countersign applies the time change
select nc_countersign_addendum((select id from note_addenda where changes_time), '00000000-0000-0000-0000-000000000003');
select nc_countersign_addendum((select id from note_addenda where changes_time), '00000000-0000-0000-0000-000000000004');
select credited_minutes from progress_notes where id='00000000-0000-0000-0000-0000000000b1';
\echo -- 13 append-only
update capture_events set kind='hipaa_signature';
delete from field_audit;
\echo -- 14 same photo hash on another visit refused
insert into capture_events(org_id,user_id,kind,photo_hash,camera_only) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','end_photo',repeat('a',64),true);
\echo -- 15 laptop rules
update users set progress_note_security='both' where id='00000000-0000-0000-0000-000000000002';
select nc_register_device('00000000-0000-0000-0000-000000000002','laptop','L1','x');
update users set progress_note_security='both' where id='00000000-0000-0000-0000-000000000001';
select nc_register_device('00000000-0000-0000-0000-000000000001','laptop','L1','x') as dev \gset
select nc_approve_device(:'dev','00000000-0000-0000-0000-000000000002');
select nc_approve_device(:'dev','00000000-0000-0000-0000-000000000003');
select status from devices where id=:'dev';
