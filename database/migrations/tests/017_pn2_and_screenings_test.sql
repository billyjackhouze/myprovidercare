\set QUIET 1
\echo -- setup: reuse 016 test fixtures (org, users, note b1 on visit f1 already locked) -> make a fresh draft note
insert into visits(id,org_id,client_id,cm_id) values ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000001');
insert into progress_notes(id,visit_id,org_id,cm_id,client_id,note_type) values ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','PN2');
begin; select set_config('nc.user_id','00000000-0000-0000-0000-000000000001',true) \gset
\echo -- 1 author fills PN2 + screenings in draft
insert into pn2_data(note_id,org_id,service_location,focus_therapy,current_status) values ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000a1','Home',true,'stable');
insert into pn2_medications(note_id,row_no,name,dosage) values ('00000000-0000-0000-0000-0000000000b3',1,'Lithium','300mg');
insert into screening_phq9(note_id,org_id,q1_interest,q2_depressed,q9_self_harm_thoughts,difficulty) values ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000a1',2,3,1,'very');
insert into screening_broset(note_id,org_id,confused,verbal_threats) values ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000a1',true,true);
insert into screening_fall_risk(note_id,org_id,age_70_79,fall_within_6mo,mob_unsteady,cog_impulsive) values ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000a1',true,true,true,true);
insert into screening_columbia(note_id,org_id,q1_wish_dead,q2_suicidal_thoughts) values ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000a1',true,false);
commit;
\echo -- 2 generated totals: phq9=6 mild q9 true; broset=2 moderate; fall=2+5+2+2=11 moderate; columbia any_yes t
select total_score, severity, q9_positive from screening_phq9;
select total_score, risk_band from screening_broset;
select total_score, risk_band from screening_fall_risk;
select any_yes from screening_columbia;
\echo -- 3 single-select CHECK refuses two ages
begin; select set_config('nc.user_id','00000000-0000-0000-0000-000000000001',true) \gset
update screening_fall_risk set age_60_69=true;
rollback;
\echo -- 4 audit rows exist and none are for generated columns
select count(*) > 0 as has_audit, count(*) filter (where field_name in ('total_score','risk_band','severity','q9_positive','any_yes')) as generated_noise from field_audit where note_id='00000000-0000-0000-0000-0000000000b3';
\echo -- 5 another user cannot write
begin; select set_config('nc.user_id','00000000-0000-0000-0000-000000000002',true) \gset
update screening_phq9 set q1_interest=0;
rollback;
\echo -- 6 close the contact, submit => lock; then every table refuses writes
select nc_start_clock('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-000000000001',null,null,null,now(),0,gen_random_uuid()) is not null as clock;
select nc_stop_clock('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-000000000001',null,null,null,repeat('c',64),'k',true,now(),0,gen_random_uuid()) is not null as stopped;
select nc_submit_note('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-000000000001',null,null,null,now(),0,gen_random_uuid()) is not null as submitted;
begin; select set_config('nc.user_id','00000000-0000-0000-0000-000000000001',true) \gset
update pn2_data set current_status='changed';
rollback;
begin; select set_config('nc.user_id','00000000-0000-0000-0000-000000000001',true) \gset
update screening_phq9 set q1_interest=0;
rollback;
begin; select set_config('nc.user_id','00000000-0000-0000-0000-000000000001',true) \gset
delete from screening_broset;
rollback;
begin; select set_config('nc.user_id','00000000-0000-0000-0000-000000000001',true) \gset
insert into pn2_medications(note_id,row_no,name) values ('00000000-0000-0000-0000-0000000000b3',2,'x');
rollback;
\echo -- 7 reopen by team lead, author fixes screening, totals recompute, resubmit
select nc_reopen_note('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-000000000002','accidental') is not null as reopened;
begin; select set_config('nc.user_id','00000000-0000-0000-0000-000000000001',true) \gset
update screening_phq9 set q2_depressed=0;
commit;
select total_score, severity from screening_phq9;
