# Instructional Assets

The humanoid geometry, skeleton, weights, and morph targets in `makehuman/` are
MakeHuman bundled assets, released under CC0. The exact source revision is in
`makehuman/revision.txt`; upstream license statements are retained beside them.
Source: https://github.com/makehumancommunity/makehuman.

`build-model.mjs` is Rhino-authored export code, not copied MakeHuman program
logic. It extracts the body mesh (excluding helper geometry), applies the bundled
adult male/muscular targets, builds the weighted skeleton, and exports eleven
authored keyframe clips to `public/models/rhino-anatomy.glb`.

Regenerate with `node assets-source/build-model.mjs`. The GLB is approximately
2.36 MB before HTTP compression, with 13,380 vertices and 26,756 triangles.
Regenerate the static phase posters with `node assets-source/build-posters.mjs`.
The complete source/output SHA-256 inventory is `manifest.json`.
No runtime CDN or third-party model request is required.

Catalog 1.1.0 adds dumbbell curl, triceps kickback, lateral raise, bent-over row
and calf raise to the original six movements. Upper-arm masks use the bind-pose
shoulder-to-elbow axis: proximal deltoid, anterior biceps and posterior triceps.
Four vertex-mask channels carry regions 1-10. Exercise metadata chooses regions;
push and pull movements no longer share an undifferentiated arm mask. Calf masks
cover the posterior lower leg, not the shin. New hinged poses anchor both feet;
the toe-rise pose keeps forefoot contact while raising the heel.

The exporter samples 33 poses per clip and stores full-motion body/region bounds
in GLB extras. Runtime perspective fitting uses these bounds plus equipment
allowance at the current aspect ratio, without skinning every vertex per frame.
Poster exports use the same viewer; posterior-focused movements open at the rear.
Detail framing retains the current front/side/rear direction.
Technical tests check mask locations, moving tracks, clip/poster completeness,
sampled bounds and front/side/rear framing at narrow and wide aspect ratios.

The muscle highlights are approximate surface regions, not individually segmented
anatomical tissue or measured activation. The movement clips are illustrative;
no professional coaching or clinical review has been obtained. The UI must retain
this limitation. Automated rendering tests and technical visual inspection cannot
be reported as a qualified movement review.

No purchased assets are included. The MakeHuman program's AGPL license does not
replace its separately stated CC0 bundled-asset license; see `makehuman/LICENSE.md`.
