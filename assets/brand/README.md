# Rhino Brand Assets

The approved identity is the warm-gray fragmented rhinoceros head with its orange
horn accent. Preserve the entire canvas, proportions, colors and alpha; do not
recolor it to match the application's independent deep-blue accent.

Study: `hexly.ai/artwork/logo-family/rhino/2026-10-09-03`, finishing `02`.
Local source adoption: `2dc90672ddb50eac2d347140823b1ecaa3c577d0`.
[provenance.json](provenance.json) identifies the exact selected master;
the root [logo.png](../../logo.png) SHA-256 matches that record.

## Surface Roles

| Surface | Asset | Treatment |
| --- | --- | --- |
| Chinese and English README | `assets/brand/icon-rounded.png` | Selected presentation at 128 CSS px; no extra mask |
| Expanded/collapsed sidebar and mobile drawer | `public/logo-24.png`, `public/logo-80.png` | Responsive transparent mark at 24 CSS px; same position when collapsed |
| Startup and environment failure | `public/logo-80.png` | Transparent mark at 80 CSS px |
| Browser PNG | `public/favicon.png` | Transparent 64 px foreground |
| Browser ICO | `public/favicon.ico` | Transparent 16/24/32/48/64/128/256 px entries |
| Apple touch | `public/apple-touch-icon.png` | Opaque 180 px square presentation; platform applies its mask |

The root transparent master and both presentation masters are 2048 x 2048.
Small app/browser marks have no background tile, circular crop, shadow or filter.
Use the same foreground on light and dark surfaces. The optional sidebar avatar
is the owner's separate identity, not a substitute for the project mark.

The hosted login belongs to Cloudflare Access; this app does not duplicate or
reconfigure that login. No PWA manifest or native application is currently shipped.
Do not add a social image URL until its actual image response is verified.

## Verification

The supplied derivatives were retained, not regenerated. PNG dimensions, alpha,
opaque touch presentation and all seven embedded ICO images were decoded during
integration. Browser regressions verify loaded marks, unchanged collapse geometry,
mobile navigation, startup, metadata and both themes. The master hash can be
checked with `shasum -a 256 logo.png` from the repository root.

Follow the [shared usage SOP](https://github.com/nocoo/hexly.ai/blob/main/docs/07-logo-usage-sop.md)
for future derivatives. Keep original generation and finishing archives in Hexly;
this local integration does not imply source publication or deployment.
