# Generic editor wording audit

The requested Japanese game-specific shorthand is absent from the current tracked and untracked publication-source tree (UTF-8 text scan). Public documentation, provenance paths, and the source-export CLI help now use generic source-root descriptions. Geometry, resource GUIDs, and asset hashes were not changed. Game-project files and Git history were not edited.

Compatibility exceptions: the existing browser directory-picker ID, serialized asset keys, C# namespace and reflection type/assembly names, linker entries, and the original-source test setup path remain unchanged. These are machine-facing compatibility references, not user-facing editor names. Renaming them would break existing integration or remembered folder access. New user-facing wording must remain generic.

The static review record identifies the URP package version without a workstation-specific path. Original local history and evidence remain available.
