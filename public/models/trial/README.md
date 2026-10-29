# Shared trial furniture GLBs

Drop the seven *optimized* .glb files directly into this folder (not the zip and not the original large files):

- office-chair.glb
- seat.glb
- dining-table.glb
- conference-table.glb
- white-seat.glb
- couch.glb
- bed.glb

These files are served as `/models/trial/{filename}` on every device once deployed. The planner verifies each file exists before using it, falling back to models saved in the current browser when a shared asset is absent. Trial uploads created via the UI remain browser-local.

This folder is for temporary testing; replace with a dedicated asset service before introducing a large public catalogue.
