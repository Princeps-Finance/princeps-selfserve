/**
 * Moves focus to the first invalid control so keyboard and screen-reader users
 * land where the problem is. Call after marking controls as touched.
 */
export function focusFirstInvalid(root: ParentNode = document): void {
  root
    .querySelector<HTMLElement>(
      '[aria-invalid="true"], input.ng-invalid, select.ng-invalid, textarea.ng-invalid',
    )
    ?.focus();
}
