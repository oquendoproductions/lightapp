# Gate A Staging Guest Submission Probe

Generated: 2026-03-22 03:05:12 UTC
Project: madjklbsdwbtrqhpxmfs (staging)

## Pothole report insert as anon

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
 id  | report_number |          created_at           
-----+---------------+-------------------------------
 108 | PHR0000106    | 2026-03-22 03:05:11.907507+00
(1 row)

INSERT 0 1
ROLLBACK
```

## Water/drain report insert (`public.reports`) as anon

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
ERROR:  new row violates row-level security policy for table "reports"
```
