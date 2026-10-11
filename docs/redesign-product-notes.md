# Single-product detail redesign — 2026-10-11

- `cafe24/product/detail.html` keeps Cafe24 modules, directives, purchase actions and `{$product_detail}`. No price or delivery condition is hardcoded. The one deliberate platform-template repair is documented below.
- Removed the unconnected daily countdown, stock/view counters and first-order promotion. Purchase copy uses 500 mg × 60 tablets, one tablet once daily, and octacosanol 40 mg as supplied.
- The approved administrator detail content now precedes native reviews, Q&A and delivery/exchange information. Four simple anchors provide direct navigation; no synthetic tabs or buying script is added.
- `docs/redesign-product.css` is the product CSS fragment to integrate into global `onroad.css`. It is scoped to `#contents .pd-minimal` / `.pd-minimal-additional`, with scoped `!important` declarations to override the legacy product layer while keeping account/cart/journal compatibility styles. It does not modify platform CSS. The final `#pdPurchase .displaynone` rule preserves Cafe24 visibility flags.
- Root should remove the old `onroad-brand.js` docking/min-height observer, scroll transforms, and curated-gallery review injection. Keep navigation and the guest-purchase fallback. Product metadata/sessionStorage handoff remains in detail.html for the existing login page.
- Native `product_image` and `Product_mobileImage` stay untouched. Mobile preview needs a real Cafe24 render to verify swipe duplication rules. Check desktop main image/thumbnail, mobile swipe, quantity changes, dynamic total, cart, direct purchase, sold-out classes, and native reviews/Q&A after deployment.
- Product layout is a 55:45 media/information grid with a 1280px maximum, a narrower split at tablet width, and a single column below 768px. The total-products row reflows for narrow columns; native button handlers are preserved.
- No extra product categories, recommended products, related-product section, countdown, or floating purchase panel were added.
- Before the functional repair below, all 242 template-variable occurrences, 20 module occurrences and 11 Cafe24 directives matched the original multisets exactly. After repair, all 20 modules and 11 directives still match; the variable differences are intentional and listed below. Inline JavaScript parses successfully; the removed countdown code was the only JavaScript deletion.

## Existing quantity/total defect repaired

The parent observed the old live page showing 0 won / 2 items with quantity 1 and no quantity buttons. The old `cafe24/product/detail.html` had two quantity rows, no increment/decrement controls in the total-products block, and `{$price}` without Cafe24's `{$total.quantity_price}` calculation hook. `skin9/product/detail.html`, `cafe24/product/basket_option.html` and `cafe24/product/image_zoom.html` all contain the working platform pattern.

Restored the total-products container's `{$total.total_id}`, kept the single `{$quantity_display|display}` tbody, added native up/down anchors using the supplied handler classes, and restored `<span class="{$total.quantity_price}">{$product_price}</span>`. Dynamic option rows remain Cafe24's responsibility. No custom price calculation or purchase handler was introduced.

Expected variable occurrence differences from the original:

| Variable | Difference | Reason |
|---|---:|---|
| `{$total.total_id}` | +1 | Native total-products container ID |
| `{$total.quantity_price}` | +1 | Native line-price calculation hook |
| `{$product_price}` | +1 | Actual product price instead of unresolved generic price |
| `{$quantity_up_class}` | +1 | Native quantity increment handler |
| `{$quantity_down_class}` | +1 | Native quantity decrement handler |
| `{$price}` | -2 | Replaced incorrect unbound line-price cells |
| `{$quantity}` | -1 | Removed duplicate quantity row |
| `{$option_display|display}` | -1 | Removed duplicate placeholder option row |
| `{$product_name}` | -1 | Removed duplicate placeholder option row |

Live verification must check starting quantity 1 / actual product price, increment to 2 / doubled price, decrement to 1, and cart total. This repair is supported by the existing same-platform templates; production runtime verification is still required.
