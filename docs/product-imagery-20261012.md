# Product imagery — 2026-10-12

The home page now uses four newly rendered scenes. Only the original, dimensionally accurate carton model and generic geometry helpers were reused; cameras, sets, props, lighting and composition were rebuilt for this page.

| Placement | Asset | Web dimensions |
|---|---|---|
| First-screen product | `editorial-hero-20261012.jpg` | 1800 × 1800 |
| Intake guide | `editorial-daily-20261012.jpg` | 1600 × 1760 |
| Desktop closing banner | `editorial-closing-wide-20261012.jpg` | 2800 × 1050 |
| Mobile closing banner | `editorial-closing-mobile-20261012.jpg` | 1200 × 1650 |

All files live in `cafe24/SkinImg/img/onroad-2026/`. Each JPEG is a resized, optimized export of a new 16-bit PNG, rather than an edit of an old finished picture. The mobile closing banner has a separate camera and reserved upper space for the real HTML copy. The invalid nested `<picture>` in that section was replaced with one responsive picture element.

## Production and retained source

Blender 4.2.20 / Cycles, 256 samples with adaptive sampling and denoising. Perspective cameras, procedural environment materials and real geometry for the glass, water, porcelain coaster, aluminium disc and paper plane. Product, props, contact shadows, reflections and refraction are rendered in the same scene. No photographic or generated background compositing. The original six print textures and the 67 × 52 × 105 mm carton dimensions are preserved. Staging props are not product contents.

Full editable `.blend` scenes with packed print textures, source scripts, original PNGs, delivery JPEGs, scene audits and a contact sheet are saved locally at:

`D:\온로드\제품이미지_결과물\2026-10-12_웹사이트_에디토리얼렌더`

The original carton master is unchanged. Its copied source is checked against the master by SHA256 before packaging. `asset-manifest.json` in that folder records all image sizes and delivery hashes. `backup-before/` retains the previous homepage HTML and its four images; the old versioned website assets also remain in Git and on the server.

## Validation

- Inspected trial and full-size renders; corrected a staging intersection and adjusted mobile placement.
- Desktop and 390px local previews: all three rendered image elements load, mobile selects its dedicated closing image, and there is no horizontal overflow.
- `node tools/verify-onroad-design.mjs`: native variables, modules, directives and actions remain intact; compiled CSS matches source and all image/page links exist.
- `git diff --check`: passed.

Live deployment and final screenshots are verified after the normal backup-before-write Cafe24 workflow completes. Product record gallery images and the existing product detail artwork are outside this home-image change.
