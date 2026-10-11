# Onroad storefront redesign deployment — 2026-10-11

The storefront is `https://onroad.zenera.kr/`. Its active design is Cafe24 `/base/`.
The corporate website at `https://zenera.kr/` and the inactive `/skin9/` design are separate.
This document supersedes the old whole-directory mirror and deletion instructions in `DEPLOY.md` for this redesign.

## Backups and deployment boundaries

- A local pre-edit repository archive is kept outside the repository in `D:\온로드\쇼핑몰_리디자인_2026-10-11`.
- Before each deployment, the workflow downloads the current remote `/base/` design. Five known unreadable Cafe24 managed files are excluded explicitly; none is in the upload scope.
- Any other download failure stops the job. All 21 existing templates, styles, and scripts that will be overwritten must have nonempty rollback copies, including the six member/account templates, store guide, and journal page added for the full-store renewal.
- A deployment target or any parent directory that is a symbolic link fails validation. Other downloaded platform symbolic links are recorded as relative paths and original targets in `SYMLINKS.json`, then only those local links are removed. The scan does not follow links; this prevents the artifact uploader from traversing outside the backup into the runner filesystem. Remote links and files are unchanged.
- `DEPLOY_MANIFEST.json` records every uploaded path, new file hash, whether it existed before deployment, and the old file hash.
- The backup is stored as the GitHub Actions artifact `cafe24-base-before-<run ID>-<attempt>`, with a requested retention of 90 days. Its upload must succeed before the live upload step can run. Download an enduring local copy before the artifact expires.
- Uploads come from a staging directory containing only the following paths. There are no remote delete commands, broad whole-skin uploads, or changes to permissions.

```text
index.html
layout/basic/main.html
layout/basic/layout.html
layout/basic/header.html
layout/basic/footer.html
layout/basic/css/onroad.css
layout/basic/js/onroad-brand.js
product/detail.html
shopinfo/company.html
shopinfo/ingredient-science.html
shopinfo/intake-guide.html
shopinfo/health-functional.html
shopinfo/endurance-core.html
shopinfo/guide.html
journal/post.html
member/login.html
member/agreement.html
member/join.html
member/join_result.html
member/modify.html
myshop/index.html
SkinImg/img/onroad-2026/*                    (new product design assets)
```

Cart, payment, and order templates, customer/order records, products/prices, platform settings, and DNS are outside the write scope. The listed member/account templates receive presentation changes while preserving Cafe24 modules, variables, directives, and action handlers. Shared header, footer, and CSS also change the appearance of pages outside the template list. A file outside this manifest requires an explicit workflow scope change before it can be deployed.

Product records are separate from the skin backup. Before changing product 11 in the product manager, preserve its image slots, additional-image order, PC description HTML, and any separate mobile description HTML. Updating `/SkinImg/img/` alone does not update the native product, search, or cart images. Keep the original image variables and `{$product_detail}` in the templates; change their content through product management. Do not use the Cafe24 Smart Design editor.

## Running and checking

1. Commit the reviewed design, workflow, and this document on a feature branch. Use the existing PR-to-main process; do not force-push.
2. A main push automatically performs backup → artifact save → scoped upload. A manual run with `dry_run: true` performs staging, remote reads, backup validation, and artifact save only. It makes no remote files, directories, deletions, or permission changes.
3. If backup or artifact save fails, resolve that failure before retrying. Never bypass the backup gate to make deployment pass.
4. Check the completed workflow, then review storefront home/product/mobile navigation, actual price and quantity selection, cart, login, signup forms, and the account dashboard. Verify native hidden/disabled states, unsupported social-login buttons, guest-purchase availability, accordion and option-layer behavior, and empty versus populated order views. Stop before placing an order or submitting a real signup/profile change. The local preview does not execute Cafe24's purchase runtime and cannot validate checkout behavior.

Local visual preview:

```powershell
node tools/preview-cafe24-skin.mjs cafe24 4173
```

It expands Cafe24 layout/import/CSS directives and runs the standalone Onroad design script. Platform-generated variables and purchase modules need the live storefront for verification.

## Restore the previous design

1. Download the artifact from the specific deployment run and extract it into a new local directory. Its `base/` folder contains the pre-deployment design; `DEPLOY_MANIFEST.json` identifies precisely which paths this run touched. `SYMLINKS.json` inventories platform links omitted from the archive; do not recreate those links when restoring the scoped design files.
2. Compare the manifest's `rollback_sha256` values with the downloaded files before restore. Stop if an expected file is missing or differs.
3. Make a separate restore staging directory. Copy **only** entries with `existed_before_deploy: true` from the artifact's `base/` into that directory, preserving their relative paths. Do not upload the artifact metadata or blindly mirror the full backup over current platform files.
4. Back up the current remote copies of those same files again, then upload the restore staging directory to `/base/` using the existing SFTP credentials and add/update-only mode (`--no-perms`, no `--delete`). Never use `/` or `/skin9/` as the target.
5. Leave newly added images in place during emergency rollback: the restored old templates no longer reference them. Review their removal separately if needed; this workflow never deletes them.
6. Verify home, product, cart, and login again. Revert the redesign through a normal PR so a later deployment does not reintroduce it. Review the fixed manifest when reverting because a pre-redesign checkout lacks the newly required assets.

The automatic deployment is a sequence of file uploads, not a transactional switch. If the upload fails partway through, use the saved artifact to restore the exact touched files or fix the failure and rerun after a fresh backup.
