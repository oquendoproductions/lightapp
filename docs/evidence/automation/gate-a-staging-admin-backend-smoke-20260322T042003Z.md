# Gate A Staging Admin Backend Smoke (Post-Fix)

Generated: 2026-03-22 04:20:04 UTC
Project: madjklbsdwbtrqhpxmfs (staging)

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

 id  |               light_id               | action |          created_at           
-----+--------------------------------------+--------+-------------------------------
 187 | b5468bfd-6d38-4160-b790-898c0dec46ae | fix    | 2026-03-22 04:20:39.515484+00
(1 row)

INSERT 0 1
 id  |               light_id               | action |          created_at           
-----+--------------------------------------+--------+-------------------------------
 188 | b5468bfd-6d38-4160-b790-898c0dec46ae | reopen | 2026-03-22 04:20:39.515484+00
(1 row)

INSERT 0 1
 export_detail_rows 
--------------------
                691
(1 row)

 export_summary_rows 
---------------------
                 424
(1 row)

ROLLBACK
```
