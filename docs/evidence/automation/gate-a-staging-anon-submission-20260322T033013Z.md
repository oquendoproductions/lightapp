# Gate A Staging Guest Submission Probe (Post-Fix)

Generated: 2026-03-22 03:30:14 UTC
Project: madjklbsdwbtrqhpxmfs (staging)

## Probe Output

```text
BEGIN
   set_config    
-----------------
 {"role":"anon"}
(1 row)

            set_config            
----------------------------------
 {"x-tenant-key":"ashtabulacity"}
(1 row)

SET
 role_user | resolved_tenant 
-----------+-----------------
 anon      | ashtabulacity
(1 row)

SAVEPOINT
INSERT 0 1
ROLLBACK
SAVEPOINT
INSERT 0 1
ROLLBACK
ROLLBACK
```
