# Onroad full-store renewal — 2026-10-11

The existing `videodrake/homepage` repository remains the source of truth for the Cafe24 storefront at `onroad.zenera.kr`. The corporate site at `zenera.kr` is separate.

## Published status

The storefront renewal is published and verified on the live store. PRs [#72](https://github.com/videodrake/homepage/pull/72), [#73](https://github.com/videodrake/homepage/pull/73), and [#74](https://github.com/videodrake/homepage/pull/74) are merged. The final deployment of `1c23c304f505131ba4e7e90eda86fe591b8314f0` completed successfully in [run 38124323925](https://github.com/videodrake/homepage/actions/runs/38124323925), job `114425399007`.

Product 11's four replacement images and the confirmed navy/orange detail artwork were saved through product management and verified live. The native SEO title is now `온로드 공식 스토어 | 지구력코어`; the revised description persisted after reopening the settings and was verified live. The front product image was also saved as the social-sharing image, with the administrator's success message confirmed.

Separate existing payment/policy configuration gaps remain open below. No changes were made to those settings.

## Published asset sources

The replacement product images are existing, unedited 3D-render JPG exports from `D:\온로드\제품이미지_결과물\2026-10-09_전체3D렌더_v2\jpg`. They supersede the previous store images.

| Store asset | Source file | Placement |
| --- | --- | --- |
| `product-front-20261009.jpg` | `01_스토어정면_전체3D_2000x2000.jpg` | Home hero, product main/list/cart thumbnails |
| `product-studio-20261009.jpg` | `02_스톤스튜디오_전체3D_2000x2000.jpg` | Product gallery |
| `product-morning-20261009.jpg` | `07_아침테이블_전체3D_1600x2000.jpg` | Home intake section, product gallery |
| `product-track-20261009.jpg` | `08_러닝트랙_전체3D_2000x2000.jpg` | Product gallery |
| `product-detail-20260917.png` | `03_브랜드·디자인\바탕화면\상세페이지 최종.png` | Native product detail, desktop and mobile |

The user explicitly confirmed the navy/orange detail beginning “과학으로 설계된 지구력 지원 솔루션”. Its artwork is used as provided. The three-box image is deliberately omitted because product 11 is a single-box offer.

## Scope

- Replace the accumulated custom stylesheet with `docs/redesign-global.css` + `docs/redesign-product.css` in `cafe24/layout/basic/css/onroad.css`.
- Carry the white product-led design through account, login, agreement, signup, cart, guide, search, and product surfaces.
- Remove unsupported fixed coupon/points promises and the fictional sample journal testimonial.
- Preserve Cafe24 modules, template variables, directives, visibility states, quantity controls, and purchase actions.
- Update product 11 through product management so native image variables and native description render the new assets. Skin deployment alone cannot change those records.
- Keep the existing price, shipping, inventory, options, and payment settings.

## Rollback

The pre-renewal repository archive and product record snapshot are retained in `D:\온로드\쇼핑몰_리디자인_2026-10-11\full-renewal`. The deployment workflow also saves the complete readable `/base/` state and validates all 21 required rollback paths before uploading. See `redesign-deployment.md` for restoration steps. Old image assets remain available.

The downloaded remote backup is `cafe24-base-before-38122029842-1.zip` (57,731,129 bytes). Its SHA-256 matches the Actions artifact digest: `804CB6F8EBF7B1F49992230DD912E4E2C37DE727EB327D2929D338B5146DE68A`. All 668 ZIP entries passed CRC verification, and all 21 required rollback files matched their manifest hashes. `SYMLINKS.json` records 50 omitted platform links without following their targets. The verification record is `full-renewal/backup-verification.json`.

The product record has separate before/after snapshots, `product-11-before.json` and `product-11-after.json`. The skin archive alone does not restore administrator-managed product records or SEO settings; their before-state snapshots are retained alongside it.

## Verification

Before deployment, all changed HTML templates were checked against the baseline for exact preservation of variables, modules, directives, and inline action handlers. The CSS braces balance. The following checks were then completed on the live Cafe24 storefront:

- Home and product pages have no horizontal overflow at 1440, 1024, and 390 pixel viewports.
- Product 11 quantity changes `1 → 2 → 1` produce native totals `37,800 → 75,600 → 37,800 KRW`.
- The existing one-item cart shows `37,800 KRW + 2,500 KRW shipping = 40,300 KRW`. Guest checkout is reachable with that total. No order or payment was submitted.
- The purchase button has background `rgb(23, 27, 25)` and white text. The old zoom-instruction GIF is hidden; the native product-image functionality remains. Selected cart tabs are white with dark text, and no `.displaynone` elements were visibly rendered in the inspected pages.
- The desktop login content is 460 pixels wide; the agreement content is 720 pixels wide and its terms remain unchecked.
- The new product images, detail artwork, title, and description are visible in the live storefront.
- Selecting the second gallery thumbnail switches the main image to its native Cafe24 `extra/big/20261011/cc31e251ff7559d654bd231b81f85886.jpg` asset.

Evidence is retained in `D:\온로드\쇼핑몰_리디자인_2026-10-11\full-renewal`: `live-home-desktop.png`, `live-home-tablet.png`, `live-home-mobile.png`, `live-product-desktop.png`, `live-product-mobile.png`, `live-new-detail.png`, `live-cart-mobile.png`, `live-checkout-mobile.png`, and `live-login-desktop.png`.

Authenticated member order/history views have not been inspected, and actual payment completion has not been tested. These are explicit limits of the verification above.

## Existing operational settings awaiting owner input

The native bank-selection list is empty, the return address is blank, and the terms still contain an `OO회사` placeholder. The owner has been asked whether checkout should be card-only or also offer bank transfer, and for the return address/privacy contact information. These questions are pending. Payment configuration and policy text have not been changed without those answers.
