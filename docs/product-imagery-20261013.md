# Product imagery — 2026-10-13

The four home-page images were re-rendered from scratch. The 10/12 set read as computer-generated: flat single-colour world light, a 'Standard' view transform, primitive props and dark, mirror-less glass. This set is the home-page subset of a larger render library made for reuse in SNS, banners and ads.

| Placement | Asset | Web dimensions | Scene |
|---|---|---|---|
| First-screen product | `onroad-hero-20261013.jpg` | 1800 × 1800 | Carton on a limestone plinth, low morning window sun, leaf shadows on limewash plaster (close camera so the carton reads at the 640 px hero size) |
| Intake guide | `onroad-daily-20261013.jpg` | 1600 × 1760 | Carton, glass of water with sunlit caustics, a PTP card with one cell taken, one tablet, linen on oak |
| Desktop closing banner | `onroad-closing-wide-20261013.jpg` | 2800 × 1050 | Opened carton on deep navy with six PTP cards stepping out (60 tablets = 60 days); copy side kept dark |
| Mobile closing banner | `onroad-closing-mobile-20261013.jpg` | 1200 × 1650 | Same set from a separate camera; upper area kept clear for the HTML copy |

All files live in `cafe24/SkinImg/img/onroad-2026/`; the 10/12 files stay in place as the previous version. Each image keeps the pixel size of the image it replaces, so the existing `width`/`height` attributes and CSS crops are unchanged.

## Production

- Blender 4.2.20 / Cycles (OptiX), 640 samples with adaptive sampling and OpenImageDenoise, Khronos PBR Neutral view transform so the printed navy and orange stay close to the artwork.
- Product, set, props and lights are rendered in one perspective scene: no photographic/generated background and no product compositing. Post-processing is whole-frame only: gentle tone, vignette, grain and resize.
- The carton uses the unchanged master v1 print textures (2025-11-04 artwork, 67 × 52 × 105 mm). Its surface follows the print spec's full matte lamination.
- The opened carton follows the dieline: the lid is hinged at the front top edge, with tuck and dust flaps.
- Tablets (15.0 × 7.3 × 5.2 mm) and PTP cards (61 × 93 mm, 2 × 5) were modelled from the owner's product photos.
- Glass, water, linen, plinth and leaves are staging props, not product contents.
- Scanned materials and lighting are CC0 Poly Haven assets, downloaded with the owner's approval. MD5/SHA256 are recorded in the library's `assets/polyhaven/polyhaven_manifest.json`.

Full library (22 scenes in five looks, 25 images: 16-bit PNG renders, graded JPEGs, cut-outs, editable `.blend` scenes, scripts, gallery):

`D:\온로드\제품이미지_결과물\2026-10-13_렌더라이브러리`

## Validation

- Inspected previews and full-size renders at 100%:
  - print legibility and colour against the master texture;
  - PTP and tablet detail against the reference photos;
  - no intersections. Props rest on the cloth by ray cast, and foil glare was checked.
- Crop check against the CSS breakpoints in `onroad.css`:
  - hero 1:1 and 5:4;
  - daily 1:1.06 and 1.1:1;
  - closing 768/1100/1440/1920/2560 × 400–440;
  - mobile 320/390/767 × 650.
  The product stays inside the visible area and clear of the copy block at the common sizes. At 2560 px wide, the lid tip and tablet sit at the crop edge.
- `node tools/verify-onroad-design.mjs` and `git diff --check` after the swap.

The product detail page, its long detail artwork and the product record gallery images are outside this change.
