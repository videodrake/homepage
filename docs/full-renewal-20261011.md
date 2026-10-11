# Onroad full-store renewal — 2026-10-11

The existing `videodrake/homepage` repository remains the source of truth for the Cafe24 storefront at `onroad.zenera.kr`. The corporate site at `zenera.kr` is separate.

## Published asset sources

The new photographs are existing, unedited JPG exports from `D:\온로드\제품이미지_결과물\2026-10-09_전체3D렌더_v2\jpg`. They supersede the previous AI/composite store images.

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

## Verification

Before deployment, all changed HTML templates were checked against the baseline for exact preservation of variables, modules, directives, and inline action handlers. The CSS braces balance. Local preview validates design only; price, quantity, account visibility, cart, and guest checkout must be checked on Cafe24 after deployment.
