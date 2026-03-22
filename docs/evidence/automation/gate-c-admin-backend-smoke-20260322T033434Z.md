# Gate C Admin Backend Smoke (Production, Post-Fix)

Generated: 2026-03-22 03:34:35 UTC
Project: gjainmoiudfjsmhhvtiz (production)

## Probe Output

```text
BEGIN
                              set_config                               
-----------------------------------------------------------------------
 {"role":"authenticated","sub":"13e2427c-18d8-4422-bf28-dc8a59808fb4"}
(1 row)

            set_config            
----------------------------------
 {"x-tenant-key":"ashtabulacity"}
(1 row)

SET
   role_user   |               auth_uid               | resolved_tenant 
---------------+--------------------------------------+-----------------
 authenticated | 13e2427c-18d8-4422-bf28-dc8a59808fb4 | ashtabulacity
(1 row)

             incident_id              
--------------------------------------
 1d7aab85-f649-4acb-80e7-400b8fc4f9c9
(1 row)

 id  |               light_id               | action |          created_at           
-----+--------------------------------------+--------+-------------------------------
 170 | 1d7aab85-f649-4acb-80e7-400b8fc4f9c9 | fix    | 2026-03-22 03:34:34.437473+00
(1 row)

INSERT 0 1
             incident_id              | state |        last_changed_at        
--------------------------------------+-------+-------------------------------
 1d7aab85-f649-4acb-80e7-400b8fc4f9c9 | fixed | 2026-03-22 03:34:34.437473+00
(1 row)

 id  |               light_id               | action |          created_at           
-----+--------------------------------------+--------+-------------------------------
 171 | 1d7aab85-f649-4acb-80e7-400b8fc4f9c9 | reopen | 2026-03-22 03:34:34.437473+00
(1 row)

INSERT 0 1
             incident_id              |  state   |        last_changed_at        
--------------------------------------+----------+-------------------------------
 1d7aab85-f649-4acb-80e7-400b8fc4f9c9 | reopened | 2026-03-22 03:34:34.437473+00
(1 row)

 export_detail_rows 
--------------------
                586
(1 row)

 export_summary_rows 
---------------------
                 342
(1 row)

ROLLBACK
```
