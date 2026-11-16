import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { ApplicationSession } from './core/session/application-session.service';
import { LangService } from './core/i18n/lang.service';
export const languageNotChosenGuard: CanMatchFn = () =>
  inject(LangService).hasChosen() ? inject(Router).parseUrl('/apply/welcome') : true;
export const languageChosenGuard: CanMatchFn = () =>
  inject(LangService).hasChosen() ? true : inject(Router).parseUrl('/');
export const sessionGuard: CanMatchFn = () =>
  inject(ApplicationSession).applicationId() ? true : inject(Router).parseUrl('/apply/bvn');
export const verifiedGuard: CanMatchFn = () => {
  if (!inject(ApplicationSession).applicationId()) return inject(Router).parseUrl('/apply/bvn');
  return inject(ApplicationSession).verified() ? true : inject(Router).parseUrl('/apply/verify');
};
